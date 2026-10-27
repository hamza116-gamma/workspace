'use client';

import s from './IntroDemos.module.css';

/*
 * Small looping CSS animations for the welcome intro (one per slide).
 * Each demo runs on its own 8s timeline (see IntroDemos.module.css).
 */

const Cursor = ({ className }: { className: string }) => (
  <div className={`${s.cursor} ${className}`} aria-hidden>
    <svg viewBox="0 0 16 16" width="16" height="16">
      <path d="M2 1l11 6-5 1.5L6 14z" fill="#101828" stroke="#fff" strokeWidth="1" />
    </svg>
  </div>
);

/** Welcome: a mini workspace where the team's messages pop in. */
export const WelcomeDemo = () => (
  <div className={s.stage} role="img" aria-label="Animation: a team chatting in a workspace">
    <div className={s.window}>
      <div className={s.side}>
        <span className={s.sideLine} />
        <span className={`${s.sideLine} ${s.sideActive}`} />
        <span className={s.sideLine} />
        <span className={s.sideLine} />
      </div>
      <div className={s.chat}>
        <div className={`${s.bubble} ${s.w1}`}>
          <span className={s.dot} style={{ background: '#f79009' }} />
          <b>Sara</b> Morning team 👋
        </div>
        <div className={`${s.bubble} ${s.w2}`}>
          <span className={s.dot} style={{ background: '#2e90fa' }} />
          <b>Ali</b> Design is ready for review
        </div>
        <div className={`${s.bubble} ${s.w3}`}>
          <span className={s.dot} style={{ background: '#12b76a' }} />
          <b>Omar</b> Great, shipping today 🚀
        </div>
      </div>
    </div>
  </div>
);

/** Channels: click a channel, an unread one lights up, a new DM appears. */
export const ChannelsDemo = () => (
  <div className={s.stage} role="img" aria-label="Animation: switching channels and DMs">
    <div className={s.list}>
      <div className={s.listLabel}>Channels</div>
      <div className={s.item}># general</div>
      <div className={`${s.item} ${s.chSelect}`}># design</div>
      <div className={`${s.item} ${s.chUnread}`}>
        # releases <span className={s.badge}>2</span>
      </div>
      <div className={s.listLabel}>Direct messages</div>
      <div className={s.item}>
        <span className={s.avatarXs}>A</span> Ali
      </div>
      <div className={`${s.item} ${s.chNewDm}`}>
        <span className={s.avatarXs}>S</span> Sara
      </div>
    </div>
    <Cursor className={s.chCursor} />
    <span className={`${s.ripple} ${s.chRipple}`} aria-hidden />
  </div>
);

/** Threads: a reaction pops, the count rises, replies appear. */
export const ThreadDemo = () => (
  <div className={s.stage} role="img" aria-label="Animation: reactions and thread replies">
    <div className={s.card}>
      <div className={s.msgHead}>
        <span className={s.avatarSm}>S</span>
        <b>Sara</b>
        <span className={s.time}>9:41 AM</span>
      </div>
      <div className={s.msgText}>
        <span className={`${s.mention} ${s.thMention}`}>@channel</span> new release notes are up
      </div>
      <div className={s.reactRow}>
        <span className={`${s.reaction} ${s.thReact}`}>
          👍 <span className={s.count1}>1</span>
          <span className={s.count2}>2</span>
        </span>
        <span className={`${s.reaction} ${s.thReact2}`}>🎉 1</span>
      </div>
      <div className={`${s.replies} ${s.thReplies}`}>
        <span className={s.avatarXs}>A</span>
        <span className={s.avatarXs}>O</span>2 replies
      </div>
    </div>
  </div>
);

/** Ctrl+K: keys press, the popup opens, a query types in, results appear. */
export const SearchDemo = () => (
  <div className={s.stage} role="img" aria-label="Animation: Ctrl+K search">
    <div className={s.keys}>
      <kbd className={s.key1}>Ctrl</kbd>
      <kbd className={s.key2}>K</kbd>
    </div>
    <div className={s.palette}>
      <div className={s.query}>
        <span className={s.glass}>⌕</span>
        <span className={s.typed}>
          {'login bug'.split('').map((char, index) => (
            <span
              key={index}
              className={s.letter}
              style={{ animationDelay: `${index * 0.14}s` }}
            >
              {char === ' ' ? ' ' : char}
            </span>
          ))}
        </span>
        <span className={s.caret} />
      </div>
      <div className={`${s.result} ${s.r1}`}>
        <span className={s.ri}>☑</span> TASK-12 · Fix the login bug
      </div>
      <div className={`${s.result} ${s.r2}`}>
        <span className={s.ri}>#</span> backend
      </div>
      <div className={`${s.result} ${s.r3}`}>
        <span className={s.ri}>💬</span> “the login bug happens on Safari…”
      </div>
    </div>
  </div>
);

/** Huddle: start a call, people join, someone talks, screen share appears. */
export const HuddleDemo = () => (
  <div className={s.stage} role="img" aria-label="Animation: starting a huddle">
    <div className={s.huddleHead}>
      <b># design</b>
      <span className={`${s.hBtn} ${s.huBtn}`}>🎧</span>
    </div>
    <div className={s.huddle}>
      <span className={s.live}>● Huddle</span>
      <div className={s.people}>
        <span className={`${s.face} ${s.hu1}`} style={{ background: '#d1ece2' }}>
          S
        </span>
        <span className={`${s.face} ${s.hu2}`} style={{ background: '#dbeafe' }}>
          A
        </span>
        <span className={`${s.face} ${s.hu3}`} style={{ background: '#fef0c7' }}>
          O
        </span>
      </div>
      <div className={s.share}>
        <span className={s.shareBar} />
        <span className={s.shareBar} style={{ width: '70%' }} />
        <span className={s.shareBar} style={{ width: '45%' }} />
        <span className={s.shareLabel}>Ali is sharing</span>
      </div>
    </div>
    <Cursor className={s.huCursor} />
    <span className={`${s.ripple} ${s.huRipple}`} aria-hidden />
  </div>
);

/** Activity: notifications slide in and the badge counts up. */
export const ActivityDemo = () => (
  <div className={s.stage} role="img" aria-label="Animation: activity notifications">
    <div className={s.bellWrap}>
      <span className={s.bell}>🔔</span>
      <span className={s.bellBadge}>
        <span className={s.b1}>1</span>
        <span className={s.b2}>2</span>
        <span className={s.b3}>3</span>
      </span>
    </div>
    <div className={s.feed}>
      <div className={`${s.note} ${s.n1}`}>
        <span className={s.noteIcon}>@</span>
        <span>
          <b>Sara</b> mentioned you in #design
        </span>
      </div>
      <div className={`${s.note} ${s.n2}`}>
        <span className={s.noteIcon}>☑</span>
        <span>
          <b>Ali</b> assigned you TASK-12
        </span>
      </div>
      <div className={`${s.note} ${s.n3}`}>
        <span className={s.noteIcon}>⏰</span>
        <span>TASK-12 is due within 24 hours</span>
      </div>
    </div>
  </div>
);
