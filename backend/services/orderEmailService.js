import sendEmail from "../utils/sendEmail.js";
import {
  getShippingNotificationTemplate,
  getOrderCancelledTemplate,
  getOrderDeliveredTemplate,
} from "../utils/Email/orderEmails.js";

const appName = () => process.env.SMTP_FROM_NAME || "World of Minifigs";

const send = async (order, subject, templateFn) => {
  if (!order?.email) return;
  try {
    await sendEmail({
      email: order.email,
      subject,
      message: templateFn(order),
    });
  } catch (err) {
    console.error(
      `[OrderEmail] Failed to send "${subject}" to ${order.email}:`,
      err.message,
    );
  }
};

export const sendShippingNotificationEmail = (order) =>
  send(
    order,
    `Your Order Has Been Shipped – ${appName()}`,
    getShippingNotificationTemplate,
  );

export const sendOrderDeliveredEmail = (order) =>
  send(
    order,
    `Your Order Has Been Delivered – ${appName()}`,
    getOrderDeliveredTemplate,
  );

export const sendOrderCancelledEmail = (order) =>
  send(
    order,
    `Your Order Has Been Cancelled – ${appName()}`,
    getOrderCancelledTemplate,
  );
