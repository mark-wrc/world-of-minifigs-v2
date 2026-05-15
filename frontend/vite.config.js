import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
    extensions: [".js", ".jsx", ".json", ".ts", ".tsx"],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname, ".")],
    },
    proxy: {
      "/api/v1": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
