FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN useradd --create-home --uid 1000 atlas
WORKDIR /app

# Editable install keeps db/schema.sql and data/ where the code resolves them (/app).
COPY pyproject.toml ./
COPY src ./src
RUN pip install -e .

COPY db ./db
COPY data ./data
RUN chown -R atlas:atlas /app
USER atlas

EXPOSE 8000
# Railway injects PORT; the Claude Agent SDK ships its own CLI binary, so no Node runtime is needed.
CMD ["sh", "-c", "uvicorn atlas.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
