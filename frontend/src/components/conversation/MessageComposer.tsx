'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { displayToTokens } from '@/lib/mentions';
import { matchSlashCommands, runSlashCommand, type SlashCommand } from '@/lib/slashCommands';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { updateChannel } from '@/lib/channels';
import { formatScheduleTime } from '@/lib/scheduleTimes';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useComposerDraft } from '@/hooks/useComposerDraft';
import { useComposerUploads } from '@/hooks/useComposerUploads';
import { useDnd } from '@/hooks/useDnd';
import { useScheduled } from '@/hooks/useScheduled';
import { VoiceRecorder } from './VoiceRecorder';
import { EmojiPicker } from './EmojiPicker';
import { RichEditor } from './editor/RichEditor';
import { ComposerToolbar } from './editor/ComposerToolbar';
import { LinkDialog } from './editor/LinkDialog';
import { useEditorControls } from './editor/useEditorControls';
import { MentionMenu, mentionOptions, type MentionOption } from './composer/MentionMenu';
import { SlashMenu } from './composer/SlashMenu';
import { AttachmentChips } from './composer/AttachmentChips';
import { ScheduleMenu } from './composer/ScheduleMenu';
import { ScheduledBanner } from './composer/ScheduledBanner';
import type { DraftTarget } from '@/types/draft';
import type { ScheduleTarget } from '@/types/scheduled';
import type { User } from '@/types/user';
import type { PendingAttachment } from '@/types/message';
import styles from './MessageComposer.module.css';

const TYPING_IDLE_MS = 3000;
const TOOLBAR_KEY = 'composer.toolbar';
const USER_TOKEN_RE = /^<@([0-9a-fA-F]{24})>$/;
const FILE_ACCEPT =
  'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.json,.md';

const readToolbarPref = () => {
  try {
    return window.localStorage.getItem(TOOLBAR_KEY) !== 'off';
  } catch {
    return true;
  }
};

/**
 * Slack-style composer: ScheduledBanner above the box; inside it the
 * formatting bar (toggled by "Aa"), attachment chips, the rich editor and the
 * action row [+ | Aa | emoji | @ | video | mic | / | ... send v].
 * `value` is always Slack text (drafts, sending, scheduling).
 */
export const MessageComposer = ({
  placeholder = 'Write a message…',
  disabled = false,
  mentionables = [],
  allowChannelMention = false,
  onSend,
  onTyping,
  draftTarget = null,
  scheduleTarget = null,
  onEditLast,
}: {
  /** Up arrow in an empty composer: edit your last message. */
  onEditLast?: () => void;
  /** Composer whose text is kept in the user's drafts (autosaved). */
  draftTarget?: DraftTarget | null;
  /** Where "send later" posts (no scheduling without it). */
  scheduleTarget?: ScheduleTarget | null;
  placeholder?: string;
  disabled?: boolean;
  mentionables?: User[];
  allowChannelMention?: boolean;
  onSend: (content: string, attachments: PendingAttachment[]) => Promise<void> | void;
  onTyping?: (active: boolean, activity?: 'typing' | 'recording') => void;
}) => {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [notice, setNotice] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const controls = useEditorControls();
  const { editorRef } = controls;
  const uploads = useComposerUploads();
  const { pause: setDnd } = useDnd();
  const { schedule } = useScheduled();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActive = useRef(false);

  const audio = useAudioRecorder('audio');
  const video = useAudioRecorder('video');
  const recorder = video.status !== 'idle' ? video : audio;
  const recording = recorder.status === 'recording';

  useEffect(() => setShowToolbar(readToolbarPref()), []);

  // Sets the text in state AND the editor (drafts, clear on send, completion).
  const replaceValue = useCallback(
    (next: string) => {
      setValue(next);
      editorRef.current?.setValue(next);
    },
    [editorRef],
  );
  const draft = useComposerDraft(draftTarget, value, replaceValue);

  const resolveMention = useCallback(
    (token: string) => {
      const match = USER_TOKEN_RE.exec(token);
      if (match) {
        const id = match[1].toLowerCase();
        const user = mentionables.find((member) => member.id.toLowerCase() === id);
        return `@${user?.fullName ?? 'unknown'}`;
      }
      return token.includes('channel') ? '@channel' : '@here';
    },
    [mentionables],
  );

  // Chip labels of a restored draft refresh once members load.
  useEffect(() => {
    editorRef.current?.refreshMentions();
  }, [mentionables, editorRef]);

  const mentionQuery = menuDismissed ? null : controls.mentionQuery;
  const options = useMemo<MentionOption[]>(
    () =>
      mentionQuery === null ? [] : mentionOptions(mentionQuery, mentionables, allowChannelMention),
    [mentionQuery, mentionables, allowChannelMention],
  );
  const slashCommands = useMemo(
    () => (menuDismissed || options.length > 0 ? null : matchSlashCommands(value)),
    [menuDismissed, options.length, value],
  );
  const menuLength = options.length > 0 ? options.length : (slashCommands?.length ?? 0);

  useEffect(() => setHighlight(0), [mentionQuery, slashCommands?.length]);

  const stopTyping = useCallback(() => {
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    if (typingActive.current) {
      typingActive.current = false;
      onTyping?.(false);
    }
  }, [onTyping]);

  const onChange = (next: string) => {
    setValue(next);
    setSendError('');
    setNotice('');
    setMenuDismissed(false);
    if (!typingActive.current) {
      typingActive.current = true;
      onTyping?.(true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const pickMention = (option: MentionOption) => {
    const label = option.user ? `@${option.user.fullName}` : `@${option.label}`;
    editorRef.current?.insertMention(option.token, label);
  };

  const pickSlash = (command: SlashCommand) => {
    replaceValue(`/${command.name} `);
    editorRef.current?.focus();
  };

  const [taskTarget, setTaskTarget] = useState<{
    channelId: string | null;
    conversationId: string | null;
    title: string;
  } | null>(null);

  const runCommand = async (content: string) => {
    const channelId = scheduleTarget?.kind === 'channel' ? scheduleTarget.id : null;
    return runSlashCommand(content, {
      channelId,
      setDnd,
      setTopic: async (id, topic) => {
        await updateChannel(id, { topic });
      },
    });
  };

  const submit = async () => {
    const content = value.trim();
    const attachments = uploads.pending;
    if ((!content && attachments.length === 0) || disabled || sending || uploads.uploading) {
      return;
    }
    setSending(true);
    setSendError('');
    stopTyping();
    try {
      let text = content;
      if (content.startsWith('/') && attachments.length === 0) {
        const result = await runCommand(content);
        if (result?.kind === 'error') {
          setSendError(result.message);
          return;
        }
        if (result?.kind === 'done') {
          replaceValue('');
          setNotice(result.notice);
          return;
        }
        if (result?.kind === 'task') {
          if (!scheduleTarget) {
            setSendError('/task only works in a channel or direct message');
            return;
          }
          replaceValue('');
          setTaskTarget({
            channelId: scheduleTarget.kind === 'channel' ? scheduleTarget.id : null,
            conversationId: scheduleTarget.kind === 'channel' ? null : scheduleTarget.id,
            title: result.title,
          });
          return;
        }
        if (result?.kind === 'send') text = result.content;
      }
      replaceValue('');
      draft.markSent();
      try {
        await onSend(displayToTokens(text, mentionables), attachments);
        uploads.setPending([]);
      } catch (error) {
        replaceValue(content);
        throw error;
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  const scheduleSend = async (at: Date) => {
    const content = value.trim();
    if (!scheduleTarget || !content) return;
    if (uploads.pending.length > 0) {
      setSendError('Scheduled messages can only contain text');
      return;
    }
    setSendError('');
    try {
      await schedule(scheduleTarget, displayToTokens(content, mentionables), at);
      replaceValue(''); // the draft autosave then deletes the saved draft
      stopTyping();
      setNotice(`Scheduled for ${formatScheduleTime(at)}`);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to schedule message');
    }
  };

  const recordingRef = useRef(false);
  recordingRef.current = recording;

  // Others see "is recording audio" while a clip records (re-sent so it
  // does not expire on the server mid-recording).
  useEffect(() => {
    if (!recording) {
      return;
    }
    onTyping?.(true, 'recording');
    const beat = setInterval(() => onTyping?.(true, 'recording'), 4000);
    return () => {
      clearInterval(beat);
      onTyping?.(false, 'recording');
    };
  }, [recording, onTyping]);

  // Sends the clip: when still recording (auto-stop at the cap) it stops
  // first, otherwise it sends the recorded preview.
  const sendRecording = async () => {
    if (sending) return;
    const file = recordingRef.current ? await recorder.stop() : recorder.previewFile;
    if (!file) return;
    setSending(true);
    setSendError('');
    try {
      const [attachment] = await uploads.runUploads([file]);
      if (!attachment) {
        setSendError('Unable to upload the recording');
        return;
      }
      await onSend('', [attachment]);
      await recorder.discard();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to send the recording');
    } finally {
      setSending(false);
    }
  };

  const sendRecordingRef = useRef(sendRecording);
  sendRecordingRef.current = sendRecording;

  // Slack-style cap: finish and send automatically at the max duration.
  useEffect(() => {
    if (recording && recorder.seconds >= recorder.maxSeconds) {
      void sendRecordingRef.current();
    }
  }, [recording, recorder.seconds, recorder.maxSeconds]);

  const startRecording = (kind: 'audio' | 'video') => {
    setSendError('');
    void (kind === 'video' ? video : audio).start();
  };

  const toggleToolbar = () => {
    setShowToolbar((current) => {
      try {
        window.localStorage.setItem(TOOLBAR_KEY, current ? 'off' : 'on');
      } catch {
        // ignore (private mode)
      }
      return !current;
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // IME composition (e.g. Japanese input): Enter confirms the candidate.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (controls.handleShortcut(event)) return;

    if (menuLength > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setHighlight((current) => (current + step + menuLength) % menuLength);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        if (options.length > 0) pickMention(options[highlight]);
        else if (slashCommands) pickSlash(slashCommands[highlight]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuDismissed(true);
        return;
      }
    }

    if (event.key === 'ArrowUp' && value === '' && onEditLast) {
      event.preventDefault();
      onEditLast();
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const onDragOver = (event: React.DragEvent) => {
    if (disabled || !Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    setDragOver(true);
  };

  const onDrop = (event: React.DragEvent) => {
    setDragOver(false);
    if (disabled || event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    void uploads.addFiles(event.dataTransfer.files);
  };

  useEffect(() => () => stopTyping(), [stopTyping]);

  const busy = disabled || uploads.uploading || sending;
  const hasText = value.trim() !== '';
  const canSend = !busy && (hasText || uploads.pending.length > 0);
  const canSchedule = Boolean(scheduleTarget) && !busy && hasText && uploads.pending.length === 0;

  return (
    <div
      className={`${styles.wrap} ${dragOver ? styles.dragOver : ''}`}
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      {dragOver && <div className={styles.dropHint}>Drop files to upload</div>}
      {options.length > 0 ? (
        <MentionMenu
          options={options}
          highlight={highlight}
          onHighlight={setHighlight}
          onPick={pickMention}
        />
      ) : (
        slashCommands &&
        slashCommands.length > 0 && (
          <SlashMenu
            commands={slashCommands}
            highlight={highlight}
            onHighlight={setHighlight}
            onPick={pickSlash}
          />
        )
      )}

      <div className={styles.bar}>
        {scheduleTarget && <ScheduledBanner target={scheduleTarget} />}
        {(sendError || recorder.error) && (
          <p className={styles.sendError}>{sendError || recorder.error}</p>
        )}
        {notice && <p className={styles.notice}>{notice}</p>}

        <div className={styles.box}>
          {showToolbar && recorder.status === 'idle' && (
            <ComposerToolbar
              active={controls.formats}
              disabled={disabled}
              onAction={controls.runAction}
            />
          )}

          <AttachmentChips
            pending={uploads.pending}
            uploads={uploads.uploads}
            onRemovePending={uploads.removePending}
            onCancelUpload={uploads.cancelUpload}
            onDismissUpload={uploads.dismissUpload}
          />

          {recorder.status !== 'idle' ? (
            <VoiceRecorder
              kind={recorder.kind}
              stream={recorder.stream}
              mode={recorder.status === 'recording' ? 'recording' : 'review'}
              seconds={recorder.seconds}
              level={recorder.level}
              previewUrl={recorder.previewUrl}
              sending={sending}
              onStop={() => void recorder.stop()}
              onDiscard={() => void recorder.discard()}
              onSend={() => void sendRecording()}
            />
          ) : (
            <>
              <RichEditor
                ref={editorRef}
                initialValue={value}
                placeholder={placeholder}
                disabled={disabled}
                resolveMention={resolveMention}
                onChange={onChange}
                onKeyDown={onKeyDown}
                onStateChange={controls.onStateChange}
                onPasteFiles={(files) => !disabled && void uploads.addFiles(files)}
                onBlur={stopTyping}
              />
              <div className={styles.actions}>
                <DropdownMenu
                  label="Add"
                  icon="plus"
                  align="left"
                  triggerClassName={styles.tool}
                  items={[
                    {
                      label: 'Upload from your computer',
                      icon: 'paperclip',
                      onSelect: () => fileInputRef.current?.click(),
                      disabled: busy,
                    },
                    ...(video.supported
                      ? [
                          {
                            label: 'Record video clip',
                            icon: 'video' as const,
                            onSelect: () => startRecording('video'),
                            disabled: busy,
                          },
                        ]
                      : []),
                    ...(audio.supported
                      ? [
                          {
                            label: 'Record audio clip',
                            icon: 'mic' as const,
                            onSelect: () => startRecording('audio'),
                            disabled: busy,
                          },
                        ]
                      : []),
                  ]}
                />
                <button
                  type="button"
                  className={`${styles.tool} ${styles.textTool} ${showToolbar ? styles.toolOn : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={toggleToolbar}
                  aria-pressed={showToolbar}
                  aria-label={showToolbar ? 'Hide formatting' : 'Show formatting'}
                  title={showToolbar ? 'Hide formatting' : 'Show formatting'}
                >
                  Aa
                </button>
                {!disabled && (
                  <EmojiPicker
                    onSelect={(emoji) => editorRef.current?.insertText(emoji)}
                    label="Insert emoji"
                    triggerClassName={styles.tool}
                  />
                )}
                <button
                  type="button"
                  className={styles.tool}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editorRef.current?.insertText(value === '' ? '@' : ' @')}
                  disabled={disabled}
                  aria-label="Mention someone"
                  title="Mention someone"
                >
                  <Icon name="at" size={17} />
                </button>
                {video.supported && (
                  <button
                    type="button"
                    className={styles.tool}
                    onClick={() => startRecording('video')}
                    disabled={busy}
                    aria-label="Record a video clip"
                    title="Record a video clip"
                  >
                    <Icon name="video" size={18} />
                  </button>
                )}
                {audio.supported && (
                  <button
                    type="button"
                    className={styles.tool}
                    onClick={() => startRecording('audio')}
                    disabled={busy}
                    aria-label="Record a voice message"
                    title="Record a voice message"
                  >
                    <Icon name="mic" size={18} />
                  </button>
                )}
                <button
                  type="button"
                  className={styles.tool}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    replaceValue('/');
                    editorRef.current?.focus();
                  }}
                  disabled={disabled || value !== ''}
                  aria-label="Shortcuts"
                  title="Shortcuts"
                >
                  <Icon name="slash" size={17} />
                </button>

                <span className={styles.spacer} />
                {hasText && <span className={styles.hint}>Shift+Enter for a new line</span>}

                <div className={styles.sendGroup}>
                  <button
                    type="button"
                    className={`${styles.send} ${scheduleTarget ? styles.sendSplit : ''}`}
                    onClick={() => void submit()}
                    disabled={!canSend}
                    aria-label="Send message"
                    title="Send"
                  >
                    <Icon name="send" size={16} />
                  </button>
                  {scheduleTarget && canSchedule && (
                    <ScheduleMenu
                      className={styles.scheduleTrigger}
                      onSchedule={(at) => void scheduleSend(at)}
                    />
                  )}
                  {scheduleTarget && !canSchedule && (
                    <span
                      className={`${styles.scheduleTrigger} ${styles.scheduleOff}`}
                      title="Type a message to schedule it"
                      aria-hidden
                    >
                      <Icon name="chevron-down" size={14} />
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className={styles.fileInput}
        accept={FILE_ACCEPT}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          void uploads.addFiles(files);
        }}
      />
      <LinkDialog {...controls.linkDialog} />
      <CreateTaskDialog target={taskTarget} onClose={() => setTaskTarget(null)} />
    </div>
  );
};
