const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const invitationService = require('../services/invitation.service');
const organizationService = require('../services/organization.service');
const sessionService = require('../services/session.service');
const auditService = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../config/constants');

const create = asyncHandler(async (req, res) => {
  const invitation = await invitationService.createInvitation(
    req.organization,
    req.user,
    req.body,
    req.membership?.role,
  );
  await auditService.record(
    req.organization._id,
    req.user._id,
    AUDIT_ACTIONS.INVITATION_SENT,
    auditService.emailTarget(invitation.email),
    { role: invitation.role },
  );
  success(res, { invitation: invitationService.toPublicInvitation(invitation) }, 201);
});

const list = asyncHandler(async (req, res) => {
  const invitations = await invitationService.listPending(req.organization._id);
  success(res, { invitations: invitations.map(invitationService.toPublicInvitation) });
});

const revoke = asyncHandler(async (req, res) => {
  const invitation = await invitationService.revokeInvitation(
    req.organization._id,
    req.params.invitationId,
  );
  await auditService.record(
    req.organization._id,
    req.user._id,
    AUDIT_ACTIONS.INVITATION_REVOKED,
    auditService.emailTarget(invitation.email),
  );
  success(res, { message: 'Invitation revoked' });
});

// POST /organizations/:id/invitations/:invitationId/resend
const resend = asyncHandler(async (req, res) => {
  const invitation = await invitationService.resendInvitation(
    req.organization,
    req.user,
    req.params.invitationId,
  );
  await auditService.record(
    req.organization._id,
    req.user._id,
    AUDIT_ACTIONS.INVITATION_RESENT,
    auditService.emailTarget(invitation.email),
  );
  success(res, { invitation: invitationService.toPublicInvitation(invitation) });
});

const lookup = asyncHandler(async (req, res) => {
  const invitation = await invitationService.findPendingByToken(req.params.token);
  if (!invitation) {
    throw new AppError(400, 'This invitation is invalid or has expired');
  }
  success(res, { invitation: invitationService.toPublicInvitationLookup(invitation) });
});

const accept = asyncHandler(async (req, res) => {
  const { membership, joined } = await invitationService.acceptInvitation(
    req.user,
    req.body?.token,
  );
  if (joined) {
    await auditService.record(
      membership.organization,
      req.user._id,
      AUDIT_ACTIONS.MEMBER_JOINED,
      auditService.userTarget(req.user),
      { role: membership.role },
    );
  }
  const organization = await organizationService.findById(membership.organization);
  await sessionService.setActiveOrganization(req.session, membership.organization);

  success(res, {
    organization: organizationService.toPublicOrganization(organization),
    membership: organizationService.toMembership(membership),
  });
});

module.exports = { create, list, revoke, resend, lookup, accept };
