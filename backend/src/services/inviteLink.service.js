const Organization = require('../models/organization.model');
const OrganizationMember = require('../models/organizationMember.model');
const { ORG_ROLES, MEMBER_STATUS } = require('../config/constants');
const { joinDefaultChannel } = require('./defaultChannel.service');
const { env } = require('../config/env');
const { AppError } = require('../utils/AppError');
const { generateToken } = require('../utils/token');

const LINK_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const isLive = (link) =>
  Boolean(link && link.token && link.expiresAt && link.expiresAt > new Date());

const linkUrl = (token) => `${env.clientUrl}/join?token=${encodeURIComponent(token)}`;

// Owner/admin view of the link (null when off or expired).
const toPublicLink = (link) =>
  isLive(link)
    ? {
        token: link.token,
        url: linkUrl(link.token),
        expiresAt: link.expiresAt,
        createdBy: link.createdBy,
      }
    : null;

const loadWithToken = (organizationId) =>
  Organization.findById(organizationId).select('+inviteLink.token');

const getLink = async (organizationId) => {
  const organization = await loadWithToken(organizationId);
  return toPublicLink(organization?.inviteLink);
};

// Creates a new link; an existing one stops working (regenerate).
const createLink = async (organizationId, actorId) => {
  const organization = await loadWithToken(organizationId);
  organization.inviteLink = {
    token: generateToken(),
    expiresAt: new Date(Date.now() + LINK_TTL_MS),
    createdBy: actorId,
  };
  await organization.save();
  return toPublicLink(organization.inviteLink);
};

const disableLink = async (organizationId) => {
  await Organization.updateOne(
    { _id: organizationId },
    { $set: { 'inviteLink.token': null, 'inviteLink.expiresAt': null } },
  );
};

const findByToken = async (token) => {
  if (typeof token !== 'string' || token.length < 16) {
    return null;
  }
  const organization = await Organization.findOne({
    'inviteLink.token': token,
    'inviteLink.expiresAt': { $gt: new Date() },
  });
  return organization;
};

const toPublicLookup = (organization) => ({
  organizationId: organization._id,
  organizationName: organization.name,
  logoUrl: organization.logoUrl,
});

// Joins as MEMBER. Returns { organization, membership, joined } where joined
// is false when the user already was an active member.
const joinByToken = async (user, token) => {
  const organization = await findByToken(token);
  if (!organization) {
    throw new AppError(400, 'This invite link is invalid or has expired');
  }
  const existing = await OrganizationMember.findOne({
    organization: organization._id,
    user: user._id,
  });
  if (existing) {
    if (existing.status !== MEMBER_STATUS.ACTIVE) {
      throw new AppError(403, 'Your account has been deactivated in this workspace');
    }
    return { organization, membership: existing, joined: false };
  }
  const membership = await OrganizationMember.create({
    organization: organization._id,
    user: user._id,
    role: ORG_ROLES.MEMBER,
    status: MEMBER_STATUS.ACTIVE,
  });
  await joinDefaultChannel(organization._id, user._id);
  return { organization, membership, joined: true };
};

module.exports = { getLink, createLink, disableLink, findByToken, toPublicLookup, joinByToken };
