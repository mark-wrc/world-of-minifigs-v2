export const getVerificationEmailTemplate = (user, verificationUrl) => {
    const email = user.email;
    const appName = process.env.SMTP_FROM_NAME || "World Of Minifigs";
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_FROM_EMAIL;
    const expiryTime = process.env.EMAIL_VERIFICATION_EXPIRY || "24";
    const expiryUnit = parseInt(expiryTime) === 1 ? "hour" : "hours"; 
  
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Verify Your Email | ${appName}</title>
        <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #ffffff;
          color: #1f2937;
          line-height: 1.5;
        }
        .container {
          width: 100%;
          max-width: 550px;
          margin: 0 auto;
          padding: 20px 10px;
          box-sizing: border-box;
          text-align: center;
        }
        .logo {
          margin-bottom: 24px;
        }
        .logo img {
          width: 120px;
          height: auto;
        }
        h1 {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 24px;
          color: #111827;
        }
        .description {
          font-size: 16px;
          color: #4b5563;
          margin-bottom: 32px;
          line-height: 1.5;
          text-decoration: none;
        }
        .verify-button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #4f46e5;
          color: white !important;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          font-size: 16px;
          margin-bottom: 24px;
        }
        .alternative-link {
          color: #6b7280;
          font-size: 14px;
          margin-top: 10px;
        }
        .link-text {
          color: #4b5563;
          word-break: break-all;
          font-size: 14px;
          margin-top: 8px;
        }
        .warning {
          color: #dc2626;
          font-size: 14px;
          margin-top: 20px;
          padding-top: 12px;
          border-radius: 8px;
        }
        .footer {
          text-align: center;
          font-size: 14px;
          color: #9ca3af;
          margin-top: 30px;
          padding-top: 5px;
          border-top: 2px solid #f0f0f0;
        }
      </style>
      </head>
       <body>
      <div class="container">
        <h1>Verify your email address</h1>
  
        <p class="description">
          You've entered <strong>${email}</strong> as the email address for
          your account. Please verify this email address by clicking button below.
        </p>
  
        <a href="${verificationUrl}" class="verify-button">
          Verify your email
        </a>
  
        <div class="alternative-link">
          Or copy and paste this link into your browser
          <div class="link-text">${verificationUrl}</div>
        </div>
  
        <p class="warning">
          This verification link will expire in ${expiryTime} ${expiryUnit} for security reasons.
        </p>
  
      <div class="footer">
    <p>
      If you did not create an account, please disregard this email.
    </p>
  
    <p>
      For any questions, contact us at 
      <a href="mailto:${supportEmail}">${supportEmail}</a>
    </p>
  
    <p>
      &copy; ${new Date().getFullYear()} ${
      process.env.SMTP_FROM_NAME
    }. All rights reserved.
    </p>
  </div>
    </body>
      </html>
    `;
  };
  