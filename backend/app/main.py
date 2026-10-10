"""MediVara API application. Run: uv run uvicorn app.main:app --reload --no-access-log"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import init_db
from app.errors import install_error_handlers
from app.middleware import RequestIdMiddleware, configure_logging
from app.routers import (
    API_PREFIX,
    access,
    ask,
    auth,
    briefs,
    chats,
    details,
    documents,
    facts,
    health,
    invitations,
    patients,
    reminders,
    timeline,
    vitals,
    voice,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        title="MediVara API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=f"{API_PREFIX}/docs",
        openapi_url=f"{API_PREFIX}/openapi.json",
    )
    app.add_middleware(RequestIdMiddleware)
    install_error_handlers(app)
    routers = (
        health,
        auth,
        patients,
        documents,
        facts,
        timeline,
        briefs,
        ask,
        access,
        reminders,
        # Redesign extensions (API contract §5b).
        details,
        vitals,
        chats,
        invitations,
        voice,
    )
    for module in routers:
        app.include_router(module.router)
    return app


app = create_app()
