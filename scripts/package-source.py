from pathlib import Path
import zipfile
root = Path(__file__).resolve().parents[1]
destination = root / 'public' / 'secureflow-prototype-source.zip'
excluded = {'node_modules', '.next', 'out', '.git', '.openai', 'target'}
files = [p for p in root.rglob('*') if p.is_file() and not any(part in excluded for part in p.relative_to(root).parts) and p != destination and not p.name.endswith('.tsbuildinfo') and (not p.name.startswith('.env') or p.name == '.env.example')]
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
    for p in files:
        archive.write(p, Path('secureflow-prototype') / p.relative_to(root))
print(f'Packaged {len(files)} source files: {destination} ({destination.stat().st_size:,} bytes)')
