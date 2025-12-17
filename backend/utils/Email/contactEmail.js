export const ContactFormTemplate = (formData) => {
  const currentDate = new Date().toLocaleString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const appName = process.env.SMTP_FROM_NAME || "World Of Minifigs";

  return `
      <!DOCTYPE html>
      <html>
      <head>
       <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Inquiry Form | ${appName}</title>
          <style>
              body {
                  margin: 0;
                  padding: 0;
                  font-family: Arial, sans-serif;
                  background-color: #f4f4f4;
              }
              .container {
                  max-width: 900px;
                  margin: 0 auto;
                  background: white;
                  border-radius: 0;
                  overflow: hidden;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .header {
                  background-color: #1a237e;
                  color: white;
                  padding: 20px;
                  text-align: center;
              }
              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: normal;
              }
              .content {
                  background: white;
              }
              .message-section {
                  margin: 20px 0;
                  padding: 20px;
                  background: #f8f9fa;
                  border-radius: 12px;
              }
              .info-row {
                  margin: 10px 0;
                  padding: 10px 0;
                  border-bottom: 1px solid #e2e8f0;
              }
              .info-label {
                  font-weight: bold;
                  color: #1a237e;
                  display: inline-block;
                  width: 100px;
              }
              .message-box {
                  margin-top: 15px;
                  white-space: pre-wrap;
                  line-height: 1.6;
              }
              .footer {
                  text-align: center;
                  padding: 20px;
                  color: #64748b;
                  font-size: 14px;
                  border-top: 1px solid #e2e8f0;
              }
              .timestamp {
                  text-align: right;
                  color: #64748b;
                  font-size: 14px;
                  margin-top: 20px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>${formData.subject || "Contact Form Submission"}</h1>
              </div>
              <div class="content">
                  <div class="message-section">
                      <div class="info-row">
                          <span class="info-label">From:</span>
                          <span>${formData.name}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Email:</span>
                          <span>${formData.email}</span>
                      </div>
                      ${
                        formData.subject
                          ? `
                      <div class="info-row">
                          <span class="info-label">Subject:</span>
                          <span>${formData.subject}</span>
                      </div>
                      `
                          : ""
                      }
                      <div class="info-row">
                          <span class="info-label">Message:</span>
                          <div class="message-box">${formData.message}</div>
                      </div>
                      <div class="timestamp">
                          Submitted on ${currentDate}
                      </div>
                  </div>
                  <div class="footer">
                      <p style="margin-top: 10px">
                      &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
                      </p>
                  </div>
              </div>
          </div>
      </body>
      </html>
    `;
};
