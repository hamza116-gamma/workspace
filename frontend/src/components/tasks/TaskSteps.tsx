import styles from './Tasks.module.css';

export const TASK_STEPS = ['Basics', 'Details', 'Subtasks'] as const;
export type TaskStep = 0 | 1 | 2;

/**
 * Step header of the create / edit task dialogs. Steps are clickable (edit:
 * jump anywhere; create: any step once the title is there).
 */
export const TaskSteps = ({
  step,
  onStep,
  canJump = true,
  hints = [],
}: {
  step: TaskStep;
  onStep: (step: TaskStep) => void;
  canJump?: boolean;
  // Short summary under each step label ("2 people · High").
  hints?: (string | undefined)[];
}) => (
  <ol className={styles.steps} aria-label="Steps">
    {TASK_STEPS.map((label, index) => {
      const state = index === step ? 'current' : index < step ? 'done' : 'todo';
      return (
        <li key={label} className={styles.stepItem}>
          <button
            type="button"
            className={`${styles.step} ${styles[`step_${state}`]}`}
            aria-current={index === step ? 'step' : undefined}
            disabled={!canJump && index !== step}
            onClick={() => onStep(index as TaskStep)}
          >
            <span className={styles.stepNum}>{state === 'done' ? '✓' : index + 1}</span>
            <span className={styles.stepText}>
              <span className={styles.stepLabel}>{label}</span>
              {/* Always there (blank when empty) so every pill has the same height. */}
              <span className={styles.stepHint}>{hints[index] || '\u00a0'}</span>
            </span>
          </button>
        </li>
      );
    })}
  </ol>
);
