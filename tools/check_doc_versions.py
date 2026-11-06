#!/usr/bin/env python3
"""Check repository document headers against PROJECT_CONTEXT's official table."""

import argparse
from datetime import date
from pathlib import Path
import re
import sys


REQUIRED_DOCUMENTS = {
    "INSTRUCTIONS.md",
    "PROJECT_CONTEXT.md",
    "FUNCTIONAL_SPEC.md",
    "AGENTS.md",
    "PROJECT_RULES.md",
    "CONTRIBUTING.md",
    "CODING_STYLE.md",
    "SECURE_CODING.md",
    "design.md",
}
VERSION = re.compile(r"(?<![\w.])v(\d+(?:\.\d+)+)(?![\d.])")
DATE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")


def read_baseline(root: Path) -> dict[str, tuple[str, str]]:
    """Read only the official version table, without adopting historical versions."""
    context = (root / "PROJECT_CONTEXT.md").read_text(encoding="utf-8")
    section = re.search(
        r"^## 5\. 기준 버전 표[^\n]*\n(.*?)(?=^## |\Z)",
        context,
        flags=re.MULTILINE | re.DOTALL,
    )
    if section is None:
        raise ValueError("PROJECT_CONTEXT.md 5장 기준 버전 표를 찾을 수 없습니다.")
    baseline = {}
    for line in section.group(1).splitlines():
        if not line.startswith("|"):
            continue
        cells = [cell.strip().strip("`*") for cell in line.strip("|").split("|")]
        if len(cells) < 3 or cells[0] not in REQUIRED_DOCUMENTS:
            continue
        name, version, revised = cells[:3]
        if name in baseline:
            raise ValueError(f"기준표에 {name} 행이 중복되어 있습니다.")
        match = VERSION.fullmatch(version)
        if match is None:
            raise ValueError(f"{name}: 기준표 버전 형식이 올바르지 않습니다: {version}")
        date.fromisoformat(revised)
        baseline[name] = (match.group(1), revised)
    missing = REQUIRED_DOCUMENTS - baseline.keys()
    if missing:
        raise ValueError("기준표에 문서가 없습니다: " + ", ".join(sorted(missing)))
    return baseline


def document_path(root: Path, name: str) -> Path:
    """Accept the existing summary location, but reject multiple active copies."""
    if name != "INSTRUCTIONS.md":
        return root / name
    candidates = [root / "claude" / name, root / name]
    present = [path for path in candidates if path.is_file()]
    if len(present) > 1:
        raise ValueError("INSTRUCTIONS.md 사본이 루트와 claude/에 중복되어 있습니다.")
    if not present:
        raise ValueError("INSTRUCTIONS.md가 루트 또는 claude/에 필요합니다.")
    return present[0]


def read_header(path: Path) -> tuple[str, str]:
    """Read the leading version and date; changes described later are not headers."""
    header = "\n".join(path.read_text(encoding="utf-8").splitlines()[:8])
    if path.name == "design.md":
        version = re.search(r"문서 버전:\s*\*?\*?(\d+(?:\.\d+)+)", header)
    else:
        version = VERSION.search(header)
    revised = DATE.search(header)
    if version is None or revised is None:
        raise ValueError(f"{path.name}: 머리말 버전·개정일을 찾을 수 없습니다.")
    date.fromisoformat(revised.group(0))
    return version.group(1), revised.group(0)


def main() -> int:
    """Return nonzero for missing, duplicate, malformed, or mismatched documents."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="검사할 저장소 루트 (기본값: 이 스크립트의 상위 저장소)",
    )
    root = parser.parse_args().root.resolve()
    try:
        baseline = read_baseline(root)
    except (OSError, ValueError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    errors = []
    for name, expected in baseline.items():
        try:
            path = document_path(root, name)
            actual = read_header(path)
            if actual != expected:
                raise ValueError(
                    f"{name}: 저장소 v{actual[0]} / {actual[1]} "
                    f"!= 기준 v{expected[0]} / {expected[1]}"
                )
            print(f"OK: {path.relative_to(root)} v{actual[0]} / {actual[1]}")
        except (OSError, ValueError) as error:
            errors.append(str(error))
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print(f"PASS: {len(baseline)}개 문서의 머리말 버전·개정일이 기준표와 일치합니다.")
    print("검사 범위: 로컬 버전·개정일. 문서 내용·외부 사본·설정 지침 칸은 별도 확인합니다.")
    if (root / "INSTRUCTIONS.md").is_file():
        print("INFO: 기존 저장소 루트 INSTRUCTIONS.md를 검사했습니다. 경로 변경은 수행하지 않습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
