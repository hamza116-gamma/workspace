const { cloudinary } = require('../config/cloudinary');
const { env } = require('../config/env');

const createUploadSignature = (folder, extra = {}, resourceType = 'image') => {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp, ...extra };
  const signature = cloudinary.utils.api_sign_request(params, env.cloudinary.apiSecret);

  return {
    timestamp,
    signature,
    folder,
    resourceType,
    cloudName: env.cloudinary.cloudName,
    apiKey: env.cloudinary.apiKey,
    maxUploadBytes: env.maxUploadBytes,
  };
};

// Fixed upload folders. Client-sent asset references are only accepted when
// they live inside the folder the server signed (utils/attachments.assertOwnedAsset).
const avatarFolder = (userId) => `avatars/${userId}`;
const attachmentFolder = (organizationId) => `org/${organizationId}/attachments`;

const createAvatarSignature = (userId) => createUploadSignature(avatarFolder(userId));

// Message attachments are namespaced per organization and uploaded with the
// "auto" resource type so images, video, audio and documents all work.
const createAttachmentSignature = (organizationId) =>
  createUploadSignature(attachmentFolder(organizationId), {}, 'auto');

const destroyAsset = async (publicId, resourceType = 'image') => {
  if (!publicId) {
    return;
  }
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

// A signed, server-fetchable delivery URL. private_download_url also works for
// file types that Cloudinary restricts on normal CDN delivery (PDF/ZIP), which
// is why downloads are proxied through this instead of the stored secure_url.
const buildDownloadUrl = (attachment) => {
  const resourceType =
    attachment.resourceType && attachment.resourceType !== 'auto'
      ? attachment.resourceType
      : 'image';
  return cloudinary.utils.private_download_url(
    attachment.publicId,
    attachment.format || undefined,
    { resource_type: resourceType, type: 'upload' },
  );
};

module.exports = {
  avatarFolder,
  attachmentFolder,
  createAvatarSignature,
  createUploadSignature,
  createAttachmentSignature,
  destroyAsset,
  buildDownloadUrl,
};
