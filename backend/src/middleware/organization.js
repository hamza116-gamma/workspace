const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { MEMBER_STATUS } = require('../config/constants');
const organizationService = require('../services/organization.service');

const loadMembership = async (userId, organizationId) => {
  if (!organizationId) {
    throw new AppError(409, 'No active organization. Create or select one.');
  }

  // Membership + organization in parallel (one round trip).
  const [membership, organization] = await Promise.all([
    organizationService.getMembership(userId, organizationId),
    organizationService.findById(organizationId),
  ]);
  if (!membership || membership.status !== MEMBER_STATUS.ACTIVE) {
    throw new AppError(403, 'You do not have access to this organization');
  }

  if (!organization) {
    throw new AppError(404, 'Organization not found');
  }

  return { organization, membership };
};

const requireOrganization = asyncHandler(async (req, _res, next) => {
  const context = await loadMembership(req.user._id, req.session?.activeOrganization);
  req.organization = context.organization;
  req.membership = context.membership;
  next();
});

const requireMembership = asyncHandler(async (req, _res, next) => {
  const context = await loadMembership(req.user._id, req.params.id);
  req.organization = context.organization;
  req.membership = context.membership;
  next();
});

const requireOrgRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.membership || !roles.includes(req.membership.role)) {
      next(new AppError(403, 'You do not have permission to perform this action'));
      return;
    }
    next();
  };

module.exports = { requireOrganization, requireMembership, requireOrgRole };
