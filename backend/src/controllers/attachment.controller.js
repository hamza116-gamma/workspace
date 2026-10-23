const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const { createAttachmentSignature, buildDownloadUrl } = require('../utils/media');
const { openRemoteStream } = require('../utils/remoteFile');
const { assertAttachmentUpload } = require('../utils/attachments');
const attachmentService = require('../services/attachment.service');
const messageService = require('../services/message.service');

const getSignature = asyncHandler(async (req, res) => {
  const meta = assertAttachmentUpload({
    originalName: req.body?.originalName ?? req.body?.name,
    mimeType: req.body?.mimeType,
    size: req.body?.size,
  });
  success(res, { ...createAttachmentSignature(req.organization._id), ...meta });
});

const listChannel = asyncHandler(async (req, res) => {
  const attachments = await attachmentService.listForChannel(req.channel._id, req.query);
  success(res, { attachments });
});

const listConversation = asyncHandler(async (req, res) => {
  const attachments = await attachmentService.listForConversation(req.conversation._id, req.query);
  success(res, { attachments });
});

const safeFilename = (name) => String(name || 'download').replace(/["\\\r\n]/g, '_');

// Streams the file from storage through our own API with
// Content-Disposition: attachment, so downloads happen inside the app instead
// of navigating to the external storage URL.
const download = asyncHandler(async (req, res) => {
  const attachment = await attachmentService.findByIdForOrg(
    req.params.attachmentId,
    req.organization._id,
  );
  if (!attachment) {
    throw new AppError(404, 'Attachment not found');
  }

  const message = await messageService.findByIdForOrg(attachment.message, req.organization._id);
  if (!message) {
    throw new AppError(404, 'Attachment not found');
  }
  await messageService.assertAccess(message, req.user._id);

  const remote = await openRemoteStream(buildDownloadUrl(attachment));
  if (remote.statusCode !== 200) {
    remote.resume();
    throw new AppError(502, 'Unable to fetch the file');
  }

  const filename = safeFilename(attachment.originalName);
  res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  if (remote.headers['content-length']) {
    res.setHeader('Content-Length', remote.headers['content-length']);
  }

  remote.on('error', () => res.destroy());
  remote.pipe(res);
});

module.exports = { getSignature, listChannel, listConversation, download };
