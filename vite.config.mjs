import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    test: {
      exclude: ['**/node_modules/**', 'tests/integration/**', 'tests/e2e/**', 'tests/qa-unit/**'],
      environment: "jsdom",
      setupFiles: ["./src/test-setup.js"],
      testTimeout: 15000,
      exclude: ["**/node_modules/**", "**/dist/**", "tests/integration/**", "tests/e2e/**", "tests/qa-unit/**"],
    },
  };
});
