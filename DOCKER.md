# Docker 실행

Docker Desktop 또는 Docker Engine + Compose v2가 필요합니다. 저장소 루트에서 실행합니다.

## 프론트엔드부터 실행

```bash
docker compose up --build -d
docker compose ps
docker compose exec -T frontend node scripts/docker-smoke.mjs
```

http://localhost:3000 에서 화면 전체를 체험합니다. 기본 실행에는 backend를 포함하지 않으며 백엔드가 없어도 신청·검토 시연이 동작합니다.

## 백엔드도 실행

```bash
docker compose --profile full up --build -d
docker compose --profile full ps
docker compose exec -T frontend node scripts/docker-smoke.mjs --api
```

백엔드가 healthy가 된 뒤 API 검사를 실행하세요. 상태 주소는 http://localhost:8080/actuator/health 입니다. Next.js 프록시를 통해 http://localhost:3000/api/v1/drafts 도 확인할 수 있습니다.

Docker의 H2는 메모리 DB로 백엔드 컨테이너 종료·재시작 시 초기화됩니다. H2 Console은 container 프로필에서 비활성화합니다. 로컬 파일 DB와 Console 사용법은 backend/README.md를 참고하세요.

## 포트·종료

`.env.example`을 `.env`로 복사해 WEB_PORT/API_PORT를 변경할 수 있습니다. 호스트 바인딩은 127.0.0.1입니다.

```bash
docker compose --profile full logs --tail=100
docker compose --profile full down
```

프론트 이미지는 `frontend/Dockerfile`을 저장소 루트 컨텍스트로 빌드합니다. npm workspace·루트 lockfile을 함께 복사합니다. 백엔드는 `backend/` 컨텍스트에서 Wrapper로 test·bootJar를 실행합니다. Node.js 22와 Java 21을 각각 사용하며 런타임은 root 사용자로 실행하지 않습니다.

현재 UI는 sessionStorage 시연입니다. full 프로필로 실행해도 자동으로 서버 저장으로 바뀌지 않습니다. 실제 업무 연동·인증·AI는 후속 개발입니다.

검증 환경에는 Docker 실행 파일/데몬이 없습니다. Docker 이미지·Compose의 실제 기동은 확인하지 못했으며, 별도로 Next standalone 서버·프록시와 Gradle 테스트를 확인한 결과는 specs/validation-frontend-backend.md에 기록합니다.
