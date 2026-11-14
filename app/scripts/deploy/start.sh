#!/bin/sh
# 컨테이너 시작 (BE-14): 마이그레이션 → 비어 있으면 SEED → Next 서버.
# 시작 단계가 실패하면 서버를 띄우지 않고 0 이 아닌 코드로 끝난다(set -e) — 반쯤 준비된 상태로 요청을 받지 않는다.
# 접속 문자열 · 키는 출력하지 않는다(set -x 금지).
set -eu

if [ -n "${DIRECT_DATABASE_URL:-${DATABASE_URL:-}}" ]; then
  node bootstrap.cjs
else
  # DB 없이 띄운 경우(로컬 확인용): 메모리 저장소 — /api/meta 의 persistence 가 MEMORY 로 표시된다
  echo "[start] DATABASE_URL 없음 — 메모리 저장소로 시작"
fi

# PORT 는 axhub 가 넣는다(runtime.port). 쿠버네티스는 HOSTNAME 을 파드 이름으로 덮어쓰므로 여기서 다시 지정한다(모든 주소에서 수신)
export HOSTNAME=0.0.0.0
exec node server.js
