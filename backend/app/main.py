import os
from dotenv import load_dotenv

# Providers read configuration during import, so load .env first.
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.evidence import router as evidence_router

app = FastAPI(
    title="TruthLens Backend",
    description="Evidence-based misinformation and news verification engine API — Phase 3 Evidence Retrieval",
    version="0.3.0",
)

# CORS configuration for frontend communication during local development
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
origins = [
    origin.strip()
    for origin in allowed_origins_env.split(",")
    if origin.strip()
] or [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(health_router, prefix="/api", tags=["System"])
app.include_router(evidence_router, prefix="/api", tags=["Evidence Retrieval"])


@app.get("/")
async def root():
    return {
        "message": "TruthLens Backend API - Foundation Phase",
        "documentation": "/docs",
        "health": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
