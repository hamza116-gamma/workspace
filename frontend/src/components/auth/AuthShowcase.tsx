import styles from './AuthShowcase.module.css';

const MESSAGES = [
  {
    initial: 'JS',
    avatar: 'purple',
    name: 'Jessica Smith',
    time: '09:45 AM',
    text: 'Morning team! Latest specs and workspace updates are live for review.',
  },
  {
    initial: 'RA',
    avatar: 'blue',
    name: 'Ryan Anderson',
    time: '09:50 AM',
    text: 'Reviewed and approved. Ready for deployment ✓',
  },
];

export const AuthShowcase = () => (
  <aside className={styles.showcase}>
    <div className={styles.top}>
      <span className={styles.chip}>
        <span className={styles.chipDot} />
        Enterprise Ready
      </span>
      <span className={styles.trust}>Trusted by 10,000+ teams worldwide</span>
    </div>

    <div className={styles.mid}>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.channel}>
            <span className={styles.hash}>#</span>design-team
          </span>
          <span className={styles.live}>
            <span className={styles.liveDot} />
            Live
          </span>
        </div>

        <div className={styles.messages}>
          {MESSAGES.map((message, i) => (
            <div key={message.name} className={styles.msg}>
              <span
                className={`${styles.avatar} ${
                  message.avatar === 'purple' ? styles.avPurple : styles.avBlue
                }`}
              >
                {message.initial}
              </span>
              <div className={styles.msgBody}>
                <div className={styles.meta}>
                  <span className={styles.name}>{message.name}</span>
                  <span className={styles.time}>{message.time}</span>
                </div>
                <div className={styles.text}>{message.text}</div>
                {i === 1 && (
                  <div className={styles.reactions}>
                    <span className={`${styles.react} ${styles.reactMine}`}>🚀 4</span>
                    <span className={styles.react}>👍 2</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.cardFoot}>
          <span>Enterprise-grade encryption</span>
          <span>v2.4</span>
        </div>
      </div>
    </div>

    <div className={styles.bottom}>
      <span className={styles.eyebrow}>Why teams switch</span>
      <p className={styles.quote}>
        &ldquo;Workspace transformed how our product teams sync across time zones and ship
        features.&rdquo;
      </p>
      <div className={styles.dots}>
        <span className={styles.dotActive} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  </aside>
);
