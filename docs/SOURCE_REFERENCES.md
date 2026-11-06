# 개발 시작점의 참조 기록

## 2026-11-07 팀 시작점

이 절은 이번 구현에 사용한 참조의 스냅샷이다. 다음 화면 작업은 그 시점의 prototype-soo 기본 브랜치 최신본과 `MERGE_NOTES.md`를 다시 확인한다. 아래 SHA를 규칙 문서의 영구 고정 시안으로 사용하지 않는다.

| 대상 | 참조 |
|---|---|
| 개발 저장소 기준 | [team-khfc/prototype](https://github.com/team-khfc/prototype), 기본 브랜치 기준 `d0c2d4bd742ae80041df10ca7c72aa2e485d797f` |
| 이번 화면 참고 원본 | [team-khfc/prototype-soo](https://github.com/team-khfc/prototype-soo) |
| 구현 직전 확인한 시안 | [`1af32fb424ea79a1a4ce60484a83f9d1935fef25`](https://github.com/team-khfc/prototype-soo/tree/1af32fb424ea79a1a4ce60484a83f9d1935fef25) |
| 병합 메모 | [해당 커밋의 MERGE_NOTES.md](https://github.com/team-khfc/prototype-soo/blob/1af32fb424ea79a1a4ce60484a83f9d1935fef25/MERGE_NOTES.md) |
| 시안 미리보기 | [team-khfc.github.io/prototype-soo](https://team-khfc.github.io/prototype-soo/) — 이후 변경될 수 있음 |
| 구현 결정 | [ADR 0004](adr/0004-team-development-starter.md) |

업무 단계·상태·권한은 FUNCTIONAL_SPEC을 따른다. 시안의 브라우저 저장소·역할 전환·CDN·AI 모의는 서비스 구현 기준으로 사용하지 않는다. `design.md`와 prototype-soo 원본은 이 작업에서 수정하지 않는다. 시안과 현행 문서의 차이는 [alignment-notes.md](alignment-notes.md)에 남겼다.

### 참조한 규칙 문서

| 저장소 파일 | 이번 기준 버전 | 개정일 |
|---|---|---|
| INSTRUCTIONS.md | v1.8 | 2026-11-07 |
| PROJECT_CONTEXT.md | v2.7 | 2026-11-07 |
| FUNCTIONAL_SPEC.md | v1.7 | 2026-11-07 |
| AGENTS.md | v1.10 | 2026-11-07 |
| PROJECT_RULES.md | v1.10 | 2026-11-07 |
| CONTRIBUTING.md | v0.11 | 2026-11-07 |
| CODING_STYLE.md | v0.4 | 2026-11-07 |
| SECURE_CODING.md | v1.2 | 2026-11-07 |
| design.md | v3.1 | 2026-11-06 |

현재 표의 권위는 PROJECT_CONTEXT 5장에 있다. `python3 tools/check_doc_versions.py`는 그 표와 로컬 머리말을 비교한다. 기존 저장소의 루트 `INSTRUCTIONS.md`를 읽으며, `claude/INSTRUCTIONS.md`를 추가 복제하지 않는다.

이전 API·화면 매핑·검증 결과는 아래와 기존 파일에 역사 기록으로 보존한다. 이번 결과는 [verification-starter.md](verification-starter.md)에서 따로 확인한다. 신규 API는 [starter-api.md](starter-api.md), 팀별 인수 경로는 [development-handoff.md](development-handoff.md)가 안내한다.

## 2026-11-06 이전 구현의 원본 참조 — 역사 기록

아래 내용은 당시 작업의 기록이다. 현재 시안 원본·규칙 버전·개발 저장소 정책을 정하는 문서로 사용하지 않는다.

확인일: 2026-11-06. 아래는 이번 작업에서 읽은 사용자 제공 파일의 바이트 식별자다. 파일명 앞 숫자는 제공 파일 구분용이다. 개인 연락처와 실존 팀원 정보를 산출물에 다시 넣지 않기 위해 원문 전체를 복제하지 않았다.

| 사용한 제공 파일 | 프로젝트에서의 역할 | SHA-256 |
|---|---|---|
| `06-AGENTS.md` | `AGENTS.md` | `43379a6a898015ca80307e39f50fb4c71d5bf657da6d32086692528a54e62622` |
| `07-PROJECT_RULES.md` | `claude/PROJECT_RULES.md` | `b7c003109a2554b9665de4540051b7db1a5886885d8914869233ec0e9ba8a164` |
| `03-CODING_STYLE.md` | `CODING_STYLE.md` | `56ec1c6b1a5611f3b686981522e63924c587c4a0bf27fa8e1ac3d827c6b753dc` |
| `02-SECURE_CODING.md` | `claude/SECURE_CODING.md` | `9eb1038e5cc43001f423a643f8d89777c74661377563832e7e98a86cbc155136` |
| `04-CONTRIBUTING.md` | `CONTRIBUTING.md` | `cd70b5444daaae68b3a399296462d7075cf194214007217e1edecc2ed50427f6` |
| `01-design.md` | `design.md` | `3d47509f663d5b4dd28938601b8b00a8c09e3565b8e6d5f6edc841602f6229da` |

`claude/PROJECT_CONTEXT.md` 원문은 제공 파일과 확인 가능한 본 저장소에서 발견하지 못했다. 그 내용이나 새로운 확정 결정을 만들어 내지 않고 현재 대화의 프로젝트 범위와 제공 규칙을 사용했다. 구현 가정은 `docs/adr/`에 별도로 기록했다.

## 디자인 원본

- 저장소: https://github.com/team-khfc/prototype
- 경로: `보안길잡이 디자인시안 프로토타입/`
- 분기: `main`에서 이번 작업에 새로 가져온 파일. 보관 저장소에는 변경하지 않았다.
- `01-workspace.html` Git blob: `494f23663e48aedb8c4d81105dd8296bddddbea5`
- `02-requests.html` Git blob: `bc6304f74b643a335a4ecc5bcb560a49bf3fbc0f`
- `assets/css/styles.css` Git blob: `cad39a2f48c992affac4eae8f79b4931ce671f86`
- `assets/css/tokens.css` Git blob: `adf0a09d9099298661cc047dcd2706d071f3ddd4`
- `assets/css/workspace.css` Git blob: `45829fffb7372ee540acfd17c8fcfe121a75bd08`
- `assets/vendor/krds/css/token/krds_tokens.css` Git blob: `1dbf354b60dfe6808823b4878b3f15c05dae6b3f`

화면 매핑·변경 이유·공급 라이선스는 `DESIGN_MAPPING.md`와 프런트엔드 자산에 보존했다. 직전 생성물의 애플리케이션 소스는 읽거나 복사하지 않았다.
