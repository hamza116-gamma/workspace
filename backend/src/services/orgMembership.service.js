const OrganizationMember = require('../models/organizationMember.model');
const { ORG_ROLES, MEMBER_STATUS } = require('../config/constants');
const { AppError } = require('../utils/AppError');
const { guardLastOwner } = require('./organization.service');
const { removeChannelMemberships } = require('./memberCleanup.service');

// The last owner must transfer ownership before leaving.
const leaveOrganization = async (organizationId, membership) => {
  if (membership.role === ORG_ROLES.OWNER) {
    try {
      await guardLastOwner(organizationId);
    } catch {
      throw new AppError(409, 'You are the last owner. Transfer ownership before leaving.');
    }
  }
  await membership.deleteOne();
  await removeChannelMemberships(organizationId, membership.user);
};

// Another workspace the user can continue in after leaving (or null).
const nextOrganizationFor = async (userId, excludeOrganizationId) => {
  const next = await OrganizationMember.findOne({
    user: userId,
    organization: { $ne: excludeOrganizationId },
    status: MEMBER_STATUS.ACTIVE,
  }).sort({ createdAt: 1 });
  return next ? next.organization : null;
};

// Owner only (route guard). Target becomes OWNER, the actor becomes ADMIN.
const transferOwnership = async (organizationId, actorMembership, targetUserId) => {
  if (!targetUserId || String(targetUserId) === String(actorMembership.user)) {
    throw new AppError(400, 'Choose another member to transfer ownership to');
  }
  const target = await OrganizationMember.findOne({
    organization: organizationId,
    user: targetUserId,
  }).populate('user');
  if (!target) {
    throw new AppError(404, 'Member not found in this organization');
  }
  if (target.status !== MEMBER_STATUS.ACTIVE) {
    throw new AppError(409, 'Ownership can only be transferred to an active member');
  }
  const previousRole = target.role;
  target.role = ORG_ROLES.OWNER;
  await target.save();
  actorMembership.role = ORG_ROLES.ADMIN;
  await actorMembership.save();
  return { target, previousRole };
};

module.exports = { leaveOrganization, nextOrganizationFor, transferOwnership };
