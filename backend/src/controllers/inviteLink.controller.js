const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const { AUDIT_ACTIONS } = require('../config/constants');
const inviteLinkService = require('../services/inviteLink.service');
const organizationService = require('../services/organization.service');
const sessionService = require('../services/session.service');
const auditService = require('../services/audit.service');
const { disconnectSessions } = require('../sockets/kick');

// GET /organizations/:id/invite-link (owners/admins)
const get = asyncHandler(async (req, res) => {
  success(res, { link: await inviteLinkService.getLink(req.organization._id) });
});

// POST /organizations/:id/invite-link -> creates or regenerates
const create = asyncHandler(async (req, res) => {
  const link = await inviteLinkService.createLink(req.organization._id, req.user._id);
  await auditService.record(req.organization._id, req.user._id, AUDIT_ACTIONS.INVITE_LINK_CREATED);
  success(res, { link }, 201);
});

// DELETE /organizations/:id/invite-link
const disable = asyncHandler(async (req, res) => {
  await inviteLinkService.disableLink(req.organization._id);
  await auditService.record(req.organization._id, req.user._id, AUDIT_ACTIONS.INVITE_LINK_DISABLED);
  success(res, { link: null });
});

// GET /invitations/link/:token (public)
const lookup = asyncHandler(async (req, res) => {
  const organization = await inviteLinkService.findByToken(req.params.token);
  if (!organization) {
    throw new AppError(400, 'This invite link is invalid or has expired');
  }
  success(res, { workspace: inviteLinkService.toPublicLookup(organization) });
});

// POST /invitations/link/join { token } (signed in)
const join = asyncHandler(async (req, res) => {
  const { organization, membership, joined } = await inviteLinkService.joinByToken(
    req.user,
    req.body?.token,
  );
  if (joined) {
    await auditService.record(
      organization._id,
      req.user._id,
      AUDIT_ACTIONS.MEMBER_JOINED_VIA_LINK,
      auditService.userTarget(req.user),
    );
  }
  const previous = req.session.activeOrganization;
  await sessionService.setActiveOrganization(req.session, organization._id);
  if (String(previous) !== String(organization._id)) {
    disconnectSessions(req.app.get('io'), [req.session._id]);
  }
  success(res, {
    joined,
    organization: organizationService.toPublicOrganization(organization),
    membership: organizationService.toMembership(membership),
  });
});

module.exports = { get, create, disable, lookup, join };
