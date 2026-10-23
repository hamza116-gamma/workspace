'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { scheduleTimeError, toLocalInputValue, tomorrowAt9 } from '@/lib/scheduleTimes';
import styles from './ScheduleDialog.module.css';

/** Custom date + time for a scheduled message (local time). */
export const ScheduleDialog = ({
  open,
  initial,
  title = 'Schedule message',
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: Date;
  title?: string;
  onClose: () => void;
  onSubmit: (at: Date) => void;
}) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setValue(toLocalInputValue(initial ?? tomorrowAt9()));
      setError('');
    }
  }, [open, initial]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const date = new Date(value);
    const problem = scheduleTimeError(date);
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit(date);
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <Input
          label="Date and time"
          name="schedule-at"
          type="datetime-local"
          value={value}
          min={toLocalInputValue(new Date())}
          onChange={(event) => {
            setValue(event.target.value);
            setError('');
          }}
          error={error}
        />
        <p className={styles.note}>Times use your local time zone. Up to 120 days ahead.</p>
        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Schedule</Button>
        </div>
      </form>
    </Modal>
  );
};
