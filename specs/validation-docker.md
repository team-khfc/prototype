# Docker 패키지 검증 기록

검증일: 2026-11-05 (Asia/Seoul)

## 확인된 범위

| 항목 | 결과 | 근거·제한 |
|---|---|---|
| v3 업무 상태 검사 | 통과 | `npm test`, 기존 의미 검증 13개 |
| TypeScript | 통과 | `npm run typecheck`, standalone 빌드 타입 검사 |
| Docker용 Next.js standalone 빌드 | 통과 | `NEXT_OUTPUT=standalone`, 테스트용 backend 주소로 빌드 |
| 기존 정적 호스팅 빌드 | 통과 | 기본 `npm run build`, `out/` 생성 및 타입 검사 |
| Next.js standalone 서버 | 통과 | 생성한 `server.js` 직접 실행, HTTP 200 |
| 웹 정적 자원 | 통과 | JS/CSS 8개, Pretendard GOV 폰트 HTTP 응답 |
| Maven / Java 21 | 통과 | Maven 3.10.0, Temurin 21.0.13, `mvn verify`, release 21 컴파일과 실행 JAR 생성 |
| Spring Boot v1 기존 테스트 | 통과 | WorkspaceServiceTest 3개, 실패·오류 0 |
| Spring Boot 실제 서버 기동 | 통과 | demo 프로필로 실행, `/api/v1/health` UP |
| 실제 API 프록시 | 통과 | Next.js → Spring Boot health / workspace 응답 |
| 프록시 POST 및 오류 상태 | 통과 | 기존 샘플 신청의 잘못된 revision 명령을 전송, HTTP 409 전달, 상태 변경 없음 |
| 준비 상태 검사 프로그램 | 통과 | Node HTTP 검사 성공; Java 21 검사에서 UP 성공, 모의 HTTP 503 / DOWN 실패 |
| Compose 문서 구조 | 통과 | YAML 파싱, build context 경로, health dependency, 포트·바인딩 설정 확인. Docker Compose 자체의 config 검사는 아님 |

HTTP 연동은 먼저 모의 백엔드로 전송을 확인한 뒤 **실제 Spring Boot JAR**로 다시 확인했습니다. 검증 프로세스는 종료했습니다. 프런트엔드 로컬 검증 런타임은 Node.js 24.22.1이며 Dockerfile의 Node.js 22 이미지 자체는 실행하지 않았습니다.

## 미검증·범위 제외

- Docker 엔진과 Compose CLI가 없는 실행 환경이므로 `docker compose build/up`, 이미지 pull, Docker 내부 DNS·권한·healthcheck 스케줄링은 미검증입니다.
- Windows Docker Desktop, Linux Docker Engine, Apple Silicon별 컨테이너 실행은 미검증입니다.
- Dockerfile은 프런트엔드 테스트·빌드와 백엔드 Maven 검증이 실패하면 이미지 빌드를 중단하도록 구성했습니다. 이것이 이 환경에서 실제 Docker 빌드를 수행했다는 의미는 아닙니다.
- UI 동작을 바꾸지 않는 패키징 작업이므로 이번 변경에서 브라우저 상호작용 전체를 반복 검증하지 않았습니다. 이전 v3 UI 검증은 `validation-v3.md`를 참고합니다.
- v3 UI의 sessionStorage와 v1 API 인메모리 저장소는 별개입니다. v3 업무·인증·AI·DB 통합 검증이 아닙니다.

## 사용자 환경 확인 명령

```bash
docker compose config
docker compose up --build -d
docker compose ps
docker compose exec -T frontend node scripts/docker-smoke.mjs
```

백엔드·프런트엔드가 모두 healthy이고 smoke 검사가 통과한 뒤 브라우저에서 시연을 진행합니다. 검증 명령은 업무 상태를 변경하지 않습니다.
