// backend/routes/userRoutes.js
import express from "express";
import { sendContactMessage } from "../controllers/contactFormController.js";

const router = express.Router();

// Public contact form endpoint
router.post("/contact", sendContactMessage);

export default router;