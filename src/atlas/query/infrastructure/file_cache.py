"""JSON file cache of UI answers for the demo questions: {normalized question: {question, summary, components}}.

Commit the file to ship pre-warmed demo answers; delete an entry to regenerate it.
"""

import json
import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)


def normalize(question: str) -> str:
    text = unicodedata.normalize("NFKD", question.casefold())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^\w\s-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


class FileQueryCache:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._entries: dict[str, dict[str, Any]] = self._read()

    def get(self, question: str) -> dict[str, Any] | None:
        entry = self._entries.get(normalize(question))
        if entry is None:
            return None
        return {"summary": entry["summary"], "components": entry["components"]}

    def put(self, question: str, ui: dict[str, Any]) -> None:
        self._entries[normalize(question)] = {
            "question": question,
            "summary": ui["summary"],
            "components": ui["components"],
        }
        self._write()

    def _read(self) -> dict[str, dict[str, Any]]:
        if not self._path.exists():
            return {}
        try:
            return json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            log.warning("ignoring unreadable query cache at %s", self._path)
            return {}

    def _write(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._entries, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        os.replace(tmp, self._path)
