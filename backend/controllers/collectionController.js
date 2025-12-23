import Collection from "../models/collection.model.js";
import SubCollection from "../models/subCollection.model.js";
import {
  uploadImage,
  deleteImage,
  validateImage,
} from "../utils/cloudinary.js";

const FEATURED_COLLECTION_LIMIT = 2;

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

    // Validate image format and size
    const imageValidation = validateImage(image, 5);
    if (!imageValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid image",
        description: imageValidation.error,
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
    const existingCollection = await Collection.findOne({
      collectionName: collectionNameStr,
    })
      .collation({ locale: "en", strength: 2 })
      .lean();

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

    // Upload image to Cloudinary
    let uploadedImage;
    try {
      uploadedImage = await uploadImage(
        image,
        "world-of-minifigs-v2/collections"
      );
    } catch (uploadError) {
      console.error("Image upload error:", uploadError);
      return res.status(500).json({
        success: false,
        message: "Failed to upload image",
        description: "An error occurred while uploading the image.",
      });
    }

    // Normalize description if provided
    const descriptionStr = description ? String(description).trim() : "";

    // Create collection
    const collection = await Collection.create({
      collectionName: collectionNameStr,
      description: descriptionStr,
      image: {
        publicId: uploadedImage.public_id,
        url: uploadedImage.url,
      },
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
    const collections = await Collection.find()
      .select("-__v")
      .populate("createdBy", "firstName lastName username")
      .populate("updatedBy", "firstName lastName username")
      .sort({ isFeatured: -1, createdAt: -1 }) // Featured first, then by date
      .lean();

    return res.status(200).json({
      success: true,
      count: collections.length,
      collections,
    });
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
      const existingCollection = await Collection.findOne({
        collectionName: collectionNameStr,
        _id: { $ne: id },
      })
        .collation({ locale: "en", strength: 2 })
        .lean();

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

    // Update image if provided
    if (image) {
      // Validate image format and size
      const imageValidation = validateImage(image, 5);
      if (!imageValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid image",
          description: imageValidation.error,
        });
      }

      try {
        // Delete old image from Cloudinary
        if (collection.image?.publicId) {
          await deleteImage(collection.image.publicId);
        }

        // Upload new image
        const uploadedImage = await uploadImage(
          image,
          "world-of-minifigs-v2/collections"
        );
        collection.image = {
          publicId: uploadedImage.public_id,
          url: uploadedImage.url,
        };
      } catch (uploadError) {
        console.error("Image update error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to update image",
          description: "An error occurred while updating the image.",
        });
      }
    }

    // Update updatedBy
    collection.updatedBy = req.user._id;

    await collection.save();

    return res.status(200).json({
      success: true,
      message: "Collection updated successfully",
      collection: {
        id: collection._id,
        collectionName: collection.collectionName,
        description: collection.description,
        image: collection.image,
        isFeatured: collection.isFeatured,
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
      collection: id,
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

    // Delete image from Cloudinary
    try {
      if (collection.image?.publicId) {
        await deleteImage(collection.image.publicId);
      }
    } catch (deleteError) {
      console.error("Image deletion error:", deleteError);
      // Continue with collection deletion even if image deletion fails
    }

    await Collection.findByIdAndDelete(id);

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
