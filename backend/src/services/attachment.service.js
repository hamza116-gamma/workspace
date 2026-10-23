const Attachment = require('../models/attachment.model');
const { AppError } = require('../utils/AppError');
const { logger } = require('../config/logger');
const { destroyAsset } = require('../utils/media');
const {
  MAX_ATTACHMENTS_PER_MESSAGE,
  assertAttachmentRef,
  toPublicAttachment,
} = require('../utils/attachments');

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 100;

const createForMessage = async (organizationId, message, refs, uploaderId) => {
  const list = Array.isArray(refs) ? refs : [];
  if (list.length === 0) {
    return [];
  }
  if (list.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new AppError(
      400,
      `A message can have at most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments`,
    );
  }

  const docs = list.map((ref) => ({
    organization: organizationId,
    message: message._id,
    channel: message.channel || null,
    conversation: message.conversation || null,
    uploader: uploaderId,
    ...assertAttachmentRef(ref, organizationId),
  }));

  // One uploaded file belongs to exactly one message, so deleting a message
  // can only ever delete its own files.
  const publicIds = docs.map((doc) => doc.publicId);
  if (new Set(publicIds).size !== publicIds.length) {
    throw new AppError(400, 'The same file cannot be attached twice');
  }
  if (await Attachment.exists({ publicId: { $in: publicIds } })) {
    throw new AppError(400, 'This file is already attached to another message');
  }

  return Attachment.insertMany(docs);
};

const getByMessageIds = async (messageIds) => {
  const map = new Map();
  if (!messageIds || messageIds.length === 0) {
    return map;
  }

  const attachments = await Attachment.find({ message: { $in: messageIds } }).sort({
    createdAt: 1,
  });

  for (const attachment of attachments) {
    const key = String(attachment.message);
    const list = map.get(key) || [];
    list.push(toPublicAttachment(attachment));
    map.set(key, list);
  }
  return map;
};

const getForMessage = async (messageId) => {
  const map = await getByMessageIds([messageId]);
  return map.get(String(messageId)) || [];
};

const findByIdForOrg = (id, organizationId) =>
  Attachment.findOne({ _id: id, organization: organizationId });

// Removes the attachments of a message from MongoDB and Cloudinary.
const removeForMessage = async (message) => {
  const attachments = await Attachment.find({ message: message._id });
  if (attachments.length === 0) {
    return;
  }
  await Attachment.deleteMany({ message: message._id });
  await Promise.all(
    attachments.map((attachment) =>
      destroyAsset(attachment.publicId, attachment.resourceType).catch((error) =>
        logger.error('Failed to delete attachment asset', error),
      ),
    ),
  );
};

const clampLimit = (limit) => {
  const value = Number(limit) || DEFAULT_LIMIT;
  return Math.min(Math.max(value, 1), MAX_LIMIT);
};

const listForChannel = async (channelId, { limit } = {}) => {
  const attachments = await Attachment.find({ channel: channelId })
    .sort({ createdAt: -1 })
    .limit(clampLimit(limit));
  return attachments.map(toPublicAttachment);
};

const listForConversation = async (conversationId, { limit } = {}) => {
  const attachments = await Attachment.find({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .limit(clampLimit(limit));
  return attachments.map(toPublicAttachment);
};

module.exports = {
  createForMessage,
  getByMessageIds,
  getForMessage,
  findByIdForOrg,
  removeForMessage,
  listForChannel,
  listForConversation,
};
