import "@testing-library/jest-dom/vitest"

if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = "https://mock-test.supabase.co";
}
if (!process.env.SUPABASE_KEY) {
  process.env.SUPABASE_KEY = "mock-test-key";
}

