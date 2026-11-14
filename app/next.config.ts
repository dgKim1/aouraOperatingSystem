import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // docker 배포용 독립 실행 산출물 (axhub docker 전환 대비)
  output: 'standalone',
  // next dev 가 AI 코딩 에이전트를 감지할 때 AGENTS.md 를 자동 생성하지 않게 한다 (Next 16 config-shared.d.ts 의 agentRules, 기본 true)
  agentRules: false,
  // pg 는 서버 번들에 넣지 않고 node_modules 에서 읽는다
  serverExternalPackages: ['pg'],
};

export default nextConfig;
