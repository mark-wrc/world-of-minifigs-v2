import { v2 as cloudinary } from "cloudinary";

// Validate Cloudinary configuration
const validateCloudinaryConfig = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("CLOUDINARY_CLOUD_NAME is not configured");
  }
  if (!process.env.CLOUDINARY_API_KEY) {
    throw new Error("CLOUDINARY_API_KEY is not configured");
  }
  if (!process.env.CLOUDINARY_API_SECRET) {
    throw new Error("CLOUDINARY_API_SECRET is not configured");
  }
};

// Configure Cloudinary (cached — only runs once)
let isConfigured = false;

const configureCloudinary = () => {
  if (isConfigured) return;
  validateCloudinaryConfig();

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  isConfigured = true;
};

// Validate image format and size
export const validateImage = (image, maxSizeMB = 25) => {
  if (!image) {
    return {
      isValid: false,
      error: "No image provided",
    };
  }

  // Validate image format
  if (!image.startsWith("data:image/")) {
    return {
      isValid: false,
      error: "Invalid image format. Please upload a valid image file.",
    };
  }

  // Check base64 image size (approximate size in bytes)
  const base64Data = image.split(",")[1] || image;
  const sizeInBytes = (base64Data.length * 3) / 4;
  const sizeInMB = sizeInBytes / (1024 * 1024);

  if (sizeInMB > maxSizeMB) {
    return {
      isValid: false,
      error: `Image size too large. Please upload an image smaller than ${maxSizeMB}MB.`,
    };
  }

  return {
    isValid: true,
    sizeInMB: sizeInMB.toFixed(2),
  };
};

// Standard image upload function (products, etc.)
export const uploadImage = (file, folder) => {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("No file provided for upload"));
    }

    cloudinary.uploader.upload(
      file,
      {
        resource_type: "image",
        folder: folder,
        quality: "auto",
        fetch_format: "auto",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error details:", error);
          reject(error);
        } else {
          resolve({
            public_id: result.public_id,
            url: result.url,
          });
        }
      },
    );
  });
};

// Standard function to delete an image
export const deleteImage = async (publicId) => {
  configureCloudinary();

  try {
    const res = await cloudinary.uploader.destroy(publicId);
    return res.result === "ok";
  } catch (error) {
    throw new Error(`Failed to delete the image: ${error.message}`);
  }
};

// Validate media (image, gif, video)
export const validateMedia = (file, maxImageMB = 25, maxVideoMB = 100) => {
  if (!file) {
    return {
      isValid: false,
      error: "No media provided",
    };
  }

  const isImage = file.startsWith("data:image/");
  const isVideo = file.startsWith("data:video/");

  if (!isImage && !isVideo) {
    return {
      isValid: false,
      error:
        "Invalid media format. Only image, GIF, or video files are allowed.",
    };
  }

  const base64Data = file.split(",")[1] || file;
  const sizeInBytes = (base64Data.length * 3) / 4;
  const sizeInMB = sizeInBytes / (1024 * 1024);

  const maxSize = isVideo ? maxVideoMB : maxImageMB;

  if (sizeInMB > maxSize) {
    return {
      isValid: false,
      error: `File is too large. Maximum size is ${maxSize}MB.`,
    };
  }

  return {
    isValid: true,
    mediaType: isVideo ? "video" : "image",
    sizeInMB: sizeInMB.toFixed(2),
  };
};

// Upload media (image / gif / video)
export const uploadMedia = (file, folder) => {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("No file provided for upload"));
    }

    const isVideo = file.startsWith("data:video/");

    cloudinary.uploader.upload(
      file,
      {
        resource_type: isVideo ? "video" : "image",
        folder: folder,
        quality: "auto",
        fetch_format: "auto",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error details:", error);
          return reject(error);
        }

        resolve({
          publicId: result.public_id,
          url: result.secure_url || result.url,
          resourceType: result.resource_type, // "image" | "video"
          duration:
            result.resource_type === "video" ? result.duration : undefined,
        });
      },
    );
  });
};

// Delete banner media (image or video)
export const deleteMedia = async (publicId, resourceType = "image") => {
  configureCloudinary();

  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return res.result === "ok";
  } catch (error) {
    throw new Error(`Failed to delete media: ${error.message}`);
  }
};

// NOTE: cleanUpImages has been removed.
// Use cleanupItemImages from services/imageService.js instead.
