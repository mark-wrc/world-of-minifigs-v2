import { API_BASE_URL } from "@/redux/apiConfig";

// Uploads files straight from the browser to Cloudinary.
//
// Flow: ask our (admin-only) API for a short-lived signature, then POST the raw
// file to Cloudinary directly. The file bytes never touch our own server, so
// large batches (e.g. dozens of torso images) can't blow the Node heap the way
// base64-in-JSON payloads did. We only send the resulting { publicId, url }
// references back to our API.

const SIGNATURE_ENDPOINT = `${API_BASE_URL}/api/v1/admin/uploads/signature`;

// Fetch a signed set of upload params for the given upload type.
const getUploadSignature = async (type) => {
  const res = await fetch(`${SIGNATURE_ENDPOINT}?type=${encodeURIComponent(type)}`, {
    method: "GET",
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.signature) {
    throw new Error(data?.description || "Could not prepare image upload.");
  }

  return data;
};

// Upload a single File to Cloudinary.
// `resourceType` is "image" for plain images, or "auto" for media that may be
// an image or a video (e.g. banners). Returns { publicId, url, resourceType,
// duration } — duration is only present for videos.
export const uploadImageToCloudinary = async (
  file,
  type,
  { resourceType = "image" } = {},
) => {
  const { signature, timestamp, folder, apiKey, cloudName } =
    await getUploadSignature(type);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", body: formData },
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.public_id) {
    throw new Error(data?.error?.message || "Upload failed.");
  }

  return {
    publicId: data.public_id,
    url: data.secure_url || data.url,
    resourceType: data.resource_type || "image",
    ...(data.resource_type === "video" && data.duration != null
      ? { duration: data.duration }
      : {}),
  };
};

// Convenience wrapper for banner-style media that may be an image or a video.
export const uploadMediaToCloudinary = (file, type) =>
  uploadImageToCloudinary(file, type, { resourceType: "auto" });

// Upload many files with bounded concurrency, preserving input order.
// onProgress(completedCount, total) fires after each file resolves.
export const uploadImagesToCloudinary = async (
  files,
  type,
  { concurrency = 5, onProgress, resourceType = "image" } = {},
) => {
  const results = new Array(files.length);
  let completed = 0;
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      results[index] = await uploadImageToCloudinary(files[index], type, {
        resourceType,
      });
      completed++;
      onProgress?.(completed, files.length);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, files.length) },
    worker,
  );

  await Promise.all(workers);

  return results;
};
