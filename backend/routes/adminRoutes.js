import express from "express";
import {
  authenticate,
  authorizeAdmin,
} from "../middlewares/auth.middleware.js";
import {
  createColor,
  getAllColors,
  getColorById,
  updateColor,
  deleteColor,
} from "../controllers/colorController.js";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import {
  createSubCategory,
  getAllSubCategories,
  getSubCategoryById,
  updateSubCategory,
  deleteSubCategory,
} from "../controllers/subCategoryController.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, authorizeAdmin);

// Color CRUD routes
router.post("/colors", createColor);
router.get("/colors", getAllColors);
router.get("/colors/:id", getColorById);
router.put("/colors/:id", updateColor);
router.delete("/colors/:id", deleteColor);

// Category CRUD routes
router.post("/categories", createCategory);
router.get("/categories", getAllCategories);
router.get("/categories/:id", getCategoryById);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

// SubCategory CRUD routes
router.post("/subCategories", createSubCategory);
router.get("/subCategories", getAllSubCategories);
router.get("/subCategories/:id", getSubCategoryById);
router.put("/subCategories/:id", updateSubCategory);
router.delete("/subCategories/:id", deleteSubCategory);

export default router;
