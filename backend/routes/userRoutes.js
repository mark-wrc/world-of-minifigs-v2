import express from "express";
import { sendContactMessage } from "../controllers/contactFormController.js";

const router = express.Router();

// User routes
router.post("/contact", sendContactMessage);

export default router;
