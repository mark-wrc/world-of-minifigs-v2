import express from "express";
import { authenticateIntegration } from "../middlewares/integration.middleware.js";
import {
  getIntegrationOrders,
  getIntegrationOrderById,
  updateIntegrationOrderStatus,
  getIntegrationProducts,
  getIntegrationInventory,
  updateIntegrationStock,
} from "../controllers/integrationController.js";

// Odoo connection — every route needs the X-Api-Key header (see ODOO_INTEGRATION.md)
const router = express.Router();
router.use(authenticateIntegration);

router.get("/orders", getIntegrationOrders);
router.get("/orders/:id", getIntegrationOrderById);
router.patch("/orders/:id/status", updateIntegrationOrderStatus);

router.get("/products", getIntegrationProducts);
router.get("/inventory", getIntegrationInventory);
router.patch("/stock", updateIntegrationStock);

export default router;
