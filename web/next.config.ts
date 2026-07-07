import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 固定 Turbopack 工作区根到 web/（仓库存在多个 lockfile，避免误推断根目录）
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
