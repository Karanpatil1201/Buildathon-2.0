from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

# Enable foreign keys and WAL mode for SQLite
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def ensure_schema_migrations():
    """Ensure newly added columns exist in SQLite without requiring external migration tooling."""
    try:
        with engine.connect() as conn:
            if settings.DATABASE_URL.startswith("sqlite"):
                # 1. Update reinspections table columns
                cursor = conn.execute(text("PRAGMA table_info(reinspections)"))
                existing_cols = {row[1] for row in cursor.fetchall()}
                new_reinspection_cols = {
                    "image_scope": "VARCHAR(50) DEFAULT 'ITEM'",
                    "comparison_suggestion": "VARCHAR(50) DEFAULT 'PENDING_REVIEW'",
                    "comparison_decision": "VARCHAR(50)",
                    "reviewer_id": "INTEGER",
                    "reviewer_notes": "TEXT",
                    "reviewed_at": "DATETIME",
                    "linked_action_id": "INTEGER"
                }
                for col_name, col_type in new_reinspection_cols.items():
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE reinspections ADD COLUMN {col_name} {col_type}"))

                # 2. Update image_evidences table columns
                cursor2 = conn.execute(text("PRAGMA table_info(image_evidences)"))
                img_cols = {row[1] for row in cursor2.fetchall()}
                if "image_scope" not in img_cols:
                    conn.execute(text("ALTER TABLE image_evidences ADD COLUMN image_scope VARCHAR(50) DEFAULT 'ITEM'"))

                conn.commit()
    except Exception as e:
        print(f"[Schema Migration] Warning: {e}")
