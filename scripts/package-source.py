from pathlib import Path
import io
import zipfile
root = Path(__file__).resolve().parents[1]
destination = root / 'frontend' / 'public' / 'secureflow-prototype-source.zip'
excluded = {'node_modules', '.next', 'out', '.git', '.openai', 'target', 'build', '.gradle', 'data', '__pycache__'}
files = sorted(p for p in root.rglob('*') if p.is_file() and not any(part in excluded for part in p.relative_to(root).parts) and p.suffix != '.zip' and not p.name.endswith('.tsbuildinfo') and (not p.name.startswith('.env') or p.name == '.env.example'))
# One source snapshot keeps the UI's download link working in the unpacked
# Docker project. The snapshot excludes archives, so it never nests recursively.
snapshot = io.BytesIO()
with zipfile.ZipFile(snapshot, 'w', zipfile.ZIP_DEFLATED) as archive:
    for p in files:
        archive.write(p, Path('secureflow-prototype') / p.relative_to(root))
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
    for p in files:
        archive.write(p, Path('secureflow-prototype') / p.relative_to(root))
    archive.writestr('secureflow-prototype/frontend/public/secureflow-prototype-source.zip', snapshot.getvalue())
print(f'Packaged {len(files)} source files: {destination} ({destination.stat().st_size:,} bytes)')
