"""JSON file cache of UI answers for the demo questions: {"v2|" + normalized question: {question, summary, components}}.

The key carries a contract version: bump CACHE_VERSION whenever the UI contract or the tone
changes so older entries are never served. `get` also validates the entry against UIPayload;
an entry that does not validate is a miss.

Commit the file to ship pre-warmed demo answers; delete an entry to regenerate it.
"""

import json
import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from atlas.agents.domain.ui import UIPayload

log = logging.getLogger(__name__)


CACHE_VERSION = "v2"


def normalize(question: str) -> str:
    text = unicodedata.normalize("NFKD", question.casefold())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    # Comparison signs change the question ("O2 > 30" is not "O2 < 30"): keep them as separate tokens.
    text = re.sub(r"([<>=≤≥])", r" \1 ", text)
    text = re.sub(r"[^\w\s<>=≤≥-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _key(question: str) -> str:
    return f"{CACHE_VERSION}|{normalize(question)}"


class FileQueryCache:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._entries: dict[str, dict[str, Any]] = self._read()

    def get(self, question: str) -> dict[str, Any] | None:
        entry = self._entries.get(_key(question))
        if not isinstance(entry, dict) or "summary" not in entry or "components" not in entry:
            return None
        ui = {"summary": entry["summary"], "components": entry["components"]}
        try:
            UIPayload.model_validate(ui)
        except ValidationError:
            log.warning("ignoring a cached answer that no longer matches the UI contract")
            return None
        return ui

    def put(self, question: str, ui: dict[str, Any]) -> None:
        self._entries[_key(question)] = {
            "question": question,
            "summary": ui["summary"],
            "components": ui["components"],
        }
        self._write()

    def _read(self) -> dict[str, dict[str, Any]]:
        if not self._path.exists():
            return {}
        try:
            entries = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            log.warning("ignoring unreadable query cache at %s", self._path)
            return {}
        if not isinstance(entries, dict):
            log.warning("ignoring query cache with an unexpected shape at %s", self._path)
            return {}
        return entries

    def _write(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._entries, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        os.replace(tmp, self._path)
