const Invitation = require('../models/invitation.model');
const OrganizationMember = require('../models/organizationMember.model');
const { ORG_ROLES, INVITATION_STATUS, MEMBER_STATUS } = require('../config/constants');
const { env, isProduction } = require('../config/env');
const { logger } = require('../config/logger');
const { AppError } = require('../utils/AppError');
const { assertEmail } = require('../utils/validation');
const { generateToken, hashToken } = require('../utils/token');
const { sendMail, isEmailConfigured } = require('../utils/mail');
const { invitationEmail } = require('../utils/emailTemplates');
const userService = require('./user.service');
const { joinDefaultChannel } = require('./defaultChannel.service');

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const toPublicInvitation = (invitation) => ({
  id: invitation._id,
  email: invitation.email,
  role: invitation.role,
  status: invitation.status,
  expiresAt: invitation.expiresAt,
  createdAt: invitation.createdAt,
});

const toPublicInvitationLookup = (invitation) => ({
  email: invitation.email,
  role: invitation.role,
  organizationName: invitation.organization ? invitation.organization.name : '',
  expiresAt: invitation.expiresAt,
});

const findPendingByToken = (token) =>
  Invitation.findOne({
    tokenHash: hashToken(token),
    status: INVITATION_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  }).populate('organization');

const deliverInvitation = async (organization, actor, email, token) => {
  const inviteLink = `${env.clientUrl}/invite?token=${token}`;
  if (isEmailConfigured()) {
    const { subject, text, html } = invitationEmail({
      organizationName: organization.name,
      inviteLink,
      inviterName: actor ? actor.fullName : null,
    });
    await sendMail({ to: email, subject, text, html });
  } else if (!isProduction) {
    logger.info(`Invitation link for ${email}: ${inviteLink}`);
  }
};

const createInvitation = async (organization, actor, payload, actorRole) => {
  const email = assertEmail(payload.email);
  const role = payload.role || ORG_ROLES.MEMBER;
  if (!Object.values(ORG_ROLES).includes(role)) {
    throw new AppError(400, 'Unsupported role');
  }
  // Only an owner may invite another owner.
  if (role === ORG_ROLES.OWNER && actorRole !== ORG_ROLES.OWNER) {
    throw new AppError(403, 'Only an owner can invite an owner');
  }

  const existingUser = await userService.findByEmail(email);
  if (existingUser) {
    const membership = await OrganizationMember.findOne({
      organization: organization._id,
      user: existingUser._id,
    });
    if (membership) {
      throw new AppError(409, 'This person is already a member');
    }
  }

  await Invitation.updateMany(
    { organization: organization._id, email, status: INVITATION_STATUS.PENDING },
    { status: INVITATION_STATUS.REVOKED },
  );

  const token = generateToken();
  const invitation = await Invitation.create({
    organization: organization._id,
    email,
    role,
    invitedBy: actor._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  await deliverInvitation(organization, actor, email, token);
  return invitation;
};

// New token + 7 more days; the old link stops working.
const resendInvitation = async (organization, actor, invitationId) => {
  const invitation = await Invitation.findOne({
    _id: invitationId,
    organization: organization._id,
  });
  if (!invitation) {
    throw new AppError(404, 'Invitation not found');
  }
  if (invitation.status !== INVITATION_STATUS.PENDING) {
    throw new AppError(409, 'Only pending invitations can be resent');
  }
  const token = generateToken();
  invitation.tokenHash = hashToken(token);
  invitation.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await invitation.save();
  await deliverInvitation(organization, actor, invitation.email, token);
  return invitation;
};

const listPending = (organizationId) =>
  Invitation.find({ organization: organizationId, status: INVITATION_STATUS.PENDING }).sort({
    createdAt: -1,
  });

const revokeInvitation = async (organizationId, invitationId) => {
  const invitation = await Invitation.findOne({
    _id: invitationId,
    organization: organizationId,
  });
  if (!invitation) {
    throw new AppError(404, 'Invitation not found');
  }
  if (invitation.status !== INVITATION_STATUS.PENDING) {
    throw new AppError(409, 'Only pending invitations can be revoked');
  }

  invitation.status = INVITATION_STATUS.REVOKED;
  await invitation.save();
  return invitation;
};

const acceptInvitation = async (user, token) => {
  if (typeof token !== 'string' || token === '') {
    throw new AppError(400, 'Invitation token is required');
  }

  const invitation = await Invitation.findOne({
    tokenHash: hashToken(token),
    status: INVITATION_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  });

  if (!invitation) {
    throw new AppError(400, 'Invitation is invalid or has expired');
  }
  if (invitation.email !== user.email) {
    throw new AppError(403, 'This invitation was issued to a different email address');
  }

  let membership = await OrganizationMember.findOne({
    organization: invitation.organization,
    user: user._id,
  });
  const joined = !membership;
  if (!membership) {
    membership = await OrganizationMember.create({
      organization: invitation.organization,
      user: user._id,
      role: invitation.role,
      status: MEMBER_STATUS.ACTIVE,
    });
  }

  invitation.status = INVITATION_STATUS.ACCEPTED;
  await invitation.save();
  if (membership.status === MEMBER_STATUS.ACTIVE) {
    await joinDefaultChannel(invitation.organization, user._id);
    // Public channels include everyone in the workspace.
    await require('./channel.service').joinPublicChannels(invitation.organization, user._id);
  }

  return { invitation, membership, joined };
};

module.exports = {
  toPublicInvitation,
  toPublicInvitationLookup,
  findPendingByToken,
  createInvitation,
  listPending,
  revokeInvitation,
  resendInvitation,
  acceptInvitation,
};
