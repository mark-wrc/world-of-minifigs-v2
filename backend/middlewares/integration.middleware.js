import crypto from "crypto";

// Keys shorter than this are treated as not set, so a weak key never opens the API.
const MIN_KEY_LENGTH = 32;

const digest = (value) =>
  crypto.createHash("sha256").update(String(value)).digest();

// Lets an outside system (Odoo) call /api/v1/integration with the shared key
// in the "X-Api-Key" header. Until INTEGRATION_API_KEY is set on the server,
// the integration routes don't exist.
export const authenticateIntegration = (req, res, next) => {
  const expected = process.env.INTEGRATION_API_KEY || "";
  if (expected.length < MIN_KEY_LENGTH) {
    return res.status(404).json({ message: "Route not found" });
  }

  const given = req.get("x-api-key");
  if (!given || !crypto.timingSafeEqual(digest(given), digest(expected))) {
    return res.status(401).json({
      success: false,
      message: "Invalid API key",
      description: "Send the integration key in the X-Api-Key header.",
    });
  }

  next();
};
