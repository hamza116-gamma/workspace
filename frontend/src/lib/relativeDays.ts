// "today" / "1 day ago" / "N days ago" for coarse dates (invites).
export const daysAgo = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) {
    return 'today';
  }
  return days === 1 ? '1 day ago' : `${days} days ago`;
};

export const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: 'short', year: 'numeric' });

// "10:15 AM" today, otherwise "Yesterday" / "Oct 21".
export const shortWhen = (iso: string) => {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
