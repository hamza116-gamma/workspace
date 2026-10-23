const Organization = require('../models/organization.model');
const OrganizationMember = require('../models/organizationMember.model');
const { ORG_ROLES, MEMBER_STATUS } = require('../config/constants');
const { AppError } = require('../utils/AppError');
const { assertString } = require('../utils/validation');
const { generateUniqueSlug } = require('../utils/slug');
const { toPublicUser } = require('./user.service');
const { removeChannelMemberships } = require('./memberCleanup.service');
const { ensureDefaultChannel } = require('./defaultChannel.service');

// Settings keys and their types, mirroring Organization.settings in the model.
const SETTINGS_SCHEMA = Object.fromEntries(
  Object.keys(Organization.schema.paths)
    .filter((path) => path.startsWith('settings.'))
    .map((path) => [path.slice('settings.'.length), Organization.schema.paths[path]]),
);

const ROLE_RANK = {
  [ORG_ROLES.MEMBER]: 0,
  [ORG_ROLES.MODERATOR]: 1,
  [ORG_ROLES.ADMIN]: 2,
  [ORG_ROLES.OWNER]: 3,
};

const toPublicOrganization = (organization) => ({
  id: organization._id,
  name: organization.name,
  slug: organization.slug,
  logoUrl: organization.logoUrl,
  settings: organization.settings,
  status: organization.status,
  createdAt: organization.createdAt,
});

const toMembership = (membership) => ({
  id: membership._id,
  role: membership.role,
  status: membership.status,
  joinedAt: membership.joinedAt,
});

const toPublicMember = (membership) => ({
  ...toMembership(membership),
  user: toPublicUser(membership.user),
});

const createOrganization = async (user, payload) => {
  const name = assertString(payload.name, 'Organization name');
  const slug = await generateUniqueSlug(name, (value) => Organization.exists({ slug: value }));

  const organization = await Organization.create({ name, slug });
  const membership = await OrganizationMember.create({
    organization: organization._id,
    user: user._id,
    role: ORG_ROLES.OWNER,
  });
  // Creator becomes the #general moderator.
  await ensureDefaultChannel(organization._id, user._id);

  return { organization, membership };
};

const listForUser = (userId) =>
  OrganizationMember.find({ user: userId }).populate('organization').sort({ createdAt: 1 });

const findById = (id) => Organization.findById(id);

const getMembership = (userId, organizationId) =>
  OrganizationMember.findOne({ user: userId, organization: organizationId });

const assertSettings = (settings) => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new AppError(400, 'Settings must be an object');
  }
  const result = {};
  for (const [key, value] of Object.entries(settings)) {
    const schemaType = Object.hasOwn(SETTINGS_SCHEMA, key) ? SETTINGS_SCHEMA[key] : null;
    if (!schemaType) {
      throw new AppError(400, `Unknown setting: ${key}`);
    }
    if (schemaType.instance === 'Boolean' && typeof value !== 'boolean') {
      throw new AppError(400, `Setting ${key} must be a boolean`);
    }
    if (schemaType.instance === 'String') {
      const allowed = schemaType.enumValues || [];
      if (typeof value !== 'string' || (allowed.length && !allowed.includes(value))) {
        throw new AppError(400, `Setting ${key} has an unsupported value`);
      }
    }
    result[key] = value;
  }
  return result;
};

const NAME_MAX = 80;

// Returns { organization, changes } where changes lists { field, from, to }
// for the audit log. The logo is not client-settable.
const updateOrganization = async (organization, payload) => {
  const changes = [];
  if (payload.name !== undefined) {
    const name = assertString(payload.name, 'Organization name');
    if (name.length > NAME_MAX) {
      throw new AppError(400, `Organization name must be at most ${NAME_MAX} characters`);
    }
    if (name !== organization.name) {
      changes.push({ field: 'name', from: organization.name, to: name });
      organization.name = name;
    }
  }
  if (payload.settings !== undefined) {
    const current = organization.settings.toObject();
    const next = assertSettings(payload.settings);
    Object.entries(next).forEach(([key, value]) => {
      if (current[key] !== value) {
        changes.push({ field: key, from: current[key], to: value });
      }
    });
    organization.settings = { ...current, ...next };
  }

  await organization.save();
  return { organization, changes };
};

const listMembers = (organizationId) =>
  OrganizationMember.find({ organization: organizationId }).populate('user').sort({ createdAt: 1 });

const guardLastOwner = async (organizationId) => {
  const owners = await OrganizationMember.countDocuments({
    organization: organizationId,
    role: ORG_ROLES.OWNER,
    status: MEMBER_STATUS.ACTIVE,
  });
  if (owners <= 1) {
    throw new AppError(409, 'An organization must keep at least one owner');
  }
};

// Non-owners may only manage members ranked below them and may only grant
// roles below their own; OWNER changes are reserved to owners.
const assertCanManageRole = (actorRole, targetRole, nextRole) => {
  if (actorRole === ORG_ROLES.OWNER) {
    return;
  }
  const actorRank = ROLE_RANK[actorRole] ?? -1;
  if ((ROLE_RANK[targetRole] ?? 0) >= actorRank) {
    throw new AppError(403, 'You cannot manage a member with an equal or higher role');
  }
  if (nextRole !== undefined && (ROLE_RANK[nextRole] ?? 0) >= actorRank) {
    throw new AppError(403, 'You cannot assign a role equal to or higher than your own');
  }
};

const updateMember = async (organizationId, userId, payload, actorId, actorRole) => {
  const membership = await OrganizationMember.findOne({
    organization: organizationId,
    user: userId,
  });
  if (!membership) {
    throw new AppError(404, 'Member not found in this organization');
  }

  const isSelf = actorId && String(actorId) === String(userId);
  if (isSelf && payload.status && payload.status !== MEMBER_STATUS.ACTIVE) {
    throw new AppError(400, 'You cannot disable yourself');
  }
  if (isSelf && payload.role !== undefined && payload.role !== membership.role) {
    throw new AppError(400, 'You cannot change your own role');
  }
  if (!isSelf) {
    assertCanManageRole(actorRole, membership.role, payload.role);
  }
  // Previous values for the audit log (organization.controller).
  membership.$locals.previous = { role: membership.role, status: membership.status };

  if (payload.role !== undefined) {
    if (!Object.values(ORG_ROLES).includes(payload.role)) {
      throw new AppError(400, 'Unsupported role');
    }
    if (membership.role === ORG_ROLES.OWNER && payload.role !== ORG_ROLES.OWNER) {
      await guardLastOwner(organizationId);
    }
    membership.role = payload.role;
  }

  if (payload.status !== undefined) {
    if (!Object.values(MEMBER_STATUS).includes(payload.status)) {
      throw new AppError(400, 'Unsupported status');
    }
    if (membership.role === ORG_ROLES.OWNER && payload.status !== MEMBER_STATUS.ACTIVE) {
      await guardLastOwner(organizationId);
    }
    membership.status = payload.status;
  }

  await membership.save();
  return membership;
};

const removeMember = async (organizationId, userId, actorId, actorRole) => {
  if (actorId && String(actorId) === String(userId)) {
    throw new AppError(400, 'You cannot remove yourself from the workspace');
  }

  const membership = await OrganizationMember.findOne({
    organization: organizationId,
    user: userId,
  });
  if (!membership) {
    throw new AppError(404, 'Member not found in this organization');
  }
  assertCanManageRole(actorRole, membership.role);
  if (membership.role === ORG_ROLES.OWNER) {
    await guardLastOwner(organizationId);
  }
  await membership.deleteOne();
  await removeChannelMemberships(organizationId, userId);
};

module.exports = {
  guardLastOwner,
  ROLE_RANK,
  assertCanManageRole,
  toPublicOrganization,
  toMembership,
  toPublicMember,
  createOrganization,
  listForUser,
  findById,
  getMembership,
  updateOrganization,
  listMembers,
  updateMember,
  removeMember,
};
