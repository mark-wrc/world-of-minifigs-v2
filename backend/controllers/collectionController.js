import Collection from "../models/collection.model.js";
import SubCollection from "../models/subCollection.model.js";
import {
  normalizeImageRef,
  deleteSingleImage,
} from "../services/imageService.js";
import {
  normalizePagination,
  buildSearchQuery,
  paginateQuery,
  createPaginationResponse,
} from "../utils/pagination.js";
import { onCollectionToggle } from "../utils/Products/visibilityUtils.js";
import { checkNameConflict } from "../utils/commonUtils.js";
import { AUDIT_POPULATE } from "../utils/populateHelpers.js";

const FEATURED_COLLECTION_LIMIT = 2;
// Collection images upload browser→Cloudinary directly; folder (collection) is
// owned by uploadController.js.

//------------------------------------------------ Create Collection ------------------------------------------
export const createCollection = async (req, res) => {
  try {
    const { collectionName, description, isFeatured, image } = req.body;

    // Validate required fields
    if (!collectionName) {
      return res.status(400).json({
        success: false,
        message: "Collection name is required",
        description: "Please provide a collection name.",
      });
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Collection image is required",
        description: "Please upload an image for the collection.",
      });
    }

    // Normalize collection name
    const collectionNameStr = String(collectionName).trim();

    if (!collectionNameStr) {
      return res.status(400).json({
        success: false,
        message: "Collection name cannot be empty",
        description: "Please provide a valid collection name.",
      });
    }

    // Check if collection with same name already exists
    const existingCollection = await checkNameConflict(
      Collection,
      "collectionName",
      collectionNameStr,
    );

    if (existingCollection) {
      return res.status(409).json({
        success: false,
        message: "Collection already exists",
        description: "A collection with this name already exists.",
      });
    }

    // Check featured collection limit if isFeatured is true
    if (isFeatured) {
      const featuredCount = await Collection.countDocuments({
        isFeatured: true,
      });

      if (featuredCount >= FEATURED_COLLECTION_LIMIT) {
        return res.status(400).json({
          success: false,
          message: "Featured collection limit reached",
          description: `You can only have ${FEATURED_COLLECTION_LIMIT} featured collections. Please unfeature another collection first.`,
        });
      }
    }

    // Image uploaded directly to Cloudinary by the browser; store its ref.
    let uploadedImage;
    try {
      uploadedImage = normalizeImageRef(image);
    } catch (error) {
      console.error("Image reference error:", error);
      return res.status(400).json({
        success: false,
        message: "Failed to save image",
        description: error.message,
      });
    }

    // Normalize description if provided
    const descriptionStr = description ? String(description).trim() : "";

    // Create collection
    const collection = await Collection.create({
      collectionName: collectionNameStr,
      description: descriptionStr,
      image: uploadedImage,
      isFeatured: isFeatured || false,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Collection created successfully",
      collection: {
        id: collection._id,
        collectionName: collection.collectionName,
        description: collection.description,
        image: collection.image,
        isFeatured: collection.isFeatured,
        createdAt: collection.createdAt,
      },
    });
  } catch (error) {
    console.error("Create collection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create collection",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get All Collections ------------------------------------------
export const getAllCollections = async (req, res) => {
  try {
    // Extract and normalize pagination parameters
    const { page, limit, search } = normalizePagination(req.query);

    // Build search query
    const searchFields = ["collectionName", "description"];
    const searchQuery = buildSearchQuery(search, searchFields);

    // Apply pagination
    const result = await paginateQuery(Collection, searchQuery, {
      page,
      limit,
      sort: { isFeatured: -1, createdAt: -1 }, // Featured first, then by date
      populate: AUDIT_POPULATE,
    });

    return res
      .status(200)
      .json(createPaginationResponse(result, "collections"));
  } catch (error) {
    console.error("Get all collections error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch collections",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get Single Collection ------------------------------------------
export const getCollectionById = async (req, res) => {
  try {
    const { id } = req.params;

    const collection = await Collection.findById(id)
      .select("-__v")
      .populate("createdBy", "firstName lastName username")
      .populate("updatedBy", "firstName lastName username")
      .lean();

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
        description: "The requested collection does not exist.",
      });
    }

    return res.status(200).json({
      success: true,
      collection,
    });
  } catch (error) {
    console.error("Get collection by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch collection",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Update Collection ------------------------------------------
export const updateCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { collectionName, description, isFeatured, image } = req.body;

    const collection = await Collection.findById(id);

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
        description: "The requested collection does not exist.",
      });
    }

    // Update collection name if provided
    if (collectionName !== undefined) {
      const collectionNameStr = String(collectionName).trim();

      if (!collectionNameStr) {
        return res.status(400).json({
          success: false,
          message: "Collection name cannot be empty",
          description: "Please provide a valid collection name.",
        });
      }

      // Check if another collection with same name exists
      const existingCollection = await checkNameConflict(
        Collection,
        "collectionName",
        collectionNameStr,
        id,
      );

      if (existingCollection) {
        return res.status(409).json({
          success: false,
          message: "Collection name already exists",
          description: "Another collection with this name already exists.",
        });
      }

      collection.collectionName = collectionNameStr;
    }

    // Update description if provided
    if (description !== undefined) {
      collection.description = description ? String(description).trim() : "";
    }

    // Check featured collection limit if changing to featured
    if (isFeatured !== undefined && isFeatured && !collection.isFeatured) {
      const featuredCount = await Collection.countDocuments({
        isFeatured: true,
        _id: { $ne: id },
      });

      if (featuredCount >= FEATURED_COLLECTION_LIMIT) {
        return res.status(400).json({
          success: false,
          message: "Featured collection limit reached",
          description: `You can only have ${FEATURED_COLLECTION_LIMIT} featured collections. Please unfeature another collection first.`,
        });
      }

      collection.isFeatured = true;
    } else if (isFeatured !== undefined) {
      collection.isFeatured = isFeatured;
    }

    // Replace image if a new one was uploaded (ref differs from the current).
    if (image) {
      try {
        const newImage = normalizeImageRef(image);
        const oldPublicId = collection.image?.publicId;
        if (newImage.publicId !== oldPublicId) {
          collection.image = newImage;
          if (oldPublicId) deleteSingleImage(oldPublicId);
        }
      } catch (error) {
        console.error("Image update error:", error);
        return res.status(400).json({
          success: false,
          message: "Failed to update image",
          description: error.message,
        });
      }
    }

    // Update isActive if provided
    const isActiveChanged =
      req.body.isActive !== undefined &&
      Boolean(req.body.isActive) !== collection.isActive;
    if (req.body.isActive !== undefined) {
      collection.isActive = Boolean(req.body.isActive);
    }

    // Update updatedBy
    collection.updatedBy = req.user._id;

    await collection.save();

    // Cascade visibility recalculation when isActive changes
    if (isActiveChanged) {
      await onCollectionToggle(collection._id);
    }

    return res.status(200).json({
      success: true,
      message: "Collection updated successfully",
      collection: {
        id: collection._id,
        collectionName: collection.collectionName,
        description: collection.description,
        image: collection.image,
        isFeatured: collection.isFeatured,
        isActive: collection.isActive,
        updatedAt: collection.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update collection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update collection",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Delete Collection ------------------------------------------
export const deleteCollection = async (req, res) => {
  try {
    const { id } = req.params;

    const collection = await Collection.findById(id).lean();

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
        description: "The requested collection does not exist.",
      });
    }

    // Check if there are any sub-collections related to this collection
    const subCollectionCount = await SubCollection.countDocuments({
      collectionId: id,
    });

    if (subCollectionCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete collection",
        description: `This collection has ${subCollectionCount} related sub-collection${
          subCollectionCount > 1 ? "s" : ""
        }. Please delete or reassign them first.`,
      });
    }

    await Collection.findByIdAndDelete(id);

    // Delete image in background (fire-and-forget)
    deleteSingleImage(collection.image?.publicId);

    return res.status(200).json({
      success: true,
      message: "Collection deleted successfully",
    });
  } catch (error) {
    console.error("Delete collection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete collection",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};
