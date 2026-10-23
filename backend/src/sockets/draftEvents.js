// Keeps the user's other tabs in sync: draft is the public draft or null
// (deleted / sent).
const emitDraftUpdated = (io, organizationId, userId, key, draft) => {
  io?.to(`user:${userId}`).emit('draft.updated', {
    organizationId: String(organizationId),
    key,
    draft,
  });
};

module.exports = { emitDraftUpdated };
