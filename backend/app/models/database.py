"""
Database Connection & Session
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Automatically load .env from backend directory, cwd, or project root
for p in [
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path.cwd() / ".env",
    Path(__file__).resolve().parent.parent.parent.parent / ".env",
]:
    if p.exists():
        load_dotenv(p, override=False)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.dlhhdjpyhlriinjpzzce:referalagent123@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres",
)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite fallback if explicitly requested
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
    """Ensure missing columns are safely added to existing SQLite tables if SQLite is used."""
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
