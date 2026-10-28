'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import { updateMe } from '@/lib/users';
import { TaskDemo } from './TaskDemo';
import { ProjectsDemo, SubtasksDemo } from './ProjectDemos';
import {
  ActivityDemo,
  ChannelsDemo,
  HuddleDemo,
  SearchDemo,
  ThreadDemo,
  WelcomeDemo,
} from './IntroDemos';

// Each slide plays a small looping animation in its header.
const DEMOS = {
  welcome: WelcomeDemo,
  channels: ChannelsDemo,
  thread: ThreadDemo,
  task: TaskDemo,
  projects: ProjectsDemo,
  subtasks: SubtasksDemo,
  search: SearchDemo,
  huddle: HuddleDemo,
  activity: ActivityDemo,
};
type DemoName = keyof typeof DEMOS;
import styles from './WelcomeIntro.module.css';

// Replay from anywhere: window.dispatchEvent(new Event(OPEN_WELCOME_INTRO)).
export const OPEN_WELCOME_INTRO = 'welcome-intro:open';

type Slide = {
  icon: IconName;
  title: string;
  text: string;
  points: string[];
  // Animated demo shown in the header instead of the icon.
  demo: DemoName;
};

const SLIDES = (workspace: string): Slide[] => [
  {
    icon: 'message',
    demo: 'welcome',
    title: `Welcome to ${workspace}`,
    text: 'One place for your team to talk, share files and get work done. Here is a quick look at how it works.',
    points: [
      'Takes about a minute',
      'You can replay it any time from Keyboard shortcuts (Ctrl + /)',
    ],
  },
  {
    icon: 'hash',
    demo: 'channels',
    title: 'Channels and direct messages',
    text: 'Channels hold conversations about a topic or team. Direct messages are for one-to-one or small group chats.',
    points: [
      'Join public channels from "Browse channels"',
      'Private channels (🔒) are invite only',
      'Start a DM with the + next to Team messages',
    ],
  },
  {
    icon: 'thread',
    demo: 'thread',
    title: 'Threads, reactions and mentions',
    text: 'Keep conversations tidy by replying in a thread, and get someone’s attention with @mentions.',
    points: [
      'Hover a message to react, reply in a thread or pin it',
      'Type @ to mention a person, @channel or @here',
      'Attach files, record audio or video clips',
    ],
  },
  {
    icon: 'task',
    demo: 'task',
    title: 'Turn messages into tasks',
    text: 'Anything can become a task: assign it, set a due date and track it to done, right in the chat.',
    points: [
      'Message ⋯ menu → Create task, or type /task',
      'Pick a project to put it on that project’s board, or leave it Unassigned',
      'My tasks shows everything assigned to you',
    ],
  },
  {
    icon: 'list',
    demo: 'projects',
    title: 'Projects, boards and milestones',
    text: 'Group work into projects. Each has its own board, list, backlog and milestones, and only its people can see it.',
    points: [
      'Projects in the sidebar → New project (public, or private to the people you pick)',
      'Tickets get keys like WEB-12; drag them across the board',
      'Backlog keeps ideas off the board; milestones track progress to a date',
    ],
  },
  {
    icon: 'check',
    demo: 'subtasks',
    title: 'Tickets, subtasks and sharing',
    text: 'Create a ticket in three quick steps, break it into subtasks, and share it to any channel; comments stay in one thread.',
    points: [
      'Steps: Basics → Details (status, people, estimate, type) → Subtasks',
      'Subtasks get keys like WEB-12.1; tick them off from the ticket',
      'Each ticket has followers and a history of every change',
    ],
  },
  {
    icon: 'search',
    demo: 'search',
    title: 'Find anything with Ctrl + K',
    text: 'Jump to a channel, person, task or message in a couple of keystrokes.',
    points: [
      'Press Ctrl + K (⌘ K on Mac) from any page',
      'Use filters like from:me or has:file in full search',
    ],
  },
  {
    icon: 'headphones',
    demo: 'huddle',
    title: 'Huddles',
    text: 'Start a quick audio or video call with screen sharing, right from a channel or DM.',
    points: ['Click the headphones in a chat header', 'Others can join while it’s live'],
  },
  {
    icon: 'bell',
    demo: 'activity',
    title: 'Stay on top of things',
    text: 'Activity collects your mentions, thread replies, task assignments and reminders.',
    points: [
      'Unread chats are bold in the sidebar',
      'Pause notifications with Do Not Disturb (/dnd)',
    ],
  },
];

// Spotlight tour over the real UI. Steps whose element is not on screen
// (e.g. no composer outside a chat) are skipped.
const TOUR: { target: string; title: string; text: string }[] = [
  { target: 'search', title: 'Search', text: 'Click here or press Ctrl + K to find anything.' },
  {
    target: 'channels',
    title: 'Your channels',
    text: 'Channels you joined live here. Use + to create one.',
  },
  {
    target: 'composer',
    title: 'Write a message',
    text: 'Type here. Use @ to mention, / for commands like /task, and + to attach files.',
  },
  {
    target: 'projects',
    title: 'Projects',
    text: 'Your projects and the Unassigned board. All opens the full list, where you can start a new one.',
  },
  {
    target: 'tasks',
    title: 'My tasks',
    text: 'Everything assigned to you, as a board. The badge shows open tasks.',
  },
  {
    target: 'activity',
    title: 'Activity',
    text: 'Mentions, replies, task assignments and reminders.',
  },
];

const findTarget = (name: string) =>
  [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].find(
    (el) => el.offsetParent !== null,
  ) ?? null;

const PAD = 6;

const Spotlight = ({ onDone }: { onDone: () => void }) => {
  const steps = TOUR.filter((step) => findTarget(step.target));
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[index];

  const measure = useCallback(() => {
    const el = step ? findTarget(step.target) : null;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
      setRect(el.getBoundingClientRect());
    }
  }, [step]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    if (!step) onDone();
  }, [step, onDone]);

  if (!step || !rect) {
    return null;
  }

  const last = index === steps.length - 1;
  // Tooltip beside the target: right of it when there is room, else below.
  const roomRight = window.innerWidth - rect.right > 340;
  const tipStyle = roomRight
    ? { top: Math.max(12, rect.top), left: rect.right + 16 }
    : {
        top: Math.min(rect.bottom + 14, window.innerHeight - 200),
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)),
      };

  return (
    <div className={styles.tourLayer} role="dialog" aria-modal="true" aria-label="Product tour">
      <div
        className={styles.hole}
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
        }}
      />
      <div className={styles.tip} style={tipStyle}>
        <span className={styles.tipStep}>
          {index + 1} of {steps.length}
        </span>
        <h3 className={styles.tipTitle}>{step.title}</h3>
        <p className={styles.tipText}>{step.text}</p>
        <div className={styles.tipActions}>
          <button type="button" className={styles.link} onClick={onDone}>
            End tour
          </button>
          {index > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setIndex(index - 1)}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={() => (last ? onDone() : setIndex(index + 1))}>
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * First-run welcome: a short carousel explaining how the app works, then an
 * optional spotlight tour of the real UI. Shown once per account
 * (User.introSeenAt); replay via OPEN_WELCOME_INTRO.
 */
export const WelcomeIntro = () => {
  const { user, setUser } = useAuth();
  const { active } = useOrg();
  const [mode, setMode] = useState<'closed' | 'slides' | 'tour'>('closed');
  const [index, setIndex] = useState(0);
  const slides = SLIDES(active?.name || 'your workspace');

  // New accounts see it once (after a workspace is loaded).
  useEffect(() => {
    if (user && active && !user.introSeenAt) {
      setIndex(0);
      setMode('slides');
    }
    // Only when the user / workspace first appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, active?.id]);

  useEffect(() => {
    const open = () => {
      setIndex(0);
      setMode('slides');
    };
    window.addEventListener(OPEN_WELCOME_INTRO, open);
    return () => window.removeEventListener(OPEN_WELCOME_INTRO, open);
  }, []);

  const markSeen = useCallback(() => {
    if (user && !user.introSeenAt) {
      updateMe({ introSeen: true }).then(
        ({ user: next }) => setUser(next),
        () => undefined,
      );
    }
  }, [user, setUser]);

  const close = useCallback(() => {
    setMode('closed');
    markSeen();
  }, [markSeen]);

  useEffect(() => {
    if (mode !== 'slides') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') setIndex((value) => Math.min(value + 1, slides.length - 1));
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(value - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, close, slides.length]);

  if (mode === 'tour') {
    return <Spotlight onDone={close} />;
  }
  if (mode !== 'slides') {
    return null;
  }

  const slide = slides[index];
  const last = index === slides.length - 1;

  return (
    <div className={styles.overlay}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-label="Welcome">
        <button type="button" className={styles.skip} onClick={close}>
          Skip
        </button>

        <div className={`${styles.hero} ${styles.heroDemo}`} key={index}>
          {(() => {
            const Demo = DEMOS[slide.demo];
            return <Demo />;
          })()}
        </div>

        <div className={styles.body} key={`b-${index}`}>
          <h2 className={styles.title}>{slide.title}</h2>
          <p className={styles.text}>{slide.text}</p>
          <ul className={styles.points}>
            {slide.points.map((point) => (
              <li key={point}>
                <Icon name="check" size={14} />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.footer}>
          <div className={styles.dots}>
            {slides.map((item, dot) => (
              <button
                key={item.title}
                type="button"
                className={`${styles.dot} ${dot === index ? styles.dotOn : ''}`}
                onClick={() => setIndex(dot)}
                aria-label={`Go to step ${dot + 1}`}
              />
            ))}
          </div>
          <div className={styles.actions}>
            {index > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setIndex(index - 1)}>
                Back
              </Button>
            )}
            {last ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setMode('tour')}>
                  Show me around
                </Button>
                <Button size="sm" onClick={close}>
                  Get started
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setIndex(index + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
