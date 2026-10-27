import { TASK_TYPE_ICONS, TASK_TYPE_LABELS, formatEstimate, type Task } from '@/types/task';
import styles from './Tasks.module.css';

/** Type icon next to the key; nothing for a plain "Task". */
export const TypeIcon = ({ task }: { task: Pick<Task, 'type'> }) =>
  task.type && task.type !== 'TASK' ? (
    <span
      className={`${styles.typeIcon} ${styles[`type${task.type}`] ?? ''}`}
      title={TASK_TYPE_LABELS[task.type]}
      aria-label={TASK_TYPE_LABELS[task.type]}
    >
      {TASK_TYPE_ICONS[task.type]}
    </span>
  ) : null;

/** "2h" chip when the task has an estimate. */
export const EstimateChip = ({ task }: { task: Pick<Task, 'estimateMinutes'> }) =>
  task.estimateMinutes ? (
    <span className={styles.estimate} title="Estimate">
      ⏱ {formatEstimate(task.estimateMinutes)}
    </span>
  ) : null;

/** "2 / 5" with a thin bar when the task has subtasks. */
export const SubtaskProgress = ({ task }: { task: Pick<Task, 'subtaskTotal' | 'subtaskDone'> }) =>
  task.subtaskTotal > 0 ? (
    <span
      className={styles.subtaskProgress}
      title={`${task.subtaskDone} of ${task.subtaskTotal} subtasks done`}
    >
      <span className={styles.subtaskBar}>
        <i style={{ width: `${(task.subtaskDone / task.subtaskTotal) * 100}%` }} />
      </span>
      {task.subtaskDone} / {task.subtaskTotal}
    </span>
  ) : null;
