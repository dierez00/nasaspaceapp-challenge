"""Language of the text the user reads. Spanish is the default so older clients keep working."""

from typing import Literal

Lang = Literal["es", "en"]
DEFAULT_LANG: Lang = "es"

# Appended to what the analyst and researcher read: their prompts ask for Spanish.
ENGLISH_NOTE = (
    "Idioma de la respuesta: inglés. Escribe tu respuesta en inglés natural; "
    "esta indicación tiene prioridad sobre «Responde en español»."
)


def for_agents(question: str, lang: Lang) -> str:
    """The question as the analyst and researcher read it, with the answer language when it is not Spanish."""
    return f"{question}\n\n{ENGLISH_NOTE}" if lang == "en" else question


def asks_english(text: str) -> bool:
    return ENGLISH_NOTE in text


def without_note(text: str) -> str:
    """The plain question, for searches: the language note must not reach the embeddings."""
    return text.replace(f"\n\n{ENGLISH_NOTE}", "")
