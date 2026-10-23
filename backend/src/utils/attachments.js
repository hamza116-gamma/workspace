const { AppError } = require('./AppError');
const { env } = require('../config/env');
const { ATTACHMENT_KINDS } = require('../config/constants');
const { attachmentFolder } = require('./media');

const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const CLOUDINARY_HOST = 'res.cloudinary.com';

// Dangerous/executable extensions are always rejected, even if the client
// reports an innocuous MIME type.
const BLOCKED_EXTENSIONS = new Set([
  'svg',
  'html',
  'htm',
  'xhtml',
  'js',
  'mjs',
  'cjs',
  'jsx',
  'ts',
  'tsx',
  'exe',
  'dll',
  'bat',
  'cmd',
  'com',
  'scr',
  'msi',
  'jar',
  'app',
  'sh',
  'ps1',
  'vbs',
  'php',
  'py',
  'rb',
  'pl',
]);

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
  'application/octet-stream',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
]);

const fileExtension = (name) => {
  const clean = String(name || '').split(/[?#]/)[0];
  const index = clean.lastIndexOf('.');
  return index === -1 ? '' : clean.slice(index + 1).toLowerCase();
};

const isAllowedMime = (mimeType) => {
  const type = String(mimeType || '').toLowerCase();
  if (!type || type === 'image/svg+xml') {
    return false;
  }
  if (ALLOWED_MIME_TYPES.has(type)) {
    return true;
  }
  return ALLOWED_MIME_PREFIXES.some((prefix) => type.startsWith(prefix));
};

const assertAttachmentUpload = ({ originalName, mimeType, size }) => {
  const name = typeof originalName === 'string' ? originalName.trim() : '';
  if (!name) {
    throw new AppError(400, 'A file name is required');
  }
  const extension = fileExtension(name);
  if (!extension || BLOCKED_EXTENSIONS.has(extension)) {
    throw new AppError(400, `Files with the ".${extension || '?'}" extension are not allowed`);
  }
  if (!isAllowedMime(mimeType)) {
    throw new AppError(400, 'This file type is not allowed');
  }
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new AppError(400, 'A valid file size is required');
  }
  if (bytes > env.maxUploadBytes) {
    throw new AppError(413, 'File size exceeds the allowed limit');
  }
  return { originalName: name, mimeType: String(mimeType).toLowerCase(), size: bytes };
};

const kindForMime = (mimeType) => {
  const type = String(mimeType || '').toLowerCase();
  if (type.startsWith('image/')) {
    return ATTACHMENT_KINDS.IMAGE;
  }
  if (type.startsWith('video/')) {
    return ATTACHMENT_KINDS.VIDEO;
  }
  if (type.startsWith('audio/')) {
    return ATTACHMENT_KINDS.AUDIO;
  }
  return ATTACHMENT_KINDS.FILE;
};

const isCloudinaryUrl = (value) => {
  try {
    const url = new URL(String(value));
    return (
      url.protocol === 'https:' &&
      url.hostname === CLOUDINARY_HOST &&
      url.pathname.startsWith(`/${env.cloudinary.cloudName}/`)
    );
  } catch {
    return false;
  }
};

const ALLOWED_RESOURCE_TYPES = new Set(['image', 'video', 'raw']);

// The delivery URL must point at the same asset as the publicId, otherwise a
// client could pair its own publicId with another tenant's URL.
const urlMatchesPublicId = (value, publicId) => {
  try {
    return new URL(String(value)).pathname.includes(`/${publicId}`);
  } catch {
    return false;
  }
};

const isInFolder = (publicId, folder) =>
  typeof publicId === 'string' && publicId.startsWith(`${folder}/`) && !publicId.includes('..');

// A client-sent {url, publicId} is accepted only when the publicId lives in
// the folder the server signed the upload into and the URL points at it.
const assertOwnedAsset = ({ url, publicId }, folder, message = 'Asset does not belong to you') => {
  const id = typeof publicId === 'string' ? publicId.trim() : '';
  if (!id) {
    throw new AppError(400, 'Asset reference is incomplete');
  }
  if (!isCloudinaryUrl(url)) {
    throw new AppError(400, 'Asset URL is not allowed');
  }
  if (!isInFolder(id, folder)) {
    throw new AppError(400, message);
  }
  if (!urlMatchesPublicId(url, id)) {
    throw new AppError(400, 'Asset URL does not match its reference');
  }
  return id;
};

const optionalNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// Validates one uploaded-attachment reference that the client sends with a
// message (after the direct Cloudinary upload). The asset must live in the
// organization's own attachment folder.
const assertAttachmentRef = (ref, organizationId) => {
  if (!organizationId) {
    throw new AppError(500, 'Organization is required to validate attachments');
  }
  if (!ref || typeof ref !== 'object') {
    throw new AppError(400, 'Invalid attachment');
  }
  const originalName = ref.originalName ?? ref.name;
  assertAttachmentUpload({
    originalName,
    mimeType: ref.mimeType,
    size: ref.bytes ?? ref.size,
  });
  const publicId = assertOwnedAsset(
    { url: ref.url, publicId: ref.publicId },
    attachmentFolder(organizationId),
    'Attachment does not belong to this organization',
  );
  const resourceType = ref.resourceType === undefined ? 'image' : ref.resourceType;
  if (!ALLOWED_RESOURCE_TYPES.has(resourceType)) {
    throw new AppError(400, 'Unsupported attachment resource type');
  }

  return {
    kind: Object.values(ATTACHMENT_KINDS).includes(ref.kind) ? ref.kind : kindForMime(ref.mimeType),
    url: String(ref.url),
    publicId,
    resourceType,
    format: typeof ref.format === 'string' ? ref.format : fileExtension(originalName) || null,
    bytes: Number(ref.bytes ?? ref.size),
    originalName: String(originalName).trim(),
    mimeType: String(ref.mimeType).toLowerCase(),
    width: optionalNumber(ref.width),
    height: optionalNumber(ref.height),
    duration: optionalNumber(ref.duration),
  };
};

const toPublicAttachment = (attachment) => ({
  id: attachment._id,
  kind: attachment.kind,
  url: attachment.url,
  publicId: attachment.publicId,
  name: attachment.originalName,
  mimeType: attachment.mimeType,
  bytes: attachment.bytes,
  width: attachment.width ?? null,
  height: attachment.height ?? null,
  duration: attachment.duration ?? null,
  createdAt: attachment.createdAt,
});

module.exports = {
  MAX_ATTACHMENTS_PER_MESSAGE,
  fileExtension,
  kindForMime,
  assertAttachmentUpload,
  assertAttachmentRef,
  isCloudinaryUrl,
  urlMatchesPublicId,
  isInFolder,
  assertOwnedAsset,
  toPublicAttachment,
};
