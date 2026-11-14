from atlas.search.domain.chunk import SearchHit
from atlas.search.domain.ports import ChunkRepository, Embedder


async def search_documents(query: str, k: int, embedder: Embedder, repository: ChunkRepository) -> list[SearchHit]:
    return await repository.search(await embedder.embed_query(query), k)
