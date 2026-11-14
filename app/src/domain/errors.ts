/** 도메인 오류 — API 에서 그대로 {error:{code,message,details}} 와 HTTP 상태로 바뀐다 (SCREEN_SPEC 4절) */
export type DomainErrorCode = 'FORBIDDEN_ROLE' | 'INVALID_TRANSITION' | 'NOT_FOUND' | 'INFO_MISSING' | 'CLOCK_BACKWARD' | 'VALIDATION' | 'CONFLICT';

const STATUS: Record<DomainErrorCode, number> = {
  FORBIDDEN_ROLE: 422,
  INVALID_TRANSITION: 409,
  NOT_FOUND: 404,
  INFO_MISSING: 422,
  CLOCK_BACKWARD: 409,
  VALIDATION: 422,
  CONFLICT: 409,
};

export class DomainError extends Error {
  readonly httpStatus: number;
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.httpStatus = STATUS[code];
  }
}
