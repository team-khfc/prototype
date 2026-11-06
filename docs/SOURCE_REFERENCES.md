# 이번 구현의 원본 참조

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
