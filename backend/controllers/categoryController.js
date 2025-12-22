import Category from "../models/category.model.js";
import SubCategory from "../models/subCategory.model.js";

//------------------------------------------------ Create Category ------------------------------------------
export const createCategory = async (req, res) => {
  try {
    const { categoryName, description } = req.body;

    // Validate required fields
    if (!categoryName) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
        description: "Please provide a category name.",
      });
    }

    // Normalize category name
    const categoryNameStr = String(categoryName).trim();

    if (!categoryNameStr) {
      return res.status(400).json({
        success: false,
        message: "Category name cannot be empty",
        description: "Please provide a valid category name.",
      });
    }

    // Check if category with same name already exists
    const existingCategory = await Category.findOne({
      categoryName: categoryNameStr,
    })
      .collation({ locale: "en", strength: 2 })
      .lean();

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
        description: "A category with this name already exists.",
      });
    }

    // Normalize description if provided
    const descriptionStr = description ? String(description).trim() : "";

    // Create category
    const category = await Category.create({
      categoryName: categoryNameStr,
      description: descriptionStr,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category: {
        id: category._id,
        categoryName: category.categoryName,
        description: category.description,
        createdAt: category.createdAt,
      },
    });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create category",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get All Categories ------------------------------------------
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .select("-__v")
      .populate("createdBy", "firstName lastName username")
      .populate("updatedBy", "firstName lastName username")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get all categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Get Single Category ------------------------------------------
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id)
      .select("-__v")
      .populate("createdBy", "firstName lastName username")
      .populate("updatedBy", "firstName lastName username")
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
        description: "The requested category does not exist.",
      });
    }

    return res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    console.error("Get category by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Update Category ------------------------------------------
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryName, description } = req.body;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
        description: "The requested category does not exist.",
      });
    }

    // Update category name if provided
    if (categoryName !== undefined) {
      const categoryNameStr = String(categoryName).trim();

      if (!categoryNameStr) {
        return res.status(400).json({
          success: false,
          message: "Category name cannot be empty",
          description: "Please provide a valid category name.",
        });
      }

      // Check if another category with same name exists
      const existingCategory = await Category.findOne({
        categoryName: categoryNameStr,
        _id: { $ne: id },
      })
        .collation({ locale: "en", strength: 2 })
        .lean();

      if (existingCategory) {
        return res.status(409).json({
          success: false,
          message: "Category name already exists",
          description: "Another category with this name already exists.",
        });
      }

      category.categoryName = categoryNameStr;
    }

    // Update description if provided
    if (description !== undefined) {
      category.description = description ? String(description).trim() : "";
    }

    // Update updatedBy
    category.updatedBy = req.user._id;

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category: {
        id: category._id,
        categoryName: category.categoryName,
        description: category.description,
        updatedAt: category.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

//------------------------------------------------ Delete Category ------------------------------------------
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
        description: "The requested category does not exist.",
      });
    }

    // Check if category has any related subcategories
    const relatedSubCategories = await SubCategory.countDocuments({
      category: id,
    });

    if (relatedSubCategories > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete category",
        description: `This category has ${relatedSubCategories} related subcategor${
          relatedSubCategories === 1 ? "y" : "ies"
        }. Please delete or reassign them first.`,
      });
    }

    await Category.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};
