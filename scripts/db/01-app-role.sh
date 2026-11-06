#!/bin/sh
set -eu
# 환경변수를 psql 안에서 읽어 프로세스 인수와 SQL 문자열 직접 조립을 피한다.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 <<'SQL'
\getenv app_password SA_DB_PASSWORD
SELECT format('CREATE ROLE boan_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'app_password') \gexec
GRANT CONNECT ON DATABASE securityadvisor TO boan_app;
GRANT USAGE ON SCHEMA public TO boan_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO boan_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO boan_app;
SQL

