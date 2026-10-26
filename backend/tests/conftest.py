import os
import tempfile

# Settings are read at import time; point them at a throwaway SQLite file so tests
# never need the real database or a .env file. (A file, not :memory:, because
# database.py passes pool options that the in-memory SQLite pool rejects.)
_db = os.path.join(tempfile.mkdtemp(prefix="resume-tests-"), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
