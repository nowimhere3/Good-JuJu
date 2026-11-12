"""Render one source asset without modifying it. Optional build-time PDF/TIFF support."""
import sys
from pathlib import Path
source,target=map(Path,sys.argv[1:3])
if source.suffix.lower()=='.pdf':
    import pymupdf
    with pymupdf.open(source) as doc:
        if len(doc)!=1: raise ValueError(f'Expected one PDF page for a legacy F/B face; found {len(doc)}. Rename a complete two-page card to a descriptive name such as Card001.pdf to avoid the F/B naming conflict.')
        doc[0].get_pixmap(matrix=pymupdf.Matrix(2,2),alpha=False).save(target)
else:
    from PIL import Image
    with Image.open(source) as im:
        if getattr(im,'n_frames',1)!=1: raise ValueError('Expected one image frame; split multi-frame scans first.')
        im.convert('RGB').save(target)
