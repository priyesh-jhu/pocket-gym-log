// ─── IMAGE SHARE ────────────────────────────────────────────────────────────────
// Isolates the two browser APIs this feature depends on (html-to-image's DOM
// snapshotting, and the Web Share API) behind one function, so the calling
// component only deals with a plain result object.
import { toBlob } from "html-to-image";
import { downloadBlob } from "./download.js";

/**
 * Renders `element` to a PNG and shares or downloads it.
 * Tries navigator.share with a file attachment first (opens the native share
 * sheet); falls back to a plain download when file sharing isn't supported.
 * A user cancelling the share sheet (AbortError) is reported as ok, not an
 * error — they made a choice, nothing went wrong.
 */
export async function shareElementAsImage(element, filename) {
  let blob;
  try {
    blob = await toBlob(element, { pixelRatio: 2 });
  } catch (error) {
    return { ok: false, error };
  }
  if (!blob) return { ok: false, error: new Error("Could not render the image.") };

  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return { ok: true, method: "share" };
    } catch (error) {
      if (error?.name === "AbortError") return { ok: true, method: "share", cancelled: true };
      return { ok: false, error };
    }
  }

  return downloadBlob(blob, filename)
    ? { ok: true, method: "download" }
    : { ok: false, error: new Error("Download failed.") };
}
