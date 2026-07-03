import {
  uploadImage,
  deleteImage,
  validateImage,
  uploadMedia,
  deleteMedia,
  validateMedia,
} from "../utils/cloudinary.js";

// ------------------------------- Constants -----------------------------------------

const BATCH_SIZE = 10;

// Standardize Cloudinary response
const formatImageResult = (result) => ({
  publicId: result.public_id,
  url: result.url,
});

// ------------------------------- Single Image Operations -----------------------------

// Upload a single base64 image (validate → upload → return { publicId, url })
export const uploadSingleImage = async (base64, folder) => {
  const validation = validateImage(base64);
  if (!validation.isValid) throw new Error(validation.error);

  const result = await uploadImage(base64, folder);
  return formatImageResult(result);
};

// Replace an existing image: upload new, delete old in background
export const replaceSingleImage = async (newImage, oldImage, folder) => {
  if (typeof newImage !== "string" || !newImage.startsWith("data:image/")) {
    return null;
  }

  const uploaded = await uploadSingleImage(newImage, folder);

  if (oldImage?.publicId) {
    deleteImage(oldImage.publicId).catch((err) =>
      console.error("Old image cleanup failed:", err),
    );
  }

  return uploaded;
};

// Delete a single image in background (fire-and-forget)
export const deleteSingleImage = (publicId) => {
  if (!publicId) return;
  deleteImage(publicId).catch((err) =>
    console.error("Image deletion failed:", err),
  );
};

// ------------------------------- Multiple Image Operations -----------------------------

// Upload an array of base64 images in parallel batches with auto-rollback on failure
export const uploadMultipleImages = async (base64Array, folder) => {
  const uploaded = [];

  try {
    for (let i = 0; i < base64Array.length; i += BATCH_SIZE) {
      const batch = base64Array.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((img) => uploadSingleImage(img, folder)),
      );
      uploaded.push(...results);
    }
  } catch (error) {
    deleteMultipleImages(uploaded.map((img) => img.publicId));
    throw error;
  }

  return uploaded;
};

// Process a mixed array of existing images (objects) and new images (base64 strings) for update
export const processImagesForUpdate = async (
  newImages,
  existingImages,
  folder,
) => {
  const kept = [];
  const toUpload = [];

  for (const img of newImages) {
    if (typeof img === "object" && img?.publicId) {
      kept.push(img);
    } else if (typeof img === "string" && img.startsWith("data:image/")) {
      toUpload.push(img);
    }
  }

  const uploaded =
    toUpload.length > 0 ? await uploadMultipleImages(toUpload, folder) : [];

  const finalImages = [...kept, ...uploaded];

  // Delete removed images in background
  const keptIds = new Set(finalImages.map((img) => img.publicId));
  const removedIds = (existingImages || [])
    .map((img) => img.publicId)
    .filter((id) => id && !keptIds.has(id));

  deleteMultipleImages(removedIds);

  return finalImages;
};

// Delete multiple images by publicId in parallel (fire-and-forget)
export const deleteMultipleImages = (publicIds) => {
  const ids = (publicIds || []).filter(Boolean);
  if (ids.length === 0) return;

  Promise.all(
    ids.map((id) =>
      deleteImage(id).catch((err) =>
        console.error(`Delete image ${id} failed:`, err),
      ),
    ),
  ).catch((err) => console.error("Batch delete failed:", err));
};

// ------------------------------- Items with Images -----------------------------

// Upload images for an array of items in parallel batches (e.g., torso designs, addon items)
export const processItemsForCreate = async (
  items,
  folder,
  { getImage, transform },
) => {
  const processed = [];

  try {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (item) => {
          const base64 = getImage(item);
          const uploaded = await uploadSingleImage(base64, folder);
          return transform(item, uploaded);
        }),
      );
      processed.push(...results);
    }
  } catch (error) {
    deleteMultipleImages(
      processed.map((item) => item.image?.publicId).filter(Boolean),
    );
    throw error;
  }

  return processed;
};

// Process items for update: keep existing, upload new, delete removed
export const processItemsForUpdate = async (
  newItems,
  existingItems,
  folder,
  { isExisting, getImage, transform },
) => {
  const kept = [];
  const toUpload = [];

  for (const item of newItems) {
    if (isExisting(item)) {
      kept.push(item);
    } else {
      toUpload.push(item);
    }
  }

  // Upload new items in parallel batches
  const uploaded = [];
  if (toUpload.length > 0) {
    try {
      for (let i = 0; i < toUpload.length; i += BATCH_SIZE) {
        const batch = toUpload.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (item) => {
            const base64 = getImage(item);
            if (!base64) return null;
            const uploadedImage = await uploadSingleImage(base64, folder);
            return transform(item, uploadedImage);
          }),
        );
        uploaded.push(...results.filter(Boolean));
      }
    } catch (error) {
      deleteMultipleImages(
        uploaded.map((item) => item.image?.publicId).filter(Boolean),
      );
      throw error;
    }
  }

  const processed = [...kept, ...uploaded];

  // Delete removed images in background
  const newPublicIds = new Set(
    processed.map((item) => item.image?.publicId).filter(Boolean),
  );
  const removedIds = (existingItems || [])
    .map((item) => item.image?.publicId)
    .filter((id) => id && !newPublicIds.has(id));

  deleteMultipleImages(removedIds);

  return processed;
};

// Delete all images from an array of items (fire-and-forget, for entity deletion)
export const cleanupItemImages = (items) => {
  if (!items?.length) return;
  const publicIds = items.map((item) => item.image?.publicId).filter(Boolean);
  deleteMultipleImages(publicIds);
};

// ------------------------------- Media Operations -----------------------------

// Upload a single media file (image, gif, or video)
export const uploadSingleMedia = async (base64, folder) => {
  const validation = validateMedia(base64);
  if (!validation.isValid) throw new Error(validation.error);

  const result = await uploadMedia(base64, folder);
  return {
    publicId: result.publicId,
    url: result.url,
    resourceType: result.resourceType,
    duration: result.duration,
  };
};

// Replace existing media: upload new, delete old in background
export const replaceSingleMedia = async (newMedia, oldMedia, folder) => {
  const isBase64 =
    typeof newMedia === "string" &&
    (newMedia.startsWith("data:image/") || newMedia.startsWith("data:video/"));

  if (!isBase64) return null;

  const uploaded = await uploadSingleMedia(newMedia, folder);

  if (oldMedia?.publicId) {
    deleteMedia(oldMedia.publicId, oldMedia.resourceType || "image").catch(
      (err) => console.error("Old media cleanup failed:", err),
    );
  }

  return uploaded;
};

// Delete a single media item in background (fire-and-forget)
export const deleteSingleMedia = (publicId, resourceType = "image") => {
  if (!publicId) return;
  deleteMedia(publicId, resourceType).catch((err) =>
    console.error("Media deletion failed:", err),
  );
};

// ------------------------------- Direct-upload (reference) helpers -----------------------------
//
// Images/media now upload directly from the browser to Cloudinary, so the
// server receives only { publicId, url } references (plus resourceType/duration
// for media) — never raw image bytes. These helpers validate those references
// and clean up any Cloudinary assets that were dropped, replacing the old
// base64-through-the-server upload paths. This is what keeps request bodies
// tiny and makes the JSON-parse OOM impossible regardless of image count.

const isImageRef = (val) =>
  val && typeof val === "object" && !!val.publicId && !!val.url;

// Validate + normalize a single required image reference.
export const normalizeImageRef = (ref) => {
  if (!isImageRef(ref)) {
    throw new Error("A valid uploaded image (publicId and url) is required.");
  }
  return { publicId: ref.publicId, url: ref.url };
};

// Normalize an array of image references (e.g. product galleries).
// Non-reference entries are dropped.
export const normalizeImageRefs = (refs) =>
  (Array.isArray(refs) ? refs : [])
    .filter(isImageRef)
    .map((ref) => ({ publicId: ref.publicId, url: ref.url }));

// Validate + normalize a single media reference (image or video),
// preserving resourceType and (for video) duration.
export const normalizeMediaRef = (ref) => {
  if (!isImageRef(ref)) {
    throw new Error("A valid uploaded media file (publicId and url) is required.");
  }
  const resourceType = ref.resourceType === "video" ? "video" : "image";
  const normalized = { publicId: ref.publicId, url: ref.url, resourceType };
  if (resourceType === "video" && ref.duration != null) {
    normalized.duration = Number(ref.duration);
  }
  return normalized;
};

// Given the new set of image references and the previously-stored ones,
// delete (in background) any Cloudinary images that were dropped.
export const cleanupRemovedImages = (newRefs, existingRefs) => {
  const kept = new Set(
    (newRefs || []).map((ref) => ref?.publicId).filter(Boolean),
  );
  const removed = (existingRefs || [])
    .map((ref) => ref?.publicId)
    .filter((id) => id && !kept.has(id));
  deleteMultipleImages(removed);
};

// ------------------------------- Rollback Helper -----------------------------

// Rollback multiple upload results after a failure
export const rollbackUploads = (...imageArrays) => {
  const allPublicIds = imageArrays
    .flat()
    .map((img) => img?.publicId || img?.image?.publicId)
    .filter(Boolean);
  deleteMultipleImages(allPublicIds);
};
