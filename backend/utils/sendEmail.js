import nodemailer from "nodemailer";

const sendEmail = async (option) => {
  // Validate required SMTP config
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASSWORD ||
    !process.env.SMTP_FROM_EMAIL
  ) {
    throw new Error(
      "SMTP configuration is incomplete. Please check your environment variables.",
    );
  }

  const parsedPort = Number.parseInt(process.env.SMTP_PORT, 10);
  const smtpPort = Number.isFinite(parsedPort) ? parsedPort : 587;

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: false,
    auth: {
      user: process.env.SMTP_USER, 
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: `${process.env.SMTP_FROM_NAME || "World of Minifigs"} <${
      process.env.SMTP_FROM_EMAIL
    }>`,
    to: option.email,
    subject: option.subject,
    html: option.message,
  };

  await transport.verify();
  await transport.sendMail(mailOptions);
};

export default sendEmail;
