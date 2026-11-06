# 보안길잡이 — 지정 시안 기반 새 프런트엔드

사용자가 지정한 GitHub 디자인 시안을 React 공통 컴포넌트로 이식한 Next.js App Router 프로젝트입니다. 전체 화면 대응·원본 자산·변경 이유는 `../docs/DESIGN_MAPPING.md`, 업무 API는 `../docs/CONTRACT.md`를 확인하세요.

## 실행

```sh
npm ci
npm run dev
```

기본 API 프록시 목적지는 `http://localhost:8080`입니다. 다른 주소는 실행/빌드 환경의 `API_ORIGIN`으로 지정합니다. 브라우저는 같은 출처의 `/api`만 호출합니다. `API_ORIGIN`은 Next 빌드 시 프록시 구성에 반영되므로 Docker 빌드에는 알맞은 build arg를 설정합니다.

- `/login`: 서버 발급 계정 로그인. 암호를 코드에 포함하지 않습니다.
- `/workspace`: 인증된 업무 공간. 역할·기관은 서버 세션을 따릅니다.
- `/design-preview/workspace`: 업무 API를 호출하지 않는 공개 읽기전용 디자인 시안.

## 검사

```sh
npm run check
npm run build
```

`check`는 Prettier, TypeScript strict, ESLint, Vitest + Testing Library를 순서대로 실행합니다. 검사는 실행 결과만 보고합니다. 최종 실제 LLM 연결·서버 권한·DB 제출본 불변성 검증은 백엔드 통합 검사 결과를 확인하세요.

## 구현 경계

- `app/`: Next 경로와 공급자, 인증 레이아웃.
- `components/`: 지정 시안의 공통 셸·토큰·상태·입력·대화상자.
- `features/auth`: 실제 세션, 60초 전 연장 안내, 계정별 휘발성 초안.
- `features/procedure`: 단계별 신청, 명시적 분석·후보 적용, 담당자 검토, 보완·제출·접수, 문서함.
- `features/institution`: 기관 질문·절차·버전·모델·기관 컨텍스트.
- `features/knowledge`: 공개 참고 자료.
- `features/preview`: API 연결 없는 합성 fixture와 공통 화면의 읽기전용 조합.
- 각 기능의 `types.ts`: 서버 DTO와 같은 모양의 Zod 응답 스키마와 타입.
- `lib/http.ts`: 공통 HTTP 경로, CSRF, 구조화 오류, Zod 응답 검증, 이전 신원 응답 폐기.
- `public/assets/`: 수정하지 않은 지정 시안 CSS·KRDS 토큰·폰트와 라이선스.

초안은 동일 탭의 메모리에만 임시 보관합니다. 새로고침·브라우저 종료 후 복구 기능을 제공하지 않습니다. 명시적 로그아웃 또는 다른 계정 로그인에서는 메모리 초안과 서버 캐시를 지웁니다. 세션 만료 후 같은 계정으로 재로그인하면 탭에 남은 입력을 다시 확인할 수 있습니다.
