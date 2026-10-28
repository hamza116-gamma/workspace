'use client';

import s from './ProjectDemos.module.css';

/*
 * Welcome intro animations for projects (8s loops, like IntroDemos):
 * a board where a ticket moves to Done, and a ticket whose subtasks tick off.
 */

/** Projects: a mini board; the WEB-2 card slides from To do to Done. */
export const ProjectsDemo = () => (
  <div className={s.stage} role="img" aria-label="Animation: a ticket moving across a project board">
    <div className={s.board}>
      {['To do', 'In review', 'Done'].map((column, index) => (
        <div key={column} className={s.column}>
          <span className={s.columnHead}>
            <i className={s[`dot${index}`]} />
            {column}
          </span>
          {index === 0 && (
            <div className={s.card}>
              <b>WEB-1</b> Landing page
            </div>
          )}
          {index === 2 && (
            <div className={s.card}>
              <b>WEB-3</b> Logo
            </div>
          )}
        </div>
      ))}
      <div className={`${s.card} ${s.moving}`}>
        <b>WEB-2</b> Login form
      </div>
    </div>
  </div>
);

/** Subtasks: a ticket's checklist ticks off and its progress bar fills. */
export const SubtasksDemo = () => (
  <div className={s.stage} role="img" aria-label="Animation: subtasks of a ticket being completed">
    <div className={s.ticket}>
      <div className={s.ticketHead}>
        <b>WEB-2</b> Login form
        <span className={s.progress}>
          <i />
        </span>
      </div>
      {['Design the form', 'Validate inputs', 'Write tests'].map((item, index) => (
        <div key={item} className={`${s.sub} ${s[`sub${index}`]}`}>
          <span className={s.box} />
          <span className={s.subKey}>WEB-2.{index + 1}</span>
          {item}
        </div>
      ))}
    </div>
  </div>
);
