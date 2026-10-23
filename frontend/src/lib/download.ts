// In-app download: fetches with credentials, reports progress, and saves the
// blob - so downloads never navigate away from the application.

export type DownloadProgress = (fraction: number) => void;

export const fetchFileBlob = async (url: string, onProgress?: DownloadProgress): Promise<Blob> => {
  const response = await fetch(url, { credentials: 'include' });

  if (!response.ok) {
    let message = 'Download failed';
    try {
      const body = await response.json();
      if (body?.message) {
        message = body.message;
      }
    } catch {
      // ignore parse errors; use the default message
    }
    throw new Error(message);
  }

  const total = Number(response.headers.get('content-length')) || 0;

  if (!response.body) {
    const blob = await response.blob();
    onProgress?.(1);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value);
      received += value.length;
      if (total > 0) {
        onProgress?.(Math.min(1, received / total));
      }
    }
  }

  onProgress?.(1);
  return new Blob(chunks as BlobPart[], {
    type: response.headers.get('content-type') || 'application/octet-stream',
  });
};

export const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
