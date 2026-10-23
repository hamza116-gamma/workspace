// Tells the author's tabs that a scheduled message changed. `scheduled` is the
// public item while it is pending, or null once sent / cancelled / failed.
const emitScheduledUpdated = (io, item, scheduled) => {
  io?.to(`user:${item.user}`).emit('scheduled.updated', {
    organizationId: String(item.organization),
    id: String(item._id),
    status: item.status,
    error: item.error || '',
    scheduled,
  });
};

module.exports = { emitScheduledUpdated };
