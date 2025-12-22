import SubCategory from "../models/subCategory.model.js";
import Category from "../models/category.model.js";

//------------------------------------------------ Create Sub-category ------------------------------------------
export const createSubCategory = async (req, res) => {
  try {
    const { subCategoryName, description, category } = req.body;

    // Validate required fields
    if (!subCategoryName) {
      return res.status(400).json({
        success: false,
        message: "Sub-category name is required",
        description: "Please provide a sub-category name.",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
        description: "Please select a parent category.",
      });
    }

    // Normalize sub-category name
    const subCategoryNameStr = String(subCategoryName).trim();

    if (!subCategoryNameStr) {
      return res.status(400).json({
        success: false,
        message: "Sub-category name cannot be empty",
        description: "Please provide a valid sub-category name.",
      });
    }

    // Verify category exists
    const categoryExists = await Category.findById(category).lean();
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
        description: "The selected category does not exist.",
      });
    }

    // Check if subcategory with same name already exists in this category
    const existingSubCategory = await SubCategory.findOne({
      subCategoryName: subCategoryNameStr,
      category: category,
    })
      .collation({ locale: "en", strength: 2 })
      .lean();

    if (existingSubCategory) {
      return res.status(409).json({
        success: false,
        message: "Sub-category already exists",
        description:
          "A sub-category with this name already exists in the selected category.",
      });
    }

    // Normalize description if provided
    const descriptionStr = description ? String(description).trim() : "";

    // Create sub-category
    const subCategory = await SubCategory.create({
      subCategoryName: subCategoryNameStr,
      description: descriptionStr,
      category: category,
      createdBy: req.user._id,
    });

    // Populate category details
    await subCategory.populate("category", "categoryName");

    return res.status(201).json({
      success: true,
      message: "Sub-category created successfully",
      subCategory: {
        id: subCategory._id,
        subCategoryName: subCategory.subCategoryName,
        description: subCategory.description,
        category: subCategory.category,
        createdAt: subCategory.createdAt,
      },
    });
  } catch (error) {
    console.error("Create sub-category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create sub-category",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get All SubCategories ------------------------------------------
export const getAllSubCategories = async (req, res) => {
  try {
    const subCategories = await SubCategory.find()
      .select("-__v")
      .populate("category", "categoryName")
      .populate("createdBy", "firstName lastName username")
      .populate("updatedBy", "firstName lastName username")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: subCategories.length,
      subCategories,
    });
  } catch (error) {
    console.error("Get all subcategories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subcategories",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get Single Sub-category ------------------------------------------
export const getSubCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const subCategory = await SubCategory.findById(id)
      .select("-__v")
      .populate("category", "categoryName")
      .populate("createdBy", "firstName lastName username")
      .populate("updatedBy", "firstName lastName username")
      .lean();

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "Sub-category not found",
        description: "The requested sub-category does not exist.",
      });
    }

    return res.status(200).json({
      success: true,
      subCategory,
    });
  } catch (error) {
    console.error("Get sub-category by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sub-category",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Update Sub-category ------------------------------------------
export const updateSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { subCategoryName, description, category } = req.body;

    const subCategory = await SubCategory.findById(id);

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "Sub-category not found",
        description: "The requested sub-category does not exist.",
      });
    }

    // Update sub-category name if provided
    if (subCategoryName !== undefined) {
      const subCategoryNameStr = String(subCategoryName).trim();

      if (!subCategoryNameStr) {
        return res.status(400).json({
          success: false,
          message: "Sub-category name cannot be empty",
          description: "Please provide a valid sub-category name.",
        });
      }

      // Check if another sub-category with same name exists in the same category
      const categoryToCheck = category || subCategory.category;
      const existingSubCategory = await SubCategory.findOne({
        subCategoryName: subCategoryNameStr,
        category: categoryToCheck,
        _id: { $ne: id },
      })
        .collation({ locale: "en", strength: 2 })
        .lean();

      if (existingSubCategory) {
        return res.status(409).json({
          success: false,
          message: "Sub-category name already exists",
          description:
            "Another sub-category with this name already exists in this category.",
        });
      }

      subCategory.subCategoryName = subCategoryNameStr;
    }

    // Update category if provided
    if (category !== undefined) {
      // Verify category exists
      const categoryExists = await Category.findById(category).lean();
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
          description: "The selected category does not exist.",
        });
      }
      subCategory.category = category;
    }

    // Update description if provided
    if (description !== undefined) {
      subCategory.description = description ? String(description).trim() : "";
    }

    // Update updatedBy
    subCategory.updatedBy = req.user._id;

    await subCategory.save();
    await subCategory.populate("category", "categoryName");

    return res.status(200).json({
      success: true,
      message: "Sub-category updated successfully",
      subCategory: {
        id: subCategory._id,
        subCategoryName: subCategory.subCategoryName,
        description: subCategory.description,
        category: subCategory.category,
        updatedAt: subCategory.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update sub-category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sub-category",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Delete Sub-category ------------------------------------------
export const deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const subCategory = await SubCategory.findById(id).lean();

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "Sub-category not found",
        description: "The requested sub-category does not exist.",
      });
    }

    await SubCategory.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Sub-category deleted successfully",
    });
  } catch (error) {
    console.error("Delete sub-category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete sub-category",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};
