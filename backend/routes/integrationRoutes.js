import express from "express";
import {
  authenticateIntegration,
  requireIntegrationAdmin,
  requireIntegrationRefunds,
} from "../middlewares/integration.middleware.js";
import {
  getIntegrationOrders,
  getIntegrationOrderById,
  updateIntegrationOrderStatus,
  getIntegrationProducts,
  getIntegrationInventory,
  updateIntegrationStock,
  cancelIntegrationOrder,
  holdIntegrationBackorder,
  shipIntegrationBackorder,
  refundIntegrationOrder,
  restockIntegrationRefund,
} from "../controllers/integrationController.js";

// Odoo connection — every route needs the X-Api-Key header (see ODOO_INTEGRATION.md)
const router = express.Router();
router.use(authenticateIntegration);

router.get("/orders", getIntegrationOrders);
router.get("/orders/:id", getIntegrationOrderById);
router.patch("/orders/:id/status", updateIntegrationOrderStatus);

// Order changes (same rules, locks and customer emails as the admin order view;
// recorded as made by the Odoo admin account)
router.put("/orders/:id/backorder", requireIntegrationAdmin, holdIntegrationBackorder);
router.post("/orders/:id/backorder/ship", requireIntegrationAdmin, shipIntegrationBackorder);
// Money: only while INTEGRATION_REFUNDS=on
router.post("/orders/:id/cancel", requireIntegrationAdmin, requireIntegrationRefunds, cancelIntegrationOrder);
router.post("/orders/:id/refunds", requireIntegrationAdmin, requireIntegrationRefunds, refundIntegrationOrder);
router.post("/orders/:id/refunds/:refundId/restock", requireIntegrationAdmin, restockIntegrationRefund);

router.get("/products", getIntegrationProducts);
router.get("/inventory", getIntegrationInventory);
router.patch("/stock", updateIntegrationStock);

export default router;
