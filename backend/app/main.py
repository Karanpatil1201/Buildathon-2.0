from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, Base, get_db
from app.seed import seed_database
from app.routers import (
    auth, products, batches, inspections, reviews,
    defects, actions, dashboard, copilot, innovation
)

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="ForgeSight AI: Product Quality Inspection & Defect Tracking System. Connects image evidence, real ML inference, human reviews, defect tracking, and Grounded Quality Copilot."
)

# CORS configuration supporting configurable frontend origins
cors_origins_raw = getattr(settings, "CORS_ORIGINS", "*")
if cors_origins_raw.strip() == "*":
    allowed_origins = ["*"]
    allow_credentials = False
else:
    allowed_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed database on startup
@app.on_event("startup")
def startup_event():
    from app.database import ensure_schema_migrations
    ensure_schema_migrations()
    with Session(engine) as db:
        seed_database(db)

# Mount Routers
api_v1_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1_prefix)
app.include_router(products.router, prefix=api_v1_prefix)
app.include_router(batches.router, prefix=api_v1_prefix)
app.include_router(inspections.router, prefix=api_v1_prefix)
app.include_router(reviews.router, prefix=api_v1_prefix)
app.include_router(defects.router, prefix=api_v1_prefix)
app.include_router(actions.router, prefix=api_v1_prefix)
app.include_router(dashboard.router, prefix=api_v1_prefix)
app.include_router(copilot.router, prefix=api_v1_prefix)
app.include_router(innovation.router, prefix=api_v1_prefix)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "ml_engine": "MobileNetV3-Steel-Inspector (Operational)",
        "copilot": "Grounded Quality Copilot (Operational)"
    }

@app.get("/")
def root():
    return {
        "message": "Welcome to ForgeSight AI API",
        "docs_url": "/docs",
        "health_url": "/health",
        "api_v1": settings.API_V1_STR
    }
