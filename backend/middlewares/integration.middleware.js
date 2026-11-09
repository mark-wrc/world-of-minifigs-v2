import crypto from "crypto";
import User from "../models/user.model.js";
import { authenticate } from "./auth.middleware.js";

// Keys shorter than this are treated as not set, so a weak key never opens the API.
const MIN_KEY_LENGTH = 32;

const digest = (value) =>
  crypto.createHash("sha256").update(String(value)).digest();

const integrationKey = () => {
  const key = process.env.INTEGRATION_API_KEY || "";
  return key.length >= MIN_KEY_LENGTH ? key : null;
};

const isValidKey = (given) => {
  const expected = integrationKey();
  return Boolean(
    expected &&
      given &&
      crypto.timingSafeEqual(digest(given), digest(expected)),
  );
};

const invalidKey = (res) =>
  res.status(401).json({
    success: false,
    message: "Invalid API key",
    description: "Send the integration key in the X-Api-Key header.",
  });

// The admin account Odoo acts as (INTEGRATION_ADMIN_EMAIL). Whatever Odoo
// changes is recorded as made by this account, like any other admin's changes.
const findIntegrationAdmin = () => {
  const email = (process.env.INTEGRATION_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!email) return null;
  // Older accounts may have no isActive flag; only a switched-off account is refused.
  return User.findOne({ email, role: "admin", isActive: { $ne: false } }).select(
    "-password -refreshToken",
  );
};

// Lets an outside system (Odoo) call /api/v1/integration with the shared key
// in the "X-Api-Key" header. Until INTEGRATION_API_KEY is set on the server,
// the integration routes don't exist.
export const authenticateIntegration = async (req, res, next) => {
  if (!integrationKey()) {
    return res.status(404).json({ message: "Route not found" });
  }
  if (!isValidKey(req.get("x-api-key"))) return invalidKey(res);

  try {
    req.user = (await findIntegrationAdmin()) || { _id: undefined };
  } catch (error) {
    return next(error);
  }
  next();
};

// For the admin routes: a request with the integration key acts as the Odoo
// admin account; everything else signs in as usual.
export const authenticateAdminOrIntegration = async (req, res, next) => {
  if (!req.get("x-api-key")) return authenticate(req, res, next);
  if (!isValidKey(req.get("x-api-key"))) return invalidKey(res);

  try {
    const user = await findIntegrationAdmin();
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Odoo admin account not set up",
        description:
          "Set INTEGRATION_ADMIN_EMAIL to the email of an active admin account.",
      });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
