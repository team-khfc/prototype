# 프로토타입 API 계약

기본 경로: `http://localhost:8080/api/v1`. JSON. 데모 API는 인증을 제공하지 않습니다. 명시적인 `demo` 프로필에서 로컬로만 사용합니다.

| 메서드·경로 | 응답 |
| --- | --- |
| GET `/workspace` | `{ requests: RequestItem[], config: Config }` |
| POST `/commands` | 명령 적용 후 동일한 전체 snapshot |

프런트엔드 형식은 `lib/domain.ts`의 `RequestItem`, `Config`, `Question`, `Note` 및 `lib/gateway.ts`의 `Command`를 기준으로 합니다.

## 검토 명령

```json
{
  "type": "complete",
  "requestId": "SF-2026-0123",
  "expectedVersion": 1,
  "role": "SECURITY",
  "text": "개인정보와 외부 연계 범위를 확인했습니다.",
  "checks": {"SECURITY-0": true, "SECURITY-1": true, "SECURITY-2": true}
}
```

| type | 목적 | 필수 추가 입력 |
| --- | --- | --- |
| `save-review` | 체크리스트·검토 의견 임시 저장 | checks, text(빈 문자열 허용) |
| `note` | 담당자 내부 메모 | 비어 있지 않은 text |
| `supplement` | 보완 대기로 변경, 요청 기록 | text, field |
| `complete` | 담당 사전 협의 완료 | 해당 role의 체크 3개, text |

공통: requestId, expectedVersion, role. role은 SECURITY, INFRA, ADMIN 중 하나입니다. 신청자 역할은 검토 명령을 실행하지 못합니다. 이는 인증 구현이 아닙니다.

## 관리자 명령

- `save-config`: expectedVersion, config. config는 수정할 전체 Config; 서버는 questions·workflow만 반영합니다.
- `publish-config`: expectedVersion. 저장된 초안을 게시본으로 복사하고 draftVersion을 증가시킵니다. 기존 신청은 수정하지 않습니다.

## 새 신청

```json
{"type":"create-request","title":"내부 업무포털 고도화","summary":"임직원 대상 업무 서비스를 개선합니다.","department":"디지털혁신부"}
```

현재 게시 버전을 configVersion으로 고정합니다.

## 오류

- 400: 누락된 내용, 검토 미완료, 완료 후 수정 등. `{ "message": "안내 문구" }`
- 409: expectedVersion 불일치. 새 snapshot을 조회한 뒤 사용자가 변경 내용을 다시 확인해야 합니다.

업무 변경과 이력 추가는 데모 서비스의 한 동기화 블록에서 수행합니다. 데이터는 메모리에만 유지됩니다.
