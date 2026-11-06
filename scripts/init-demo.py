#!/usr/bin/env python3
"""실제 비밀값을 소스에 넣지 않고 로컬 합성 시연 환경을 준비한다."""
import base64
import os
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
destination = root / ".env"
if destination.exists():
    raise SystemExit("기존 .env를 유지했습니다. 이미 생성한 암호와 암호화 키를 사용해 주세요.")

def create_password():
    return "Aa9" + secrets.token_urlsafe(27)

values = {
    "SA_DB_USER": "boan_app",
    "SA_DB_PASSWORD": create_password(),
    "SA_MIGRATION_USER": "boan_migrator",
    "SA_MIGRATION_PASSWORD": create_password(),
    "SA_DB_URL": "jdbc:postgresql://localhost:5432/securityadvisor",
    "SA_CONTEXT_KEY": base64.b64encode(secrets.token_bytes(32)).decode("ascii"),
    "SA_DEMO_ENABLED": "true",
    "SA_DEMO_APPLICANT_PASSWORD": create_password(),
    "SA_DEMO_SECURITY_PASSWORD": create_password(),
    "SA_DEMO_INFRA_PASSWORD": create_password(),
    "SA_DEMO_ADMIN_PASSWORD": create_password(),
    "SA_OPENAI_API_KEY": "",
    "SA_GEMMA_API_KEY": "",
    "SA_ALLOWED_LLM_ENDPOINTS": "https://api.openai.com/v1/chat/completions,https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent",
    "SA_WEB_PORT": "3000",
    "SA_API_PORT": "8080",
    "SA_DB_PORT": "5432",
}
descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
    stream.write("# 합성 시연 전용. Git 및 공유 산출물에 포함하지 마세요.\n")
    for name, value in values.items():
        stream.write(f"{name}={value}\n")
print(".env 생성 완료. 역할별 비밀번호는 SA_DEMO_*_PASSWORD 값을 확인하세요.")
print("docker compose --profile app up -d --build 후 http://localhost:3000 에 접속하세요.")

