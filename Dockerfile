# Aoura 운영 시스템 — axhub docker 배포 이미지 (BE-14, A안: 원본 CSV 를 이미지에 넣고 시작 시 마이그레이션)
#
# 빌드 컨텍스트 = 저장소 최상위. axhub.yaml 에 root 를 선언하지 않는다 —
# 선언하면 컨텍스트가 그 폴더로 좁아지고 최상위 Dockerfile 이 무시돼 원본 폴더를 넣을 수 없다(axhub.yaml 레퍼런스 「root」).
# 컨텍스트에 들어오는 것은 .dockerignore 가 정한다: app/ 소스와 원본 02_masil 폴더뿐.
#
# 이 파일과 .dockerignore 에는 한글 경로를 쓰지 않는다(01_*/04_* 로 찾는다) —
# 한글 폴더명의 유니코드 정규화(NFC/NFD)가 빌드 환경마다 달라도 같은 결과가 나오게 한다.
# 원본 폴더는 저장소에서 이름을 바꾸거나 복사하지 않고, 빌드 단계 안에서만 골라 담는다.

FROM node:22-slim AS deps
WORKDIR /build/app
COPY app/package.json app/package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /build/app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /build/app/node_modules ./node_modules
COPY app/ ./
# 빌드에는 실행용 환경변수(DATABASE_URL · ANTHROPIC_API_KEY · AOURA_AI_MODE)가 없다 — 빌드 중 DB · 원본 · AI 를 읽지 않는다.
# build        : next standalone 산출물 (.next/standalone)
# build:deploy : 시작 단계(마이그레이션 → 시드)를 단일 파일로 묶는다 (build/deploy/bootstrap.cjs — pg · drizzle 포함)
RUN npm run build && npm run build:deploy

# 원본 CSV 고르기 — 앱이 실제로 읽는 파일만(app/src/domain/files.ts 의 MASIL_FILES 가 기준). .md · html · pdf · 다른 회사 폴더는 담지 않는다.
# 목록의 파일이 하나라도 없으면 빌드가 실패한다(런타임에 발견하지 않게).
FROM node:22-slim AS raw
COPY . /ctx
RUN set -eu; \
    src="$(find /ctx -mindepth 2 -maxdepth 2 -type d -path '/ctx/01_*/04_*')"; \
    if [ ! -d "$src/02_masil" ]; then echo "raw: 02_masil folder not found in build context" >&2; exit 1; fi; \
    grep -o "02_masil/[A-Za-z0-9_/]*\.csv" /ctx/app/src/domain/files.ts | sort -u > /tmp/raw-files; \
    if [ ! -s /tmp/raw-files ]; then echo "raw: no file list in files.ts" >&2; exit 1; fi; \
    while read -r f; do \
      mkdir -p "/out/$(dirname "$f")"; \
      cp "$src/$f" "/out/$f"; \
    done < /tmp/raw-files; \
    echo "raw: $(wc -l < /tmp/raw-files) files"; \
    chmod -R a-w /out

FROM node:22-slim AS runner
# RAW_DATA_DIR: 원본 CSV 위치 — 웹 공개 경로(.next/static · public) 밖. Next 는 이 폴더를 정적 파일로 내보내지 않는다.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 RAW_DATA_DIR=/data/raw
WORKDIR /srv/app
# next standalone 산출물 (server.js + 추적된 node_modules). app/public 폴더는 없다 — 생기면 ./public 으로 복사한다
COPY --from=build /build/app/.next/standalone ./
COPY --from=build /build/app/.next/static ./.next/static
# 시작 단계: 묶은 실행 파일 + 마이그레이션 SQL + 시작 스크립트
COPY --from=build /build/app/build/deploy/bootstrap.cjs ./bootstrap.cjs
COPY --from=build /build/app/drizzle/migrations ./drizzle/migrations
COPY --from=build --chmod=0555 /build/app/scripts/deploy/start.sh ./start.sh
COPY --from=raw /out /data/raw
USER node
EXPOSE 3000
CMD ["./start.sh"]
