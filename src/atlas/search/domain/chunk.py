"""A citable piece of PSI text and a search result built from one."""

import hashlib
from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    experiment_id: str
    source_file: str
    section: str
    content: str

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.content.encode("utf-8")).hexdigest()

    @property
    def key(self) -> "ChunkKey":
        return (self.experiment_id, self.source_file, self.content_hash)


ChunkKey = tuple[str, str, str]


@dataclass(frozen=True)
class SearchHit:
    experiment_id: str
    source_file: str
    section: str | None
    content: str
    score: float
