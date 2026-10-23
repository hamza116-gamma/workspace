'use client';

import { usePins } from '@/hooks/usePins';
import { useFocusMessage } from '@/hooks/useFocusMessage';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { MessageContent } from '@/components/conversation/MessageContent';
import styles from './ChannelPins.module.css';

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

export const ChannelPins = ({
  onSelectMessage,
}: {
  onSelectMessage?: (messageId: string) => void;
}) => {
  const { channelId, pins, loading, unpin } = usePins();
  const { focusMessage } = useFocusMessage();
  const selectMessage = onSelectMessage ?? focusMessage;

  if (!channelId) {
    return null;
  }

  return (
    <section className={styles.card}>
      <h3 className={styles.title}>
        Pinned
        {pins.length > 0 && <span className={styles.count}>{pins.length}</span>}
      </h3>

      {loading && pins.length === 0 && <p className={styles.hint}>Loading…</p>}
      {!loading && pins.length === 0 && (
        <p className={styles.hint}>Pin a message to keep it handy for the channel.</p>
      )}

      {pins.length > 0 && (
        <ul className={styles.list}>
          {pins.map((pin) => (
            <li key={pin.id} className={styles.item}>
              <button
                type="button"
                className={styles.open}
                onClick={() => selectMessage(pin.messageId)}
                aria-label={`Go to pinned message from ${pin.message.sender.fullName}`}
              >
                <span className={styles.head}>
                  <Avatar
                    name={pin.message.sender.fullName}
                    src={pin.message.sender.avatarUrl}
                    size={22}
                  />
                  <span className={styles.name}>{pin.message.sender.fullName}</span>
                  <span className={styles.time}>{formatDay(pin.message.createdAt)}</span>
                </span>
                <span className={styles.body}>
                  {pin.message.content ? (
                    <MessageContent
                      content={pin.message.content}
                      mentions={pin.message.mentions}
                      senderId={pin.message.sender.id}
                    />
                  ) : (
                    <span className={styles.attachmentNote}>Attachment</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className={styles.remove}
                onClick={() => void unpin(pin.messageId)}
                aria-label="Unpin message"
                title="Unpin"
              >
                <Icon name="close" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
