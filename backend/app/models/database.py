"""
Database Connection & Session
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./referral_guardian.db",
)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite fallback for local dev without Postgres
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,   # survive Supabase idle connection drops
        pool_recycle=300,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_sqlite_columns():
    """Ensure missing columns are safely added to existing SQLite tables."""
    if DATABASE_URL.startswith("sqlite"):
        try:
            with engine.connect() as conn:
                res = conn.exec_driver_sql("PRAGMA table_info(cases)")
                cols = [row[1] for row in res.fetchall()]
                if "educator_summary" not in cols:
                    conn.exec_driver_sql("ALTER TABLE cases ADD COLUMN educator_summary TEXT")
                if "assigned_specialist_email" not in cols:
                    conn.exec_driver_sql("ALTER TABLE cases ADD COLUMN assigned_specialist_email VARCHAR")

                res_spec = conn.exec_driver_sql("PRAGMA table_info(specialists)")
                spec_cols = [row[1] for row in res_spec.fetchall()]
                if "email" not in spec_cols:
                    conn.exec_driver_sql("ALTER TABLE specialists ADD COLUMN email VARCHAR")
        except Exception:
            pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
