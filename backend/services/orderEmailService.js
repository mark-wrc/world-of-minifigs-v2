import sendEmail from "../utils/sendEmail.js";
import {
  getShippingNotificationTemplate,
  getOrderCancelledTemplate,
  getOrderDeliveredTemplate,
  getBackorderShippedTemplate,
  getRefundIssuedTemplate,
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

// Backordered items shipped as Shipment `generation` (2, 3, …).
export const sendBackorderShippedEmail = (order, generation) =>
  send(
    order,
    `The Rest of Your Order Has Shipped – ${appName()}`,
    (o) => getBackorderShippedTemplate(o, generation),
  );

// A refund made from the order view without cancelling (`entry` = order.refunds item).
export const sendRefundIssuedEmail = (order, entry) =>
  send(
    order,
    `A Refund Has Been Issued – ${appName()}`,
    (o) => getRefundIssuedTemplate(o, entry),
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
