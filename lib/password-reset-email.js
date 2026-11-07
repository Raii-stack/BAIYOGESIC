const nodemailer = require('nodemailer');

function passwordResetMailer() {
  const user = (process.env.GMAIL_USER || '').trim();
  const password = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  let appUrl;
  try { appUrl = new URL(process.env.APP_URL || ''); } catch {}
  const local = appUrl && ['localhost', '127.0.0.1'].includes(appUrl.hostname) && process.env.NODE_ENV !== 'production';
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(user) || !/^[a-zA-Z0-9]{16}$/.test(password)
      || !appUrl || appUrl.username || appUrl.password || (appUrl.protocol !== 'https:' && !(local && appUrl.protocol === 'http:'))) {
    throw Object.assign(new Error('Password reset email is not configured.'), { statusCode: 503 });
  }
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: password },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  return async (recipient, token) => {
    const link = new URL('/reset-password', appUrl.origin);
    // Fragments keep the reset token out of server access logs and HTTP referrers.
    link.hash = `token=${token}`;
    try {
      const result = await transporter.sendMail({
        from: { name: 'HOPE, Inc.', address: user }, to: recipient,
        subject: 'Reset your HOPE ERP password',
        text: `You requested a password reset for your HOPE ERP account.\n\nReset your password: ${link.href}\n\nThis link expires in 15 minutes and can be used once. If you did not request this, ignore this email.`,
        html: `<p>You requested a password reset for your HOPE ERP account.</p><p><a href="${link.href}">Reset your password</a></p><p>This link expires in <strong>15 minutes</strong> and can be used once.</p><p>If you did not request this, ignore this email.</p>`,
      });
      if (!result.accepted?.length || result.rejected?.length) throw new Error('Email rejected');
    } catch (error) {
      const code = /^[A-Z][A-Z_0-9]{0,25}$/.test(error.code || '') ? error.code : 'DELIVERY_FAILED';
      const smtp = Number.isInteger(error.responseCode) ? `/${error.responseCode}` : '';
      // Log diagnostic codes through the server error handler, never SMTP responses or credentials.
      throw Object.assign(new Error(`Unable to send password reset email (${code}${smtp}).`), { statusCode: 503 });
    }
  };
}

module.exports = { passwordResetMailer };
