const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireMembership, requireOrgRole } = require('../middleware/organization');
const { ORG_ROLES } = require('../config/constants');
const organizationController = require('../controllers/organization.controller');
const invitationController = require('../controllers/invitation.controller');
const inviteLinkController = require('../controllers/inviteLink.controller');
const auditController = require('../controllers/audit.controller');

const router = Router();

const ownerOrAdmin = requireOrgRole(ORG_ROLES.OWNER, ORG_ROLES.ADMIN);

router.use(requireAuth);

router.post('/', organizationController.create);
router.get('/', organizationController.listMine);

router.get('/:id', requireMembership, organizationController.get);
router.patch(
  '/:id',
  requireMembership,
  requireOrgRole(ORG_ROLES.OWNER, ORG_ROLES.ADMIN),
  organizationController.update,
);
router.post('/:id/switch', requireMembership, organizationController.switchOrganization);

router.get('/:id/members', requireMembership, organizationController.listMembers);
router.patch(
  '/:id/members/:userId',
  requireMembership,
  requireOrgRole(ORG_ROLES.OWNER, ORG_ROLES.ADMIN),
  organizationController.updateMember,
);
router.delete(
  '/:id/members/:userId',
  requireMembership,
  requireOrgRole(ORG_ROLES.OWNER, ORG_ROLES.ADMIN),
  organizationController.removeMember,
);

router.post(
  '/:id/invitations',
  requireMembership,
  requireOrgRole(ORG_ROLES.OWNER, ORG_ROLES.ADMIN),
  invitationController.create,
);
router.get(
  '/:id/invitations',
  requireMembership,
  requireOrgRole(ORG_ROLES.OWNER, ORG_ROLES.ADMIN),
  invitationController.list,
);
router.delete(
  '/:id/invitations/:invitationId',
  requireMembership,
  requireOrgRole(ORG_ROLES.OWNER, ORG_ROLES.ADMIN),
  invitationController.revoke,
);

router.post(
  '/:id/invitations/:invitationId/resend',
  requireMembership,
  ownerOrAdmin,
  invitationController.resend,
);

router.get('/:id/invite-link', requireMembership, ownerOrAdmin, inviteLinkController.get);
router.post('/:id/invite-link', requireMembership, ownerOrAdmin, inviteLinkController.create);
router.delete('/:id/invite-link', requireMembership, ownerOrAdmin, inviteLinkController.disable);

router.get('/:id/audit', requireMembership, ownerOrAdmin, auditController.list);

router.post('/:id/leave', requireMembership, organizationController.leave);
router.post(
  '/:id/transfer-ownership',
  requireMembership,
  requireOrgRole(ORG_ROLES.OWNER),
  organizationController.transferOwnership,
);

module.exports = router;
