require('dotenv').config({ path: '.env.test', quiet: true });

async function login(page, email, password = process.env.QA_PASSWORD) {
  await page.goto('/');
  await page.getByLabel('Work email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

module.exports = { login };