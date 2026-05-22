import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 推荐：开发时用固定端口、把 dev server 绑到 1420
// 见 https://v2.tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "esnext",
    sourcemap: false,
    // 桌面应用走 file:// 加载，单 chunk 体积大不是性能问题；
    // 把警告阈值放宽到 1.5 MB，避免 fluentui 触发噪音警告。
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        // 把 node_modules 第三方库（fluentui / react / tauri 等）拆成独立 vendor chunk：
        // - 浏览器可以并行解析 vendor + app
        // - 改业务代码不会让 vendor 重新打包，提升增量构建速度
        codeSplitting: {
          groups: [
            {
              name: "fluentui",
              test: /node_modules[\\/]@fluentui[\\/]/,
              priority: 20,
            },
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 15,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
