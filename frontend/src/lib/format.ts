const ordinalSuffix = (day: number) => {
  if (day % 100 >= 11 && day % 100 <= 13) {
    return 'th';
  }
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
};

// Slack-style absolute timestamp, e.g. "Oct 31st, 2025 at 5:53 PM".
export const formatFullTimestamp = (iso: string) => {
  const date = new Date(iso);
  const day = date.getDate();
  const month = date.toLocaleDateString([], { month: 'short' });
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${month} ${day}${ordinalSuffix(day)}, ${date.getFullYear()} at ${time}`;
};
