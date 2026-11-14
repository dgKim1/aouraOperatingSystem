import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // docker 배포용 독립 실행 산출물 (axhub docker 전환 대비)
  output: 'standalone',
  // next dev 가 AI 코딩 에이전트를 감지할 때 AGENTS.md 를 자동 생성하지 않게 한다 (Next 16 config-shared.d.ts 의 agentRules, 기본 true)
  agentRules: false,
  // 로컬 개발 전용: 127.0.0.1 로 dev 서버에 접속해도 HMR · dev 자산 요청이 막히지 않게 한다 (Next 16 은 localhost 와 시작 호스트만 기본 허용).
  // dev 서버의 교차 출처 차단에만 쓰이는 옵션이라 next build · next start(운영)에는 영향이 없다. LAN IP 는 환경마다 달라 넣지 않는다
  allowedDevOrigins: ['127.0.0.1'],
  // pg 는 서버 번들에 넣지 않고 node_modules 에서 읽는다
  serverExternalPackages: ['pg'],
};

export default nextConfig;
