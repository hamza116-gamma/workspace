import { API_URL, apiData } from './api';
import type { AttachmentKind, MessageAttachment, PendingAttachment } from '@/types/message';

// Same-app download URL: the backend streams the file with
// Content-Disposition: attachment, so downloads never leave the app.
export const attachmentDownloadUrl = (attachmentId: string) =>
  `${API_URL}/attachments/${attachmentId}/download`;

export type AttachmentSignature = {
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: string;
  cloudName: string;
  apiKey: string;
  maxUploadBytes: number;
  originalName: string;
  mimeType: string;
  size: number;
};

export const kindForMime = (mimeType: string): AttachmentKind => {
  const type = (mimeType || '').toLowerCase();
  if (type.startsWith('image/')) {
    return 'IMAGE';
  }
  if (type.startsWith('video/')) {
    return 'VIDEO';
  }
  if (type.startsWith('audio/')) {
    return 'AUDIO';
  }
  return 'FILE';
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const rounded = value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[exponent]}`;
};

export const getAttachmentSignature = (
  input: { originalName: string; mimeType: string; size: number },
  signal?: AbortSignal,
) =>
  apiData<AttachmentSignature>('/attachments/signature', { method: 'POST', body: input, signal });

type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  resource_type?: string;
  bytes?: number;
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
};

// XMLHttpRequest is used instead of fetch because only XHR exposes upload
// progress events, which power the composer's progress bar. XHR also allows
// the upload to be aborted mid-flight via an AbortSignal.
const uploadToCloudinary = (
  file: File,
  signature: AttachmentSignature,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<CloudinaryUploadResult> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Upload cancelled'));
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', signature.apiKey);
    form.append('timestamp', String(signature.timestamp));
    form.append('signature', signature.signature);
    form.append('folder', signature.folder);

    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`,
    );

    const onAbort = () => xhr.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      cleanup();
      let body: CloudinaryUploadResult & { error?: { message?: string } };
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error('Upload failed'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.secure_url) {
        onProgress?.(1);
        resolve(body);
      } else {
        reject(new Error(body?.error?.message ?? 'Upload failed'));
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error('Upload failed'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new Error('Upload cancelled'));
    };

    xhr.send(form);
  });

export const uploadAttachment = async (
  file: File,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<PendingAttachment> => {
  const mimeType = file.type || 'application/octet-stream';
  const signature = await getAttachmentSignature(
    {
      originalName: file.name,
      mimeType,
      size: file.size,
    },
    signal,
  );

  onProgress?.(0);
  const result = await uploadToCloudinary(file, signature, onProgress, signal);

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type ?? signature.resourceType,
    kind: kindForMime(mimeType),
    originalName: signature.originalName,
    mimeType,
    bytes: result.bytes ?? file.size,
    format: result.format ?? null,
    width: result.width ?? null,
    height: result.height ?? null,
    duration: result.duration ?? null,
  };
};

export const listChannelAttachments = (channelId: string) =>
  apiData<{ attachments: MessageAttachment[] }>(`/channels/${channelId}/attachments`);

export const listConversationAttachments = (conversationId: string) =>
  apiData<{ attachments: MessageAttachment[] }>(`/conversations/${conversationId}/attachments`);
