#!/usr/bin/env python3
"""새 프로토타입이 폐기한 예제 실행 경로에 다시 의존하는지 확인한다."""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
RETIRED = [
    "backend/src/main/java/kr/securityadvisor/procedure",
    "backend/src/main/java/kr/securityadvisor/analysis",
    "backend/src/main/java/kr/securityadvisor/institution",
    "frontend/features/procedure",
    "frontend/features/institution",
    "frontend/features/preview",
    "frontend/app/(authenticated)",
    "frontend/app/design-preview",
    "보안길잡이 디자인시안 프로토타입",
]
FORBIDDEN = re.compile(
    r"kr\.securityadvisor\.(?:procedure|analysis|institution)\."
    r"|@/features/(?:procedure|institution|preview)(?:[/'\"])"
    r"|/api/(?:procedures|institution-settings)(?:[/\"'\s])"
    r"|BOAN_"
)
SOURCE_ROOTS = [
    "backend/src/main/java",
    "frontend/app",
    "frontend/features",
    "frontend/components",
    "frontend/lib",
]


def main() -> int:
    """이력 보존용 SQL과 문서는 제외하고 현재 실행 소스만 검사한다."""
    errors = []
    for relative in RETIRED:
        if (ROOT / relative).exists():
            errors.append(f"폐기한 경로가 남아 있습니다: {relative}")
    count = 0
    for relative in SOURCE_ROOTS:
        for path in (ROOT / relative).rglob("*"):
            if not path.is_file() or path.suffix not in {".java", ".ts", ".tsx"}:
                continue
            count += 1
            if FORBIDDEN.search(path.read_text(encoding="utf-8")):
                errors.append(f"이전 예제 의존이 있습니다: {path.relative_to(ROOT)}")
    for error in errors:
        print("FAIL: " + error, file=sys.stderr)
    if errors:
        return 1
    print(f"PASS: 실행 소스 {count}개에 이전 예제 패키지·API·환경변수 의존이 없습니다.")
    print("기존 Flyway SQL·DB role은 변경하지 않으며 현재 실행 구조 검사에서 제외합니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
