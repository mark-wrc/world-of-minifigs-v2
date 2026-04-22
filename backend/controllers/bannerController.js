import Banner from "../models/banner.model.js";
import {
  uploadSingleMedia,
  deleteSingleMedia,
} from "../services/imageService.js";
import { validateMedia } from "../utils/cloudinary.js";
import {
  normalizePagination,
  buildSearchQuery,
  paginateQuery,
  createPaginationResponse,
} from "../utils/pagination.js";
import { AUDIT_POPULATE } from "../utils/populateHelpers.js";

//------------------------------------------------ Helpers ------------------------------------------

const BANNER_VIDEO_MAX_SECONDS = 10;
const IMAGE_FOLDER = "world-of-minifigs-v2/banners";

const BANNER_VALID_PATHS = [
  "/products",
  "/collections",
  "/about",
  "/contact-us",
  "/designer",
  "/privacy-policy",
  "/terms-of-use",
  "/register",
  "/login",
];

const isBannerButtonLinkValid = (href) => {
  const isStatic = BANNER_VALID_PATHS.some((p) => href === p);
  const isDynamic =
    href.startsWith("/products/") || href.startsWith("/collections/");
  return isStatic || isDynamic;
};

const validateBannerButtons = (buttons) => {
  if (!buttons || !Array.isArray(buttons) || buttons.length === 0) {
    return {
      status: 400,
      message: "CTA buttons are required",
      description: "At least one CTA button must be provided.",
    };
  }
  if (buttons.length > 2) {
    return {
      status: 400,
      message: "Too many CTA buttons",
      description: "Maximum of 2 CTA buttons are allowed.",
    };
  }
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    if (!btn.label || !btn.label.trim()) {
      return {
        status: 400,
        message: `Button ${i + 1}: Label is required`,
        description: "Each CTA button must have a label.",
      };
    }
    if (!btn.href || !btn.href.trim()) {
      return {
        status: 400,
        message: `Button ${i + 1}: Link (href) is required`,
        description: "Each CTA button must have a link.",
      };
    }
    if (!isBannerButtonLinkValid(btn.href)) {
      return {
        status: 400,
        message: `Button ${i + 1}: Invalid link`,
        description:
          "Link must be a valid page (e.g., /products, /collections) or a specific item path.",
      };
    }
  }
  return null;
};

const normalizeBannerButtons = (buttons) =>
  buttons.map((b) => ({
    label: b.label.trim(),
    href: b.href.startsWith("/") ? b.href.trim() : `/${b.href.trim()}`,
    variant: b.variant || "default",
  }));

const validateBannerVideoDuration = async (uploadResult) => {
  if (
    uploadResult?.resourceType !== "video" ||
    typeof uploadResult?.duration !== "number"
  ) {
    return null;
  }
  if (uploadResult.duration <= BANNER_VIDEO_MAX_SECONDS) {
    return null;
  }
  // Delete the uploaded video that's too long
  deleteSingleMedia(uploadResult.publicId, uploadResult.resourceType);
  return {
    status: 400,
    message: "Video is too long",
    description: "Banner video must not exceed 10 seconds.",
  };
};

//------------------------------------------------ Create Banner ------------------------------------------
export const createBanner = async (req, res) => {
  try {
    const {
      badge,
      label,
      description,
      position,
      textTheme,
      media,
      enableButtons,
      buttons,
      isActive,
      order: orderFromBody,
    } = req.body;

    // Required fields
    if (!label || !label.trim()) {
      return res.status(400).json({
        success: false,
        message: "Banner label is required",
        description: "Please provide a banner label.",
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Banner description is required",
        description: "Please provide a banner description.",
      });
    }

    if (!media) {
      return res.status(400).json({
        success: false,
        message: "Banner media is required",
        description: "Please upload a banner image, gif, or video.",
      });
    }

    if (
      position &&
      !["center", "bottom-left", "bottom-right"].includes(position)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid banner position",
        description: "Position must be center, bottom-left, or bottom-right.",
      });
    }

    // Validate media
    const mediaValidation = validateMedia(media);

    if (!mediaValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid banner media",
        description: mediaValidation.error,
      });
    }

    // Validate buttons
    const finalEnableButtons =
      enableButtons !== undefined ? Boolean(enableButtons) : false;

    if (finalEnableButtons) {
      const buttonError = validateBannerButtons(buttons);
      if (buttonError) {
        return res.status(buttonError.status).json({
          success: false,
          message: buttonError.message,
          description: buttonError.description,
        });
      }
    }

    // Upload media via imageService
    let uploadedMedia = null;

    try {
      uploadedMedia = await uploadSingleMedia(media, IMAGE_FOLDER);

      const videoError = await validateBannerVideoDuration(uploadedMedia);
      if (videoError) {
        return res.status(videoError.status).json({
          success: false,
          message: videoError.message,
          description: videoError.description,
        });
      }
    } catch (error) {
      console.error("Banner media upload error:", error);

      return res.status(400).json({
        success: false,
        message: "Failed to upload banner media",
        description: error.message,
      });
    }

    // Resolve order: use provided value if valid, otherwise append at end
    const count = await Banner.countDocuments();
    const lastBanner = await Banner.findOne()
      .sort({ order: -1 })
      .select("order");
    const nextOrder = lastBanner && lastBanner.order ? lastBanner.order + 1 : 1;

    let finalOrder = nextOrder;
    if (
      orderFromBody !== undefined &&
      orderFromBody !== null &&
      orderFromBody !== ""
    ) {
      const parsed = parseInt(orderFromBody, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        finalOrder = Math.min(parsed, count + 1);
        // Shift existing banners to make room for the new one
        await Banner.updateMany(
          { order: { $gte: finalOrder } },
          { $inc: { order: 1 } },
        );
      }
    }

    const bannerData = {
      badge: badge?.trim() || undefined,
      label: label.trim(),
      description: description.trim(),
      position: position || "center",
      textTheme: textTheme || "light",
      media: {
        publicId: uploadedMedia.publicId,
        url: uploadedMedia.url,
        resourceType: uploadedMedia.resourceType,
        duration: uploadedMedia.duration,
      },
      enableButtons: finalEnableButtons,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      order: finalOrder,
      createdBy: req.user._id,
    };

    if (finalEnableButtons) {
      bannerData.buttons = normalizeBannerButtons(buttons);
    }

    const banner = await Banner.create(bannerData);

    return res.status(201).json({
      success: true,
      message: "Banner created successfully",
      banner: {
        id: banner._id,
        badge: banner.badge,
        label: banner.label,
        description: banner.description,
        position: banner.position,
        textTheme: banner.textTheme,
        media: banner.media,
        enableButtons: banner.enableButtons,
        buttons: banner.buttons,
        isActive: banner.isActive,
        order: banner.order,
        createdAt: banner.createdAt,
      },
    });
  } catch (error) {
    console.error("Create banner error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create banner",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get All Banners ------------------------------------------
export const getAllBanners = async (req, res) => {
  try {
    // Extract and normalize pagination parameters
    const { page, limit, search } = normalizePagination(req.query);

    // Build search query
    const searchFields = ["label", "badge", "description"];
    const searchQuery = buildSearchQuery(search, searchFields);

    // Apply pagination
    const result = await paginateQuery(Banner, searchQuery, {
      page,
      limit,
      sort: { order: 1 },
      populate: AUDIT_POPULATE,
    });

    return res.status(200).json(createPaginationResponse(result, "banners"));
  } catch (error) {
    console.error("Get all banners error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get Single Banner ------------------------------------------
export const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Banner ID is required",
        description: "Please provide a valid banner ID.",
      });
    }

    const banner = await Banner.findById(id)
      .populate("createdBy", "firstName lastName username")
      .populate("updatedBy", "firstName lastName username")
      .lean();

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
        description: "The requested banner does not exist.",
      });
    }

    return res.status(200).json({
      success: true,
      banner,
    });
  } catch (error) {
    console.error("Get banner by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch banner",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Update Banner ------------------------------------------
export const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      badge,
      label,
      description,
      position,
      textTheme,
      media, // base64 if new media is uploaded
      enableButtons,
      buttons,
      isActive,
      order,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Banner ID is required",
        description: "Please provide a valid banner ID.",
      });
    }

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
        description: "The requested banner does not exist.",
      });
    }

    if (label !== undefined && !label.trim()) {
      return res.status(400).json({
        success: false,
        message: "Banner label is required",
        description: "Please provide a banner label.",
      });
    }

    if (description !== undefined && !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Banner description is required",
        description: "Please provide a banner description.",
      });
    }

    if (
      position !== undefined &&
      !["center", "bottom-left", "bottom-right"].includes(position)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid banner position",
        description: "Position must be center, bottom-left, or bottom-right.",
      });
    }

    const finalEnableButtons =
      enableButtons !== undefined
        ? Boolean(enableButtons)
        : banner.enableButtons;

    if (finalEnableButtons) {
      const buttonError = validateBannerButtons(buttons);
      if (buttonError) {
        return res.status(buttonError.status).json({
          success: false,
          message: buttonError.message,
          description: buttonError.description,
        });
      }
    }

    // Replace media if new media is provided
    if (media) {
      const mediaValidation = validateMedia(media);

      if (!mediaValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid banner media",
          description: mediaValidation.error,
        });
      }

      let uploadResult = null;

      try {
        uploadResult = await uploadSingleMedia(media, IMAGE_FOLDER);

        const videoError = await validateBannerVideoDuration(uploadResult);
        if (videoError) {
          return res.status(videoError.status).json({
            success: false,
            message: videoError.message,
            description: videoError.description,
          });
        }
      } catch (error) {
        console.error("Banner media upload error:", error);

        return res.status(400).json({
          success: false,
          message: "Failed to upload banner media",
          description: error.message,
        });
      }

      // Delete old media in background (fire-and-forget)
      deleteSingleMedia(banner.media?.publicId, banner.media?.resourceType);

      banner.media = {
        publicId: uploadResult.publicId,
        url: uploadResult.url,
        resourceType: uploadResult.resourceType,
        duration: uploadResult.duration,
      };
    }

    if (badge !== undefined) banner.badge = badge?.trim() || undefined;
    if (label !== undefined) banner.label = label.trim();
    if (description !== undefined) banner.description = description.trim();
    if (position !== undefined) banner.position = position;
    if (textTheme !== undefined) banner.textTheme = textTheme;
    if (enableButtons !== undefined)
      banner.enableButtons = Boolean(enableButtons);
    if (isActive !== undefined) banner.isActive = Boolean(isActive);

    if (finalEnableButtons) {
      banner.buttons = normalizeBannerButtons(buttons);
    } else {
      banner.buttons = undefined;
    }

    // Handle Reordering Logic
    if (order !== undefined && order !== banner.order) {
      const oldOrder = banner.order;
      const newOrder = parseInt(order);

      if (isNaN(newOrder) || newOrder < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid order value",
          description: "Order must be a positive number.",
        });
      }

      // Get count to cap the new order
      const count = await Banner.countDocuments();
      const targetOrder = Math.min(newOrder, count);

      if (oldOrder < targetOrder) {
        // Move DOWN (old < new): decrement items in (old, targetOrder]
        await Banner.updateMany(
          { order: { $gt: oldOrder, $lte: targetOrder } },
          { $inc: { order: -1 } },
        );
      } else {
        // Move UP (old > new): increment items in [targetOrder, old)
        await Banner.updateMany(
          { order: { $gte: targetOrder, $lt: oldOrder } },
          { $inc: { order: 1 } },
        );
      }
      banner.order = targetOrder;
    }

    banner.updatedBy = req.user._id;

    await banner.save();

    return res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      banner: {
        id: banner._id,
        badge: banner.badge,
        label: banner.label,
        description: banner.description,
        position: banner.position,
        textTheme: banner.textTheme,
        media: banner.media,
        enableButtons: banner.enableButtons,
        buttons: banner.buttons,
        isActive: banner.isActive,
        order: banner.order,
        updatedAt: banner.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update banner error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update banner",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Delete Banner ------------------------------------------
export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Banner ID is required",
        description: "Please provide a valid banner ID.",
      });
    }

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
        description: "The requested banner does not exist.",
      });
    }

    // Delete media in background (fire-and-forget)
    deleteSingleMedia(banner.media?.publicId, banner.media?.resourceType);

    const deletedOrder = banner.order;

    await Banner.findByIdAndDelete(id);

    // Shift banners up to close the gap
    await Banner.updateMany(
      { order: { $gt: deletedOrder } },
      { $inc: { order: -1 } },
    );

    return res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    console.error("Delete banner error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete banner",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Public Banners ------------------------------------------
export const getPublicBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .sort({ order: 1 })
      .select("-__v -createdBy -updatedBy")
      .lean();

    return res.status(200).json({
      success: true,
      banners,
    });
  } catch (error) {
    console.error("Get public banners error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};
