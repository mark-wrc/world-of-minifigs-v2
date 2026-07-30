import express from "express";
import {
  authenticate,
  authorizeAdmin,
} from "../middlewares/auth.middleware.js";
import {
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
} from "../controllers/bannerController.js";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
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
import {
  createCollection,
  getAllCollections,
  getCollectionById,
  updateCollection,
  deleteCollection,
} from "../controllers/collectionController.js";
import {
  createSubCollection,
  getAllSubCollections,
  getSubCollectionById,
  updateSubCollection,
  deleteSubCollection,
} from "../controllers/subCollectionController.js";
import {
  createDealerBundle,
  getAllDealerBundles,
  updateDealerBundle,
  deleteDealerBundle,
  createDealerAddon,
  getAllDealerAddons,
  updateDealerAddon,
  deleteDealerAddon,
  reorderDealerAddonItems,
  createDealerExtraBag,
  getAllDealerExtraBags,
  updateDealerExtraBag,
  deleteDealerExtraBag,
  createDealerTorsoBag,
  getAllDealerTorsoBags,
  updateDealerTorsoBag,
  deleteDealerTorsoBag,
  reorderTorsoBagItems,
} from "../controllers/dealerController.js";
import {
  createRewardBundle,
  getAllRewardBundles,
  updateRewardBundle,
  deleteRewardBundle,
  createRewardAddon,
  getAllRewardAddons,
  updateRewardAddon,
  deleteRewardAddon,
} from "../controllers/rewardController.js";
import {
  createSkillLevel,
  getAllSkillLevels,
  getSkillLevelById,
  updateSkillLevel,
  deleteSkillLevel,
} from "../controllers/skillLevelController.js";
import {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { getAllUsers, updateUserRole, updateUserTaxExempt } from "../controllers/authController.js";
import {
  createGeneralInventoryBulk,
  getAllGeneralInventory,
  updateGeneralInventory,
  deleteGeneralInventory,
} from "../controllers/generalInventoryController.js";
import {
  createFlashSale,
  getAllFlashSales,
  getFlashSaleById,
  updateFlashSale,
  deleteFlashSale,
  duplicateFlashSale,
} from "../controllers/flashSaleController.js";
import { getUploadSignature } from "../controllers/uploadController.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, authorizeAdmin);

// Direct browser→Cloudinary upload signature (keeps large image bytes off the server)
router.get("/uploads/signature", getUploadSignature);

// Banner CRUD routes
router.post("/banners", createBanner);
router.get("/banners", getAllBanners);
router.get("/banners/:id", getBannerById);
router.put("/banners/:id", updateBanner);
router.delete("/banners/:id", deleteBanner);

// Product CRUD routes
router.post("/products", createProduct);
router.get("/products", getAllProducts);
router.get("/products/:id", getProductById);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

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

// Sub-category CRUD routes
router.post("/subCategories", createSubCategory);
router.get("/subCategories", getAllSubCategories);
router.get("/subCategories/:id", getSubCategoryById);
router.put("/subCategories/:id", updateSubCategory);
router.delete("/subCategories/:id", deleteSubCategory);

// Collection CRUD routes
router.post("/collections", createCollection);
router.get("/collections", getAllCollections);
router.get("/collections/:id", getCollectionById);
router.put("/collections/:id", updateCollection);
router.delete("/collections/:id", deleteCollection);

// Sub-collection CRUD routes
router.post("/subCollections", createSubCollection);
router.get("/subCollections", getAllSubCollections);
router.get("/subCollections/:id", getSubCollectionById);
router.put("/subCollections/:id", updateSubCollection);
router.delete("/subCollections/:id", deleteSubCollection);

// Dealer Management routes
router.post("/dealer/bundles", createDealerBundle);
router.get("/dealer/bundles", getAllDealerBundles);
router.put("/dealer/bundles/:id", updateDealerBundle);
router.delete("/dealer/bundles/:id", deleteDealerBundle);

router.post("/dealer/addons", createDealerAddon);
router.get("/dealer/addons", getAllDealerAddons);
router.put("/dealer/addons/:id", updateDealerAddon);
router.delete("/dealer/addons/:id", deleteDealerAddon);
router.patch("/dealer/addons/:id/reorder", reorderDealerAddonItems);

router.post("/dealer/extra-bags", createDealerExtraBag);
router.get("/dealer/extra-bags", getAllDealerExtraBags);
router.put("/dealer/extra-bags/:id", updateDealerExtraBag);
router.delete("/dealer/extra-bags/:id", deleteDealerExtraBag);

router.post("/dealer/torso-bags", createDealerTorsoBag);
router.get("/dealer/torso-bags", getAllDealerTorsoBags);
router.put("/dealer/torso-bags/:id", updateDealerTorsoBag);
router.delete("/dealer/torso-bags/:id", deleteDealerTorsoBag);
router.patch("/dealer/torso-bags/:id/reorder", reorderTorsoBagItems);

router.post("/reward/bundles", createRewardBundle);
router.get("/reward/bundles", getAllRewardBundles);
router.put("/reward/bundles/:id", updateRewardBundle);
router.delete("/reward/bundles/:id", deleteRewardBundle);

router.post("/reward/addons", createRewardAddon);
router.get("/reward/addons", getAllRewardAddons);
router.put("/reward/addons/:id", updateRewardAddon);
router.delete("/reward/addons/:id", deleteRewardAddon);

// SkillLevel CRUD routes
router.post("/skillLevels", createSkillLevel);
router.get("/skillLevels", getAllSkillLevels);
router.get("/skillLevels/:id", getSkillLevelById);
router.put("/skillLevels/:id", updateSkillLevel);
router.delete("/skillLevels/:id", deleteSkillLevel);

// Order Management routes
router.get("/orders", getAllOrders);
router.get("/orders/:id", getOrderById);
router.patch("/orders/:id/status", updateOrderStatus);

// User Management routes
router.get("/users", getAllUsers);
router.put("/users/:id/role", updateUserRole);
router.put("/users/:id/tax-exempt", updateUserTaxExempt);

// General Inventory CRUD routes
router.post("/general-inventory/bulk", createGeneralInventoryBulk);
router.get("/general-inventory", getAllGeneralInventory);
router.put("/general-inventory/:id", updateGeneralInventory);
router.delete("/general-inventory/:id", deleteGeneralInventory);

// Flash Sale CRUD routes
router.post("/flash-sales", createFlashSale);
router.get("/flash-sales", getAllFlashSales);
router.get("/flash-sales/:id", getFlashSaleById);
router.put("/flash-sales/:id", updateFlashSale);
router.delete("/flash-sales/:id", deleteFlashSale);
router.post("/flash-sales/:id/duplicate", duplicateFlashSale);

export default router;
