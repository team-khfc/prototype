# 프론트엔드 작업 지침

루트 AGENTS.md·CODING_STYLE.md·design.md를 함께 따른다.

- Next.js App Router·React·TypeScript strict를 유지한다. 새 페이지는 app/, 업무 화면은 features/, 공통 UI는 components/ui/에 둔다.
- 현재 진입점은 app/page.tsx → components/prototype-v3.tsx이며 상태 모델은 lib/prototype.ts다. 이전 v1 어댑터를 현재 화면의 API로 오해하지 않는다.
- 루트에서 npm ci로 설치하고 npm run typecheck, npm test, npm run build로 필요한 검사를 수행한다. 이 폴더에서 동일한 명령도 동작한다.
- 백엔드 없이 시연이 가능해야 한다. 실제 API로 바꿀 때 서버 계약·실패 상태·권한을 함께 구현하고 문서를 갱신한다.
- sessionStorage·역할 선택·합성 AI를 실제 서버 저장·인증·AI로 설명하지 않는다.
- public/vendor/krds 원본을 직접 수정하지 않는다. 신규 공통 모듈은 named export를 우선하고 Next.js 특수 파일은 요구되는 default export를 사용한다.
- .next/와 out/은 생성물이다. 기본 export와 standalone 빌드 둘 다 고려한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
