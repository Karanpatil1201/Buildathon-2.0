import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Ensure backend/.env is loaded into environment variables
ENV_FILE = BASE_DIR.parent / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE, override=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "ForgeSight AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR.parent}/forgesight.db")
    
    # Security
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "forgesight_super_secret_buildathon_key_2026_xyz987")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # CORS: Comma-separated list of allowed origins or "*"
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
    )
    
    # Storage
    STORAGE_DIR: Path = BASE_DIR / "storage" / "uploads"
    EVAL_SAMPLES_DIR: Path = BASE_DIR / "storage" / "eval_samples"
    MODEL_WEIGHTS_PATH: Path = BASE_DIR / "ml" / "weights" / "casting_mobilenet_v3.pth"
    EVAL_METRICS_PATH: Path = BASE_DIR / "ml" / "weights" / "eval_metrics.json"
    
    # GenAI / Copilot settings
    GENAI_PROVIDER: str = os.getenv("GENAI_PROVIDER", "grounded_rules").strip('"\' ')
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip('"\' ')
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "").strip('"\' ')

    class Config:
        case_sensitive = True

settings = Settings()
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
settings.EVAL_SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
