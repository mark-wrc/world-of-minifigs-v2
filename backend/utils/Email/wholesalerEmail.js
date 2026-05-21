export const getWholesalerApprovedEmailTemplate = (user) => {
  const name = `${user.firstName} ${user.lastName}`.trim() || user.username;

  return `
    <p>Hi ${name}!</p>
    <p>Thank you for signing up as a <strong>wholesaler</strong> with World of Minifigs! Your application has been <strong>reviewed</strong> and <strong>approved</strong>.</p>
    <p>You should now see the <strong>Wholesalers</strong> tab in the top banner of the website when you're logged in. This gives you access to our wholesale pricing, first pick of new arrivals, and genuine LEGO® minifigures, accessories, and more at prices designed to help your business grow.</p>
    <p>Here's what you can do next:</p>
    <ul>
      <li>Log in at <a href="${process.env.FRONTEND_URL}">${process.env.FRONTEND_URL}</a> and explore the <strong>Wholesalers</strong> section.</li>
      <li>Browse our latest inventory and stock up on high-demand items.</li>
      <li>Be sure to check out our add-ons section for an exciting collection of minifigs, accessories, and animals!</li>
      <li>If you have any questions about pricing, ordering, or shipping, just reply to this email, or for a faster response contact us at <strong>(760) 800-8400</strong>. We're happy to help.</li>
    </ul>
    <p>We're excited to have you as part of our growing network of successful wholesalers!</p>
    <p><strong>Best regards,</strong><br/>Mark Storey<br/>(760) 800-8400</p>
  `;
};

export const getWholesalerRejectedEmailTemplate = (user) => {
  const name = `${user.firstName} ${user.lastName}`.trim() || user.username;

  return `
    <p>Hi ${name},</p>
    <p>We wanted to let you know that your <strong>wholesaler</strong> access on World of Minifigs has been <strong>removed</strong>.</p>
    <p>If you believe this was a mistake or would like more information, please don't hesitate to reach out — just reply to this email or contact us at <strong>(760) 800-8400</strong>. We're happy to help.</p>
    <p>Thank you for being part of our network, and we hope to work with you again in the future.</p>
    <p>Best regards,<br/>${process.env.SMTP_FROM_NAME || "World of Minifigs"}</p>
  `;
};

export const getAdminWholesalerNotificationTemplate = (user) => {
  const name = `${user.firstName} ${user.lastName}`.trim() || user.username;
  const adminUrl = `${process.env.FRONTEND_URL}/admin/users`;

  return `
    <p>Hi Admin,</p>
    <p><strong>${name}</strong> has submitted a wholesaler application and is awaiting your review.</p>
    <p>
      Name: ${name}<br/>
      Email Address: ${user.email}<br/>
      Username: ${user.username}<br/>
      Contact Number: ${user.contactNumber || "—"}
    </p>
    <p>Please review the application here: <a href="${adminUrl}">${adminUrl}</a></p>
  `;
};
