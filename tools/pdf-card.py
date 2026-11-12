"""Validate/render a two-page card locally; never write to the source PDF."""
import json
import sys
from pathlib import Path
import pymupdf

source = Path(sys.argv[1])
if source.stat().st_size > 30 * 1024 * 1024:
    raise ValueError('PDF exceeds the 30 MB per-file limit.')
with pymupdf.open(source) as doc:
    if doc.is_encrypted or doc.metadata.get('encryption'):
        raise ValueError('Encrypted PDFs are not supported. Export an unencrypted copy.')
    if doc.is_repaired:
        raise ValueError('PDF is damaged and required repair; export a clean copy.')
    if len(doc) != 2:
        raise ValueError(f'Expected exactly two pages (front/back); found {len(doc)}.')
    for page in doc:
        if min(page.rect.width, page.rect.height) <= 0:
            raise ValueError('PDF has invalid page dimensions.')
    if len(sys.argv) > 2:
        prefix = sys.argv[2]
        for i, page in enumerate(doc):
            scale = min(2, 2400 / max(page.rect.width, page.rect.height))
            page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False).save(f'{prefix}-{i+1}.png')
    print(json.dumps({'pages': 2}))
