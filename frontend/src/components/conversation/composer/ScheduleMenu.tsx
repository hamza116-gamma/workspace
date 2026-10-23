'use client';

import { useState } from 'react';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { formatScheduleTime, nextMondayAt9, tomorrowAt9 } from '@/lib/scheduleTimes';
import { ScheduleDialog } from './ScheduleDialog';

/** Send-later chevron next to the send button (Slack "Schedule message"). */
export const ScheduleMenu = ({
  className,
  onSchedule,
}: {
  className?: string;
  onSchedule: (at: Date) => void;
}) => {
  const [custom, setCustom] = useState(false);
  const tomorrow = tomorrowAt9();
  const monday = nextMondayAt9();

  return (
    <>
      <DropdownMenu
        label="Schedule message"
        icon="chevron-down"
        align="right"
        triggerClassName={className}
        items={[
          { label: 'Schedule message', heading: true },
          {
            label: capitalize(formatScheduleTime(tomorrow)),
            icon: 'clock',
            onSelect: () => onSchedule(tomorrow),
          },
          {
            label: capitalize(formatScheduleTime(monday)),
            icon: 'clock',
            onSelect: () => onSchedule(monday),
          },
          { separator: true },
          { label: 'Custom time…', icon: 'pencil', onSelect: () => setCustom(true) },
        ]}
      />
      <ScheduleDialog
        open={custom}
        onClose={() => setCustom(false)}
        onSubmit={(at) => {
          setCustom(false);
          onSchedule(at);
        }}
      />
    </>
  );
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
