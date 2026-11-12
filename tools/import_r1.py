"""Compatibility entry point: use the non-destructive folder-driven deck indexer."""
import subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
subprocess.run(["node",str(root/"tools/index-decks.mjs")],cwd=root,check=True)
