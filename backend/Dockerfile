FROM litestream/litestream:0.5 AS litestream

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    DB_PATH=/data/signal.db \
    DATABASE_URL=sqlite+aiosqlite:////data/signal.db

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini litestream.yml docker-entrypoint.sh ./
COPY alembic ./alembic
COPY app ./app

RUN mv litestream.yml /etc/litestream.yml \
    && chmod +x docker-entrypoint.sh \
    && mkdir -p /data

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.getenv(\"PORT\",\"8000\")}/health')"

CMD ["./docker-entrypoint.sh"]
