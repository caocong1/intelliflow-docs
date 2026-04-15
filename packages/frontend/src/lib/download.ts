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

export async function downloadBlobResponse(
  response: Response,
  fallbackFilename: string,
): Promise<string> {
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const resolvedFilename =
    parseFilenameFromContentDisposition(response.headers.get("content-disposition")) ||
    fallbackFilename;

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
