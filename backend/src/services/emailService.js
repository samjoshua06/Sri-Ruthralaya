const nodemailer = require('nodemailer');

/**
 * Check if SMTP / Email service credentials are configured in environment
 */
function isEmailConfigured() {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  return Boolean(user && pass);
}

/**
 * Create Nodemailer transporter based on environment configuration
 */
function createTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }

  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  // Use Gmail service shortcut if host is not explicitly custom
  if (process.env.EMAIL_SERVICE === 'gmail' || (!process.env.SMTP_HOST && user.includes('@gmail.com'))) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  // Standard Custom SMTP (e.g. Brevo, SendGrid, Amazon SES, Mailgun, or custom domain)
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Send Password Reset OTP Email
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit verification code
 * @returns {Promise<{ success: boolean, delivered: boolean, error?: string }>}
 */
async function sendPasswordResetEmail(toEmail, otp) {
  const configured = isEmailConfigured();

  if (!configured) {
    console.warn(`[EMAIL] ⚠️ SMTP credentials not configured in environment. OTP for ${toEmail}: ${otp}`);
    return {
      success: true,
      delivered: false,
      reason: 'SMTP_UNCONFIGURED',
      otp,
    };
  }

  try {
    const transporter = createTransporter();
    const fromAddress = process.env.SMTP_FROM || `"Sri Ruthralaya Academy" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`;

    const mailOptions = {
      from: fromAddress,
      to: toEmail,
      subject: '🔐 Sri Ruthralaya - Password Recovery Verification Code',
      text: `Your Sri Ruthralaya verification code is: ${otp}. It expires in 10 minutes. If you did not request this code, please ignore this email.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0d0d0d; color: #f4ede4; margin: 0; padding: 24px; }
            .container { max-width: 540px; margin: 0 auto; background: #161616; border: 1px solid #d4af37; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
            .header { background: linear-gradient(135deg, #4a0404 0%, #1a0000 100%); padding: 32px 24px; text-align: center; border-bottom: 2px solid #d4af37; }
            .title { color: #d4af37; font-size: 22px; font-weight: 700; margin: 0 0 6px 0; letter-spacing: 1px; }
            .subtitle { color: #e6c875; font-size: 13px; margin: 0; font-style: italic; }
            .body-content { padding: 32px 28px; line-height: 1.6; }
            .greeting { font-size: 16px; color: #ffffff; margin-bottom: 16px; }
            .otp-box { background: #0a0a0a; border: 2px dashed #d4af37; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
            .otp-code { font-family: 'Courier New', monospace; font-size: 38px; font-weight: 800; color: #ffd700; letter-spacing: 10px; margin: 0; }
            .expiry { font-size: 12px; color: #aaaaaa; margin-top: 8px; }
            .footer { background: #0f0f0f; padding: 20px; text-align: center; font-size: 11px; color: #777777; border-top: 1px solid #222222; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">SRI RUTHRALAYA</h1>
              <p class="subtitle">Traditional Classical Dance Institution • Thiruthangal</p>
            </div>
            <div class="body-content">
              <p class="greeting">Namaskaram,</p>
              <p style="color: #cccccc; font-size: 14px;">
                You requested a password reset for your Sri Ruthralaya Academy account. Use the verification code below to authorize the password change:
              </p>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
                <div class="expiry">⏰ Valid for 10 minutes only • Single-use verification</div>
              </div>
              <p style="color: #999999; font-size: 12px; margin-top: 24px;">
                If you did not request this verification code, your account is still secure. You can safely disregard this message.
              </p>
            </div>
            <div class="footer">
              Sri Ruthralaya Bharathanatyam Academy • Thiruthangal near Sivakasi, Tamil Nadu<br/>
              Contact: +91 98421 23456 • Natyamevam Pavithram
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] ✅ Password reset email dispatched to ${toEmail} (Message ID: ${info.messageId})`);
    return {
      success: true,
      delivered: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error(`[EMAIL] ❌ Failed to send reset email to ${toEmail}:`, err.message);
    return {
      success: false,
      delivered: false,
      error: err.message,
      otp, // Keep for dev fallback logging
    };
  }
}

module.exports = {
  isEmailConfigured,
  sendPasswordResetEmail,
};
