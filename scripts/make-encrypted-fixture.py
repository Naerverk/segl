"""Creates tests/fixtures/encrypted-aes256.pdf (user password: test123).

Requires: pip install pypdf cryptography
Usage:    node scripts/make-fixtures.ts && python3 scripts/make-encrypted-fixture.py
pdf-lib cannot encrypt, so this one fixture is produced with pypdf and committed.
"""
import sys
from pathlib import Path
from pypdf import PdfReader, PdfWriter

root = Path(__file__).resolve().parent.parent
src = root / "tests" / "fixtures" / "out" / "plain-for-encryption.pdf"
dst = root / "tests" / "fixtures" / "encrypted-aes256.pdf"
if not src.exists():
    sys.exit(f"missing {src} – run `node scripts/make-fixtures.ts` first")
writer = PdfWriter(clone_from=PdfReader(src))
writer.encrypt(user_password="test123", owner_password="owner-secret", algorithm="AES-256")
with dst.open("wb") as f:
    writer.write(f)
print("wrote", dst)
