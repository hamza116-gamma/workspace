const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const organizationService = require('../services/organization.service');
const sessionService = require('../services/session.service');
const orgMembershipService = require('../services/orgMembership.service');
const auditService = require('../services/audit.service');
const userService = require('../services/user.service');
const { MEMBER_STATUS, AUDIT_ACTIONS } = require('../config/constants');
const { disconnectSessions, disconnectUserInOrg } = require('../sockets/kick');
const { emitOrganizationUpdated } = require('../sockets/orgEvents');

const getIo = (req) => req.app.get('io');

// Sockets authorize their organization once at connect time, so a member who
// loses access must be disconnected to drop every org/channel/thread room.
const disconnectUser = (req, userId) =>
  disconnectUserInOrg(getIo(req), userId, req.organization._id);

const recordMemberUpdate = async (req, membership, previous) => {
  const target = auditService.userTarget(membership.user);
  const record = (action, metadata) =>
    auditService.record(req.organization._id, req.user._id, action, target, metadata);
  if (previous.role && previous.role !== membership.role) {
    await record(AUDIT_ACTIONS.MEMBER_ROLE_CHANGED, { from: previous.role, to: membership.role });
  }
  if (previous.status && previous.status !== membership.status) {
    await record(
      membership.status === MEMBER_STATUS.ACTIVE
        ? AUDIT_ACTIONS.MEMBER_REACTIVATED
        : AUDIT_ACTIONS.MEMBER_DEACTIVATED,
    );
  }
};

const create = asyncHandler(async (req, res) => {
  const { organization, membership } = await organizationService.createOrganization(
    req.user,
    req.body,
  );
  await sessionService.setActiveOrganization(req.session, organization._id);
  await auditService.record(organization._id, req.user._id, AUDIT_ACTIONS.ORG_CREATED, {
    type: 'organization',
    id: String(organization._id),
    label: organization.name,
  });

  success(
    res,
    {
      organization: organizationService.toPublicOrganization(organization),
      membership: organizationService.toMembership(membership),
    },
    201,
  );
});

const listMine = asyncHandler(async (req, res) => {
  const memberships = await organizationService.listForUser(req.user._id);

  const activeOrganizationId = req.session?.activeOrganization;
  success(res, {
    organizations: memberships
      .filter((membership) => membership.organization)
      .map((membership) => ({
        ...organizationService.toPublicOrganization(membership.organization),
        role: membership.role,
        membershipStatus: membership.status,
        isActive: String(membership.organization._id) === String(activeOrganizationId),
      })),
  });
});

const get = asyncHandler(async (req, res) => {
  success(res, {
    organization: organizationService.toPublicOrganization(req.organization),
    membership: organizationService.toMembership(req.membership),
  });
});

const update = asyncHandler(async (req, res) => {
  const { organization, changes } = await organizationService.updateOrganization(
    req.organization,
    req.body || {},
  );
  if (changes.length) {
    await auditService.record(
      organization._id,
      req.user._id,
      AUDIT_ACTIONS.ORG_SETTINGS_UPDATED,
      null,
      { changes },
    );
    emitOrganizationUpdated(getIo(req), organization);
  }
  success(res, { organization: organizationService.toPublicOrganization(organization) });
});

const switchOrganization = asyncHandler(async (req, res) => {
  const previous = req.session.activeOrganization;
  await sessionService.setActiveOrganization(req.session, req.organization._id);
  // This session's sockets are still joined to the old organization's rooms;
  // disconnect them so the client reconnects scoped to the new one.
  if (String(previous) !== String(req.organization._id)) {
    disconnectSessions(getIo(req), [req.session._id]);
  }
  success(res, {
    organization: organizationService.toPublicOrganization(req.organization),
    membership: organizationService.toMembership(req.membership),
  });
});

const listMembers = asyncHandler(async (req, res) => {
  const members = await organizationService.listMembers(req.organization._id);
  success(res, { members: members.map(organizationService.toPublicMember) });
});

const updateMember = asyncHandler(async (req, res) => {
  const membership = await organizationService.updateMember(
    req.organization._id,
    req.params.userId,
    req.body,
    req.user._id,
    req.membership.role,
  );
  const previous = membership.$locals.previous || {};
  if (membership.status !== MEMBER_STATUS.ACTIVE) {
    disconnectUser(req, membership.user);
  }
  await membership.populate('user');
  await recordMemberUpdate(req, membership, previous);
  success(res, { member: organizationService.toPublicMember(membership) });
});

const removeMember = asyncHandler(async (req, res) => {
  const removed = await userService.findById(req.params.userId).catch(() => null);
  await organizationService.removeMember(
    req.organization._id,
    req.params.userId,
    req.user._id,
    req.membership.role,
  );
  disconnectUser(req, req.params.userId);
  await auditService.record(
    req.organization._id,
    req.user._id,
    AUDIT_ACTIONS.MEMBER_REMOVED,
    removed
      ? auditService.userTarget(removed)
      : { type: 'user', id: String(req.params.userId), label: '' },
  );
  success(res, { message: 'Member removed' });
});

// POST /organizations/:id/leave (any member; the last owner must transfer first)
const leave = asyncHandler(async (req, res) => {
  const organizationId = req.organization._id;
  await orgMembershipService.leaveOrganization(organizationId, req.membership);
  await auditService.record(
    organizationId,
    req.user._id,
    AUDIT_ACTIONS.MEMBER_LEFT,
    auditService.userTarget(req.user),
  );
  // Move this session to another workspace (or none) and cut the user's
  // sockets bound to the workspace they left.
  if (String(req.session.activeOrganization) === String(organizationId)) {
    const next = await orgMembershipService.nextOrganizationFor(req.user._id, organizationId);
    await sessionService.setActiveOrganization(req.session, next);
  }
  disconnectUser(req, req.user._id);
  success(res, { message: 'You left the workspace' });
});

// POST /organizations/:id/transfer-ownership { userId, confirm: <workspace name> }
const transferOwnership = asyncHandler(async (req, res) => {
  const { userId, confirm } = req.body || {};
  if (typeof confirm !== 'string' || confirm.trim() !== req.organization.name) {
    throw new AppError(400, 'Type the workspace name to confirm the transfer');
  }
  const { target, previousRole } = await orgMembershipService.transferOwnership(
    req.organization._id,
    req.membership,
    userId,
  );
  await auditService.record(
    req.organization._id,
    req.user._id,
    AUDIT_ACTIONS.OWNERSHIP_TRANSFERRED,
    auditService.userTarget(target.user),
    { previousRole },
  );
  success(res, {
    member: organizationService.toPublicMember(target),
    membership: organizationService.toMembership(req.membership),
  });
});

module.exports = {
  create,
  listMine,
  get,
  update,
  switchOrganization,
  listMembers,
  updateMember,
  removeMember,
  leave,
  transferOwnership,
};
