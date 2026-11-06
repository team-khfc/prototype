#!/usr/bin/env python3
"""로컬 .env를 셸 코드로 실행하지 않고 Spring Boot 개발 서버를 시작한다."""
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
configuration = root / '.env'
if not configuration.exists():
    raise SystemExit('먼저 python3 scripts/init-demo.py를 실행해 주세요.')
environment = dict(os.environ)
for line in configuration.read_text(encoding='utf-8').splitlines():
    if not line or line.startswith('#'):
        continue
    name, separator, value = line.partition('=')
    if not separator or not name.startswith('BOAN_'):
        raise SystemExit('.env의 BOAN_* 설정 형식을 확인해 주세요.')
    environment[name] = value
environment['SPRING_PROFILES_ACTIVE'] = 'local'
wrapper = 'gradlew.bat' if os.name == 'nt' else './gradlew'
try:
    result = subprocess.run([wrapper, 'bootRun'], cwd=root/'backend', env=environment)
    raise SystemExit(result.returncode)
except KeyboardInterrupt:
    raise SystemExit(130)
