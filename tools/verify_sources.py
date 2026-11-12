"""Verify every original against its recorded hash without modifying files."""
import hashlib, json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
inventory=json.loads((root/'data/r1-inventory.json').read_text(encoding='utf-8'))
failures=[]
for item in inventory['inventory']:
    file=root/'Vortex Cards-R1'/item['file']
    if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest()!=item['sha256']:
        failures.append(item['file'])
if failures: raise SystemExit(f'Original verification FAILED: {failures}')
print(f'PASS: all {len(inventory["inventory"])} original source files match their recorded SHA-256 checksums.')
