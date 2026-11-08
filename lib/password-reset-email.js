const nodemailer = require('nodemailer');

function gmailMailer(purpose) {
  const user = (process.env.GMAIL_USER || '').trim();
  const password = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(user) || !/^[a-zA-Z0-9]{16}$/.test(password)) {
    throw Object.assign(new Error(`${purpose} email is not configured.`), { statusCode: 503 });
  }
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: password },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  return async (recipient, content) => {
    try {
      const result = await transporter.sendMail({
        from: { name: 'HOPE, Inc.', address: user }, to: recipient,
        ...content,
      });
      if (!result.accepted?.length || result.rejected?.length) throw new Error('Email rejected');
    } catch (error) {
      const code = /^[A-Z][A-Z_0-9]{0,25}$/.test(error.code || '') ? error.code : 'DELIVERY_FAILED';
      const smtp = Number.isInteger(error.responseCode) ? `/${error.responseCode}` : '';
      // Log diagnostic codes through the server error handler, never SMTP responses or credentials.
      throw Object.assign(new Error(`Unable to send ${purpose.toLowerCase()} email (${code}${smtp}).`), { statusCode: 503 });
    }
  };
}

function passwordResetMailer() {
  let appUrl;
  try { appUrl = new URL(process.env.APP_URL || ''); } catch {}
  const local = appUrl && ['localhost', '127.0.0.1'].includes(appUrl.hostname) && process.env.NODE_ENV !== 'production';
  if (!appUrl || appUrl.username || appUrl.password || (appUrl.protocol !== 'https:' && !(local && appUrl.protocol === 'http:'))) {
    throw Object.assign(new Error('Password reset email is not configured.'), { statusCode: 503 });
  }
  const send = gmailMailer('Password reset');
  return (recipient, token) => {
    const link = new URL('/reset-password', appUrl.origin);
    // Fragments keep the reset token out of server access logs and HTTP referrers.
    link.hash = `token=${token}`;
    return send(recipient, {
      subject: 'Reset your HOPE ERP password',
      text: `You requested a password reset for your HOPE ERP account.\n\nReset your password: ${link.href}\n\nThis link expires in 15 minutes and can be used once. If you did not request this, ignore this email.`,
      html: `<p>You requested a password reset for your HOPE ERP account.</p><p><a href="${link.href}">Reset your password</a></p><p>This link expires in <strong>15 minutes</strong> and can be used once.</p><p>If you did not request this, ignore this email.</p>`,
    });
  };
}

function registrationCodeMailer() {
  const send = gmailMailer('Registration verification');
  return (recipient, code) => send(recipient, {
    subject: 'Verify your email for HOPE ERP',
    text: `Your HOPE ERP verification code is: ${code}\n\nEnter this code on the registration page. It expires in 10 minutes and can be used once. Your account will still need approval after registration. Never share this code. If you did not request it, ignore this email.`,
    html: `<div lang="en"><p>Verify your email for HOPE ERP.</p><p style="font:32px monospace;letter-spacing:6px">${code}</p><p>Enter this code on the registration page. It expires in <strong>10 minutes</strong> and can be used once.</p><p>Your account will still need approval after registration. Never share this code. If you did not request it, ignore this email.</p></div>`,
  });
}

module.exports = { passwordResetMailer, registrationCodeMailer };
