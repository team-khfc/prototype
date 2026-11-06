# 재생성본의 참조 출처

확인일: 2026-11-06. 최신 사용자 제공 MD와 GitHub 디자인 시안을 기준으로 구현했다. 아래 해시는 수정 전 제공 파일의 식별자이며, 공유 사본에서는 실존 팀원 이름·연락처를 역할명으로 치환했다. 디자인 문서의 이전 브랜드·검토 순서와 낡은 경로는 최신 확정 명세에 맞춰 명시적으로 정리했다. 원본 파일을 동일 바이트로 복제했다는 의미가 아니다.

| 원본 문서 | 구현에서 참조하는 사본 | 원본 SHA-256 |
|---|---|---|
| PROJECT_CONTEXT.md | claude/PROJECT_CONTEXT.md | `e90a4e90f75b5b2c20ea7213096c79893ff6774d4033868cd39e021792ee5a4f` |
| FUNCTIONAL_SPEC.md | claude/FUNCTIONAL_SPEC.md | `5792f2cdfc466ae7e4593090075c897c5fe656176694b4a37ce4c79d343b514d` |
| AGENTS.md | AGENTS.md | `370d8ea471bb76c039393bcfc1dfdd79c3a8f8a7bb5edf5050f5926b7bd1d10a` |
| PROJECT_RULES.md | claude/PROJECT_RULES.md | `22a571f4b20534e22afab7d7fac231597d602f2e6cb7626c97c1a3d1c57d84b5` |
| CODING_STYLE.md | CODING_STYLE.md | `56ec1c6b1a5611f3b686981522e63924c587c4a0bf27fa8e1ac3d827c6b753dc` |
| SECURE_CODING.md | claude/SECURE_CODING.md | `9eb1038e5cc43001f423a643f8d89777c74661377563832e7e98a86cbc155136` |
| CONTRIBUTING.md | CONTRIBUTING.md | `9652edfe3d51b9acbd161a5c5137fd511d00a8b7a8ff17f39f2ecc1c9750e175` |
| design.md | design.md | `3d47509f663d5b4dd28938601b8b00a8c09e3565b8e6d5f6edc841602f6229da` |

## GitHub 디자인 원본

- 저장소: https://github.com/team-khfc/prototype
- 참조 커밋: `07c2b598d2da27fbbd5f8a694d3fdfddf42bb4e1` (디자인시안 업데이트)
- 경로: `보안길잡이 디자인시안 프로토타입/`
- 주요 화면: requests, new-request, request-detail, submitted, supplements, documents, network, history, policies, settings.
- 원본 HTML·CSS·로고·폰트·샘플 문서는 변경하지 않는다. 프론트의 실행용 복사본과 React 컴포넌트는 별도로 관리한다.

## 기준 충돌의 처리

기능과 불변식은 최신 PROJECT_CONTEXT·FUNCTIONAL_SPEC을 따른다. 시안의 가짜 저장·역할 선택·AI 성공 문구는 실제 서버 동작으로 간주하지 않는다. 이전 디자인 문서의 SECURITY 선행·병렬 선택은 1차 범위의 INFRA 선행 고정으로 대체한다. 이전 Java 21·원본 16개 화면·두 외부 모델 실증 문구를 현재 구현의 근거로 사용하지 않는다.

세부 해시와 수정 사유는 [source-manifest.json](source-manifest.json), 구현 결정은 [ADR 0004](adr/0004-securityadvisor-regeneration.md)·[ADR 0005](adr/0005-spring-ai-and-public-knowledge.md), 실제 검증은 [VERIFICATION.md](VERIFICATION.md)에 기록한다.
