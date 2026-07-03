import { generateUploadSignature } from "../utils/cloudinary.js";
import { handleError } from "../utils/commonUtils.js";

// Whitelist of upload targets. The client asks for a `type`, never a raw
// folder path, so signed uploads can only ever land in these known locations.
const UPLOAD_FOLDERS = {
  torso: "world-of-minifigs-v2/dealers/torsos",
  "general-inventory": "world-of-minifigs-v2/general-inventory",
  product: "world-of-minifigs-v2/products",
  "product-variant": "world-of-minifigs-v2/products/variants",
  banner: "world-of-minifigs-v2/banners",
  collection: "world-of-minifigs-v2/collections",
  "sub-collection": "world-of-minifigs-v2/sub-collections",
  "dealer-addon": "world-of-minifigs-v2/dealers/add-ons",
  "dealer-addon-preview": "world-of-minifigs-v2/dealers/add-ons/previews",
};

// Issue a short-lived signature the browser uses to upload a single file
// directly to Cloudinary. Admin-only (mounted behind the admin auth guard).
export const getUploadSignature = async (req, res) => {
  try {
    const type = req.query.type;
    const folder = UPLOAD_FOLDERS[type];

    if (!folder) {
      return res.status(400).json({
        success: false,
        message: "Invalid upload type",
        description: "Unknown upload target requested.",
      });
    }

    const credentials = generateUploadSignature(folder);

    return res.status(200).json({
      success: true,
      ...credentials,
    });
  } catch (error) {
    handleError(
      res,
      error,
      "Get upload signature",
      "Failed to prepare image upload",
    );
  }
};
