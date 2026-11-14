import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // docker 배포용 독립 실행 산출물 (axhub docker 전환 대비)
  output: 'standalone',
};

export default nextConfig;
