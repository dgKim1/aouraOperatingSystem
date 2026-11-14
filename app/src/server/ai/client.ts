/**
 * Claude 호출 경계 — 공식 SDK @anthropic-ai/sdk 만 쓴다. 키는 환경변수 ANTHROPIC_API_KEY 로만 읽고 출력 · 로그하지 않는다.
 * 테스트는 MessagesClient 를 모의 구현으로 바꿔 끼운다 (실제 API 를 호출하지 않음).
 */
import Anthropic from '@anthropic-ai/sdk';

export type Message = Anthropic.Messages.Message;
export type MessageParam = Anthropic.Messages.MessageParam;
export type MessageCreateParams = Anthropic.Messages.MessageCreateParamsNonStreaming;
export type Tool = Anthropic.Messages.Tool;
export type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

export const MODEL = 'claude-opus-5-5' as const;

export interface MessagesClient {
  create(params: MessageCreateParams): Promise<Message>;
}

/** 실시간 AI 를 쓸 수 있나: 키가 있고 AOURA_AI_MODE=mock 강제가 아님 */
export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.AOURA_AI_MODE !== 'mock';
}

/** 실시간 클라이언트 (키가 없으면 null → 모의 모드) */
export function liveClientFromEnv(): MessagesClient | null {
  if (!aiConfigured()) return null;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 120_000 });
  return { create: (p) => client.messages.create(p) };
}
