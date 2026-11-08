// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const nodemailer = require('nodemailer');
const { passwordResetMailer, registrationCodeMailer } = require('./password-reset-email');
let sendMail;
beforeEach(() => {
  vi.stubEnv('GMAIL_USER', 'sender@gmail.com');
  vi.stubEnv('GMAIL_APP_PASSWORD', 'abcd efgh ijkl mnop');
  vi.stubEnv('APP_URL', 'https://baiyogesic.vercel.app');
  sendMail = vi.fn().mockResolvedValue({ accepted: ['employee@example.com'], rejected: [] });
  vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

test('sends a copyable registration code with its expiry and approval requirement', async () => {
  await registrationCodeMailer()('employee@example.com', '012345');
  const mail = sendMail.mock.calls[0][0];
  expect(mail.to).toBe('employee@example.com');
  expect(mail.text).toContain('012345');
  expect(mail.html).toContain('012345');
  expect(mail.text).toContain('10 minutes');
  expect(mail.text).toContain('approval');
  expect(mail.subject).not.toContain('012345');
});

test('sends a 15-minute reset link through Gmail using TLS without leaking the token into a URL query', async () => {
  await passwordResetMailer()('employee@example.com', 'a'.repeat(64));
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'sender@gmail.com', pass: 'abcdefghijklmnop' } }));
  const mail = sendMail.mock.calls[0][0];
  expect(mail.to).toBe('employee@example.com');
  expect(mail.text).toContain(`/reset-password#token=${'a'.repeat(64)}`);
  expect(mail.text).toContain('15 minutes');
  expect(mail.text).not.toContain('?token=');
});

test.each(['', 'http://example.com', 'https://name:password@example.com'])('rejects an unsafe or missing application URL: %s', (url) => {
  vi.stubEnv('APP_URL', url);
  expect(() => passwordResetMailer()).toThrow('not configured');
  expect(nodemailer.createTransport).not.toHaveBeenCalled();
});

test('fails clearly when Gmail credentials are missing', () => {
  vi.stubEnv('GMAIL_APP_PASSWORD', '');
  expect(() => passwordResetMailer()).toThrow('not configured');
});

test('does not claim success when Gmail rejects an email', async () => {
  sendMail.mockResolvedValueOnce({ accepted: [], rejected: ['employee@example.com'] });
  await expect(passwordResetMailer()('employee@example.com', 'a'.repeat(64))).rejects.toMatchObject({ statusCode: 503 });
});

test('retains safe SMTP diagnostic codes without exposing credentials or the server response', async () => {
  sendMail.mockRejectedValueOnce({ code: 'EAUTH', responseCode: 535, response: 'Private SMTP response and credential details' });
  await expect(passwordResetMailer()('employee@example.com', 'a'.repeat(64))).rejects.toMatchObject({ statusCode: 503, message: 'Unable to send password reset email (EAUTH/535).' });
});
