import sendEmail from "../utils/sendEmail.js";
import { ContactFormTemplate } from "../utils/Email/contactEmail.js";

export const sendContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    const nameStr = String(name || "").trim();
    const emailStr = String(email || "")
      .trim()
      .toLowerCase();
    const subjectStr = String(subject || "").trim();
    const messageStr = String(message || "").trim();

    if (!nameStr || !emailStr || !messageStr) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        description: "Name, email, and message are required.",
      });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailStr)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
        description: "Please provide a valid email address.",
      });
    }

    // Optional: limit message length to prevent abuse
    if (messageStr.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message too long",
        description: "Please shorten your message to 2000 characters or fewer.",
      });
    }

    const appEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_FROM_EMAIL;
    if (!appEmail) {
      console.error(
        "Contact form error: SUPPORT_EMAIL/SMTP_FROM_EMAIL is not configured."
      );
      return res.status(500).json({
        success: false,
        message: "Unable to send your message",
        description:
          "The contact system is not configured correctly. Please try again later.",
      });
    }

    // 1) Send message to app support email
    const emailSubject = subjectStr
      ? `${subjectStr} - ${process.env.SMTP_FROM_NAME || "World of Minifigs"}`
      : "Contact Form Submission - World of Minifigs Team";

    await sendEmail({
      email: appEmail,
      subject: emailSubject,
      message: ContactFormTemplate({
        name: nameStr,
        email: emailStr,
        subject: subjectStr,
        message: messageStr,
      }),
    });

    // 2) Send thank-you email to the user (do not fail the whole request if this breaks)
    try {
      await sendEmail({
        email: emailStr,
        subject: `Thank you for Contacting ${
          process.env.SMTP_FROM_NAME || "World of Minifigs"
        }`,
        message: `
          <p>Hello ${nameStr},</p>
          <p>We've received your message and will get back to you as soon as possible.</p>
          <p>Best regards,<br>${
            process.env.SMTP_FROM_NAME || "World of Minifigs"
          }</p>
        `,
      });
    } catch (emailError) {
      console.error("Error sending contact acknowledgement email:", {
        email: emailStr,
        error: emailError.message,
        stack: emailError.stack,
        timestamp: new Date().toISOString(),
      });
      // We intentionally don't return an error here; the main message was delivered to support.
    }

    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
      description:
        "Thank you for reaching out. We've received your message and will respond as soon as we can.",
    });
  } catch (error) {
    console.error("Contact form submission error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to send your message",
      description:
        "An unexpected error occurred while sending your message. Please try again later.",
    });
  }
};
