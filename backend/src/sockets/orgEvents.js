// Workspace-level live updates: settings/name changes (OrgLiveUpdates on the
// client refreshes its organization list).
const emitOrganizationUpdated = (io, organization) => {
  io?.to(`org:${String(organization._id)}`).emit('organization.updated', {
    organizationId: String(organization._id),
    name: organization.name,
    settings: organization.settings,
  });
};

module.exports = { emitOrganizationUpdated };
