// ─── DOWNLOAD ───────────────────────────────────────────────────────────────────
// One Blob-download implementation shared by every export path (JSON backup,
// CSV export, and the image-share fallback) instead of each reimplementing
// the same createObjectURL/click/revokeObjectURL dance.
export function downloadBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Downloads `content` (a string) as a file with the given MIME type. */
export function downloadText(content, filename, mimeType) {
  return downloadBlob(new Blob([content], { type: mimeType }), filename);
}
