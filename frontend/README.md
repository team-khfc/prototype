# Frontend

React 19 + Next.js 16 App Router + TypeScript 기반의 프론트엔드 우선 프로토타입입니다.

## 실행

최초 설치는 저장소 루트에서 `npm ci`를 실행합니다. 이후 이 폴더에서:

```bash
npm run dev
npm run typecheck
npm test
npm run build
```

localhost:3000에서 개발합니다. `npm run build`는 정적 export이며 결과는 이 폴더의 `out/`입니다. 루트 `npm run build`는 이를 루트 `out/`으로도 복사합니다.

## 수정 위치

| 작업 | 파일/폴더 |
|---|---|
| 첫 화면·메타데이터 | `app/page.tsx`, `app/layout.tsx` |
| 내비게이션·역할·세션·시연 안내 | `components/prototype-v3.tsx` |
| 업무 요약 | `features/dashboard/workspace-overview.tsx` |
| 신청 목록·검색·필터 | `features/request-list.tsx` |
| 새 신청 4단계 | `features/request-create.tsx` |
| 검토·보완·최종 제출 | `features/request-detail.tsx` |
| 문서함 | `features/documents/document-center.tsx` |
| 기관 질문·워크플로 설정 | `features/admin-v3.tsx` |
| 업무 상태와 저장 | `lib/prototype.ts` |
| 공통 스타일 | `app/globals.css`, `app/workspace.css` |
| 공통 UI | `components/ui/v3.tsx` |

기존 파일명의 v3는 업무 시연 모델의 버전이며 Next.js 버전이 아닙니다. `components/workspace.tsx`, `lib/gateway.ts`는 사용하지 않는 이전 v1 참고 코드입니다. 새 기능은 현재 진입점에서 개발합니다.

## API 연동 경계

현재 `readState`·`commitState`는 브라우저 세션 저장소를 사용합니다. `BACKEND_INTERNAL_URL` 설정만으로 실제 업무 연동으로 바뀌지 않습니다.

개발 서버와 standalone 서버는 `/api/*`를 Spring Boot로 전달합니다. `.env.example`을 `.env.local`로 복사하면 내부 주소를 변경할 수 있습니다. 기본값은 `http://127.0.0.1:8080`입니다. 정적 export에는 프록시가 없고 업무 화면은 동일한 시연 모드입니다.

백엔드를 별도 실행한 뒤 `http://localhost:3000/api/v1/drafts`에서 빈 배열 또는 저장한 샘플을 확인할 수 있습니다. 실제 신청 연동 시 `specs/spring-v3-contract.md`의 계약과 `lib/prototype.ts`의 상태 모델을 먼저 합의하고 API 어댑터를 추가하세요. `NEXT_PUBLIC_API_BASE_URL`은 현재 화면의 전환 스위치가 아닙니다.

샘플 데이터만 사용하세요. 파일 본문 업로드·AI·인증은 아직 없습니다.
