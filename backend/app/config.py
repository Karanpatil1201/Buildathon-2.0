import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent

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
    
    # Storage
    STORAGE_DIR: Path = BASE_DIR / "storage" / "uploads"
    EVAL_SAMPLES_DIR: Path = BASE_DIR / "storage" / "eval_samples"
    MODEL_WEIGHTS_PATH: Path = BASE_DIR / "ml" / "weights" / "casting_mobilenet_v3.pth"
    EVAL_METRICS_PATH: Path = BASE_DIR / "ml" / "weights" / "eval_metrics.json"
    
    # GenAI / Copilot settings
    GENAI_PROVIDER: str = os.getenv("GENAI_PROVIDER", "grounded_rules")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    class Config:
        case_sensitive = True

settings = Settings()
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
settings.EVAL_SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
