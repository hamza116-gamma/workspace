'use client';

import styles from './TaskDemo.module.css';

/**
 * Looping demo (pure CSS, 12s) on a fixed 380×170 stage so the cursor lands
 * exactly: message -> ⋯ menu -> "Create task" -> the Create task form fills
 * in -> "Create task" button -> task card -> status moves to In progress.
 * Pixel targets are listed in TaskDemo.module.css.
 */
export const TaskDemo = () => (
  <div className={styles.frame}>
    <div className={styles.stage} aria-label="Animation: turning a message into a task" role="img">
      {/* The chat message */}
      <div className={styles.message}>
        <span className={styles.avatar}>S</span>
        <div>
          <div className={styles.msgHead}>
            <b>Sara</b> <span>10:24 AM</span>
          </div>
          <div className={styles.msgText}>
            <span className={styles.mention}>@Ali</span> can you fix the login bug?
          </div>
        </div>
      </div>

      {/* Hover toolbar + ⋯ menu */}
      <div className={styles.toolbar}>
        <span>👍</span>
        <span>✅</span>
        <span className={styles.more}>⋯</span>
      </div>
      <div className={styles.menu}>
        <div className={styles.menuItem}>Copy link</div>
        <div className={`${styles.menuItem} ${styles.menuTask}`}>
          <span className={styles.taskGlyph} /> Create task
        </div>
        <div className={styles.menuItem}>Pin to channel</div>
      </div>

      {/* Create task form */}
      <div className={styles.form}>
        <div className={styles.formTitle}>Create task</div>
        <div className={styles.field}>
          <span className={styles.mention}>@Ali</span> can you fix the login bug?
        </div>
        <div className={styles.formRow}>
          <span className={`${styles.chip} ${styles.fPrio}`}>
            <i style={{ background: '#f79009' }} /> High
          </span>
          <span className={`${styles.chip} ${styles.fDue}`}>📅 Tomorrow</span>
          <span className={`${styles.chip} ${styles.fWho}`}>
            <span className={styles.avatarSm}>A</span> Ali
          </span>
        </div>
        <div className={styles.formActions}>
          <span className={styles.cancel}>Cancel</span>
          <span className={styles.submit}>Create task</span>
        </div>
      </div>

      {/* The task card */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.key}>TASK-12</span>
          <span className={styles.prio}>High</span>
          <span className={styles.status}>
            <span className={styles.statusTodo}>● To do</span>
            <span className={styles.statusDoing}>● In progress</span>
          </span>
        </div>
        <div className={styles.cardTitle}>
          <span className={styles.mention}>@Ali</span> can you fix the login bug?
        </div>
        <div className={styles.cardFoot}>
          <span className={styles.assignee}>
            <span className={styles.avatarSm}>A</span> Ali
          </span>
          <span className={styles.due}>Due tomorrow</span>
        </div>
      </div>

      <span className={styles.ripple} aria-hidden />
      <div className={styles.cursor} aria-hidden>
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path d="M2 1l11 6-5 1.5L6 14z" fill="#101828" stroke="#fff" strokeWidth="1" />
        </svg>
      </div>
    </div>
  </div>
);
