function parseFilenameFromContentDisposition(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const quotedMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const plainMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();

  return null;
}

export type DownloadProgress = {
  receivedBytes: number;
  totalBytes: number | null;
  percent: number | null;
};

function buildProgress(receivedBytes: number, totalBytes: number | null): DownloadProgress {
  if (!totalBytes || totalBytes <= 0) {
    return { receivedBytes, totalBytes: null, percent: null };
  }

  return {
    receivedBytes,
    totalBytes,
    percent: Math.max(0, Math.min(100, Math.round((receivedBytes / totalBytes) * 100))),
  };
}

export async function downloadBlobResponse(
  response: Response,
  fallbackFilename: string,
  options?: {
    onProgress?: (progress: DownloadProgress) => void;
  },
): Promise<string> {
  const resolvedFilename =
    parseFilenameFromContentDisposition(response.headers.get("content-disposition")) ||
    fallbackFilename;
  const totalBytesHeader = response.headers.get("content-length");
  const parsedTotalBytes = totalBytesHeader ? Number.parseInt(totalBytesHeader, 10) : Number.NaN;
  const totalBytes = Number.isFinite(parsedTotalBytes) ? parsedTotalBytes : null;

  let blob: Blob;
  const reader = response.body?.getReader();

  if (!reader) {
    options?.onProgress?.(buildProgress(0, totalBytes));
    blob = await response.blob();
    options?.onProgress?.(buildProgress(blob.size, totalBytes ?? blob.size));
  } else {
    const chunks: BlobPart[] = [];
    let receivedBytes = 0;

    options?.onProgress?.(buildProgress(0, totalBytes));

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      chunks.push(value);
      receivedBytes += value.byteLength;
      options?.onProgress?.(buildProgress(receivedBytes, totalBytes));
    }

    blob = new Blob(chunks, {
      type: response.headers.get("content-type") ?? "application/octet-stream",
    });
    options?.onProgress?.(buildProgress(blob.size, totalBytes ?? blob.size));
  }

  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = resolvedFilename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Delay cleanup so large files are not revoked before the browser starts the download.
  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60_000);

  return resolvedFilename;
}
