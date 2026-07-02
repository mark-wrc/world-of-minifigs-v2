// Cloudinary delivery-URL helpers.
//
// Images are uploaded to Cloudinary and stored as raw `secure_url`s that point
// at the full-resolution original, e.g.
//   https://res.cloudinary.com/<cloud>/image/upload/v123/folder/name.png
//
// Cloudinary can resize / re-encode on the fly when a transformation segment is
// inserted right after `/image/upload/`. Requesting the size we actually need
// (a 128px thumbnail instead of a 1000px original) is the difference between a
// few KB and several MB per image — critical when a single order renders 50+
// of them in the modal and again in the exported PDF.

const UPLOAD_MARKER = "/image/upload/";

// True for URLs we know how to transform. Anything else is passed through
// untouched so non-Cloudinary sources (or already-processed URLs) still work.
const isCloudinaryUrl = (url) =>
  typeof url === "string" && url.includes(UPLOAD_MARKER);

// A transformation is already present when the segment after `/upload/` isn't a
// version (`v123…`) or the asset path — e.g. it contains transform params.
// We only skip when it clearly starts with known transform keys to avoid
// double-transforming.
const hasTransform = (afterUpload) =>
  /^[a-z]{1,3}_[^/]+/.test(afterUpload) && !/^v\d+\//.test(afterUpload);

/**
 * Build a resized / re-encoded Cloudinary delivery URL.
 *
 * @param {string} url  Original Cloudinary secure_url (or any string).
 * @param {object} opts
 * @param {number} [opts.width]    Max width in px.
 * @param {number} [opts.height]   Max height in px.
 * @param {string} [opts.crop="limit"]  Cloudinary crop mode. "limit" scales
 *                                 down to fit without upscaling or padding.
 * @param {string} [opts.format="auto"] "auto" lets Cloudinary serve WebP/AVIF to
 *                                 browsers; force "png"/"jpg" when the consumer
 *                                 (e.g. jsPDF) can't decode modern formats.
 * @param {string} [opts.quality="auto"] Cloudinary quality. "auto" is ideal for
 *                                 on-screen; the caller can override.
 * @returns {string} Transformed URL, or the original when it can't be handled.
 */
export const buildCloudinaryUrl = (
  url,
  { width, height, crop = "limit", format = "auto", quality = "auto" } = {},
) => {
  if (!isCloudinaryUrl(url)) return url;

  const [base, afterUpload] = url.split(UPLOAD_MARKER);
  if (!afterUpload || hasTransform(afterUpload)) return url;

  const parts = [`c_${crop}`];
  if (width) parts.push(`w_${Math.round(width)}`);
  if (height) parts.push(`h_${Math.round(height)}`);
  parts.push(`f_${format}`, `q_${quality}`);

  return `${base}${UPLOAD_MARKER}${parts.join(",")}/${afterUpload}`;
};
