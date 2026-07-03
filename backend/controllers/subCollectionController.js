import SubCollection from "../models/subCollection.model.js";
import Collection from "../models/collection.model.js";
import DealerExtraBag from "../models/dealerExtraBag.model.js";
import Product from "../models/product.model.js";
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
import { onSubCollectionToggle } from "../utils/Products/visibilityUtils.js";
import { checkNameConflict } from "../utils/commonUtils.js";
import { AUDIT_POPULATE } from "../utils/populateHelpers.js";

// Sub-collection images upload browser→Cloudinary directly; folder
// (sub-collection) is owned by uploadController.js.

//------------------------------------------------ Create Sub-collection ------------------------------------------
export const createSubCollection = async (req, res) => {
  try {
    const { subCollectionName, description, collection, image } = req.body;

    // Validate required fields
    if (!subCollectionName) {
      return res.status(400).json({
        success: false,
        message: "Sub-collection name is required",
        description: "Please provide a sub-collection name.",
      });
    }

    if (!collection) {
      return res.status(400).json({
        success: false,
        message: "Collection is required",
        description: "Please select a collection.",
      });
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Sub-collection image is required",
        description: "Please upload an image for the sub-collection.",
      });
    }

    // Normalize sub-collection name
    const subCollectionNameStr = String(subCollectionName).trim();

    if (!subCollectionNameStr) {
      return res.status(400).json({
        success: false,
        message: "Sub-collection name cannot be empty",
        description: "Please provide a valid sub-collection name.",
      });
    }

    // Verify collection exists
    const collectionExists = await Collection.findById(collection).lean();
    if (!collectionExists) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
        description: "The selected collection does not exist.",
      });
    }

    // Check if subcollection with same name already exists in this collection
    const existingSubCollection = await checkNameConflict(
      SubCollection,
      "subCollectionName",
      subCollectionNameStr,
      null,
      { collectionId: collection },
    );

    if (existingSubCollection) {
      return res.status(409).json({
        success: false,
        message: "Sub-collection already exists",
        description:
          "A sub-collection with this name already exists in the selected collection.",
      });
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

    // Create sub-collection
    const subCollection = await SubCollection.create({
      subCollectionName: subCollectionNameStr,
      description: descriptionStr,
      collectionId: collection,
      image: uploadedImage,
      createdBy: req.user._id,
    });

    // Populate collection details
    await subCollection.populate("collectionId", "collectionName");

    return res.status(201).json({
      success: true,
      message: "Sub-collection created successfully",
      subCollection: {
        id: subCollection._id,
        subCollectionName: subCollection.subCollectionName,
        description: subCollection.description,
        collection: subCollection.collectionId,
        image: subCollection.image,
        createdAt: subCollection.createdAt,
      },
    });
  } catch (error) {
    console.error("Create sub-collection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create sub-collection",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get All Sub-collections ------------------------------------------
export const getAllSubCollections = async (req, res) => {
  try {
    // Extract and normalize pagination parameters
    const { page, limit, search } = normalizePagination(req.query);

    // Build search query
    let searchQuery = {};
    if (search) {
      // Search in subCollection fields
      const subCollectionSearchFields = ["subCollectionName", "description"];
      const subCollectionQuery = buildSearchQuery(
        search,
        subCollectionSearchFields,
      );

      // Search in collection names
      const collectionSearchQuery = buildSearchQuery(search, [
        "collectionName",
      ]);
      const matchingCollections = await Collection.find(collectionSearchQuery)
        .select("_id")
        .lean();

      const matchingCollectionIds = matchingCollections.map((col) => col._id);

      // Combine both searches using $or
      if (
        Object.keys(subCollectionQuery).length > 0 &&
        matchingCollectionIds.length > 0
      ) {
        searchQuery = {
          $or: [
            subCollectionQuery,
            { collectionId: { $in: matchingCollectionIds } },
          ],
        };
      } else if (Object.keys(subCollectionQuery).length > 0) {
        searchQuery = subCollectionQuery;
      } else if (matchingCollectionIds.length > 0) {
        searchQuery = { collectionId: { $in: matchingCollectionIds } };
      }
    }

    // Apply pagination
    const result = await paginateQuery(SubCollection, searchQuery, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: [
        { path: "collectionId", select: "collectionName" },
        ...AUDIT_POPULATE,
      ],
    });

    return res
      .status(200)
      .json(createPaginationResponse(result, "subCollections"));
  } catch (error) {
    console.error("Get all sub-collections error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sub-collections",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get Single Sub-collection ------------------------------------------
export const getSubCollectionById = async (req, res) => {
  try {
    const { id } = req.params;

    const subCollection = await SubCollection.findById(id)
      .select("-__v")
      .populate("collectionId", "collectionName")
      .populate("createdBy", "firstName lastName username")
      .populate("updatedBy", "firstName lastName username")
      .lean();

    if (!subCollection) {
      return res.status(404).json({
        success: false,
        message: "Sub-collection not found",
        description: "The requested sub-collection does not exist.",
      });
    }

    return res.status(200).json({
      success: true,
      subCollection,
    });
  } catch (error) {
    console.error("Get sub-collection by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sub-collection",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Update Sub-collection ------------------------------------------
export const updateSubCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { subCollectionName, description, collection, image } = req.body;

    const subCollection = await SubCollection.findById(id);

    if (!subCollection) {
      return res.status(404).json({
        success: false,
        message: "Sub-collection not found",
        description: "The requested sub-collection does not exist.",
      });
    }

    // Update sub-collection name if provided
    if (subCollectionName !== undefined) {
      const subCollectionNameStr = String(subCollectionName).trim();

      if (!subCollectionNameStr) {
        return res.status(400).json({
          success: false,
          message: "Sub-collection name cannot be empty",
          description: "Please provide a valid sub-collection name.",
        });
      }

      // Determine which collection to check against
      const collectionToCheck =
        collection !== undefined ? collection : subCollection.collectionId;

      // Check if another subcollection with same name exists in the same collection
      const existingSubCollection = await checkNameConflict(
        SubCollection,
        "subCollectionName",
        subCollectionNameStr,
        id,
        { collectionId: collectionToCheck },
      );

      if (existingSubCollection) {
        return res.status(409).json({
          success: false,
          message: "Sub-collection name already exists",
          description:
            "Another sub-collection with this name already exists in this collection.",
        });
      }

      subCollection.subCollectionName = subCollectionNameStr;
    }

    // Update description if provided
    if (description !== undefined) {
      subCollection.description = description ? String(description).trim() : "";
    }

    // Update collection if provided
    if (collection !== undefined) {
      // Verify new collection exists
      const collectionExists = await Collection.findById(collection).lean();
      if (!collectionExists) {
        return res.status(404).json({
          success: false,
          message: "Collection not found",
          description: "The selected collection does not exist.",
        });
      }

      subCollection.collectionId = collection;
    }

    // Replace image if a new one was uploaded (ref differs from the current).
    if (image) {
      try {
        const newImage = normalizeImageRef(image);
        const oldPublicId = subCollection.image?.publicId;
        if (newImage.publicId !== oldPublicId) {
          subCollection.image = newImage;
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
      Boolean(req.body.isActive) !== subCollection.isActive;
    if (req.body.isActive !== undefined) {
      subCollection.isActive = Boolean(req.body.isActive);
    }

    // Update updatedBy
    subCollection.updatedBy = req.user._id;

    await subCollection.save();

    // Cascade visibility recalculation when isActive changes
    if (isActiveChanged) {
      await onSubCollectionToggle(subCollection._id);
    }

    // Populate collection details
    await subCollection.populate("collectionId", "collectionName");

    return res.status(200).json({
      success: true,
      message: "Sub-collection updated successfully",
      subCollection: {
        id: subCollection._id,
        subCollectionName: subCollection.subCollectionName,
        description: subCollection.description,
        collection: subCollection.collectionId,
        image: subCollection.image,
        isActive: subCollection.isActive,
        updatedAt: subCollection.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update sub-collection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sub-collection",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Delete Sub-collection ------------------------------------------
export const deleteSubCollection = async (req, res) => {
  try {
    const { id } = req.params;

    const subCollection = await SubCollection.findById(id).lean();

    if (!subCollection) {
      return res.status(404).json({
        success: false,
        message: "Sub-collection not found",
        description: "The requested sub-collection does not exist.",
      });
    }

    // Check if being used in DealerExtraBag
    const extraBagCount = await DealerExtraBag.countDocuments({
      subCollectionId: id,
    });

    if (extraBagCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete sub-collection",
        description:
          "This sub-collection is being used in the dealer bag pricing. Please remove the extra bag pricing for this category first.",
      });
    }

    // Check if being used in Product
    const productCount = await Product.countDocuments({
      subCollectionIds: id,
    });

    if (productCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete sub-collection",
        description: `This sub-collection has ${productCount} related product${
          productCount > 1 ? "s" : ""
        }. Please delete or reassign them first.`,
      });
    }

    await SubCollection.findByIdAndDelete(id);

    // Delete image in background (fire-and-forget)
    deleteSingleImage(subCollection.image?.publicId);

    return res.status(200).json({
      success: true,
      message: "Sub-collection deleted successfully",
    });
  } catch (error) {
    console.error("Delete sub-collection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete sub-collection",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};
