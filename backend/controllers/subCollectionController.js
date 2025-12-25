import SubCollection from "../models/subCollection.model.js";
import Collection from "../models/collection.model.js";
import {
  uploadImage,
  deleteImage,
  validateImage,
} from "../utils/cloudinary.js";

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
        description: "Please select a parent collection.",
      });
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Sub-collection image is required",
        description: "Please upload an image for the sub-collection.",
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
    const existingSubCollection = await SubCollection.findOne({
      subCollectionName: subCollectionNameStr,
      collectionId: collection,
    })
      .collation({ locale: "en", strength: 2 })
      .lean();

    if (existingSubCollection) {
      return res.status(409).json({
        success: false,
        message: "Sub-collection already exists",
        description:
          "A sub-collection with this name already exists in the selected collection.",
      });
    }

    // Upload image to Cloudinary
    let uploadedImage;
    try {
      uploadedImage = await uploadImage(
        image,
        "world-of-minifigs-v2/sub-collections"
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

    // Create sub-collection
    const subCollection = await SubCollection.create({
      subCollectionName: subCollectionNameStr,
      description: descriptionStr,
      collectionId: collection,
      image: {
        publicId: uploadedImage.public_id,
        url: uploadedImage.url,
      },

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
    const subCollections = await SubCollection.find()
      .select("-__v")
      .populate("collectionId", "collectionName")
      .populate("createdBy", "firstName lastName username")
      .populate("updatedBy", "firstName lastName username")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: subCollections.length,
      subCollections,
    });
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
      const existingSubCollection = await SubCollection.findOne({
        subCollectionName: subCollectionNameStr,
        collectionId: collectionToCheck,
        _id: { $ne: id },
      })
        .collation({ locale: "en", strength: 2 })
        .lean();

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
        if (subCollection.image?.publicId) {
          await deleteImage(subCollection.image.publicId);
        }

        // Upload new image
        const uploadedImage = await uploadImage(
          image,
          "world-of-minifigs-v2/sub-collections"
        );
        subCollection.image = {
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
    subCollection.updatedBy = req.user._id;

    await subCollection.save();

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

    // Delete image from Cloudinary
    try {
      if (subCollection.image?.publicId) {
        await deleteImage(subCollection.image.publicId);
      }
    } catch (deleteError) {
      console.error("Image deletion error:", deleteError);
      // Continue with sub-collection deletion even if image deletion fails
    }

    await SubCollection.findByIdAndDelete(id);

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
