import nodemailer from "nodemailer";

const sendEmail = async (option) => {
  // Validate and default SMTP port
  const parsedPort = Number.parseInt(process.env.SMTP_PORT, 10);
  const smtpPort = Number.isFinite(parsedPort) ? parsedPort : 587; // default to 587

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465, // true for SMTPS (465), false for STARTTLS (e.g., 587)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });

  const mailOptions = {
    from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
    to: option.email,
    subject: option.subject,
    html: option.message,
  };

  await transport.sendMail(mailOptions);
};

export default sendEmail;
