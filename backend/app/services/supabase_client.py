"""
Supabase Client Service for Referral Guardian.

Connects to Supabase using the official supabase-py SDK.
Supports both the publishable/anon key and service_role key.
"""
import logging
import os
from typing import Any, Optional

from supabase import Client, create_client

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    "https://dlhhdjpyhlriinjpzzce.supabase.co",
)

SUPABASE_KEY = os.getenv(
    "SUPABASE_KEY",
    os.getenv(
        "SUPABASE_PUBLISHABLE_KEY",
        "sb_publishable_519NaqrpYJdiATVg7ZZewQ_MgNNJJoS",
    ),
)

_client: Optional[Client] = None


def get_supabase() -> Optional[Client]:
    """Return the Supabase client singleton."""
    global _client
    if _client is not None:
        return _client

    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("SUPABASE_URL or SUPABASE_KEY is missing.")
        return None

    try:
        from supabase.client import ClientOptions
        options = ClientOptions(postgrest_client_timeout=3)
        _client = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
        logger.info("Supabase client initialized for %s", SUPABASE_URL)
        return _client
    except Exception as exc:
        logger.exception("Failed to initialize Supabase client: %s", exc)
        return None


# ---------------------------------------------------------------------------
# High-level Supabase operations with safe error handling
# ---------------------------------------------------------------------------

def supabase_get_cases() -> list[dict[str, Any]]:
    client = get_supabase()
    if not client:
        return []
    try:
        res = client.table("cases").select("*").execute()
        return res.data or []
    except Exception as exc:
        logger.warning("Supabase select cases error: %s", exc)
        return []


def supabase_get_case(case_id: str) -> Optional[dict[str, Any]]:
    client = get_supabase()
    if not client:
        return None
    try:
        res = client.table("cases").select("*").eq("id", case_id).limit(1).execute()
        if res.data:
            return res.data[0]
        return None
    except Exception as exc:
        logger.warning("Supabase select case %s error: %s", case_id, exc)
        return None


def supabase_get_timeline(case_id: str) -> list[dict[str, Any]]:
    client = get_supabase()
    if not client:
        return []
    try:
        res = (
            client.table("case_events")
            .select("*")
            .eq("case_id", case_id)
            .order("timestamp")
            .execute()
        )
        return res.data or []
    except Exception as exc:
        logger.warning("Supabase select timeline for case %s error: %s", case_id, exc)
        return []


def supabase_insert(table: str, data: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Safely insert a record into Supabase."""
    if "postgres" in os.getenv("DATABASE_URL", "").lower():
        return data  # Already inserted directly via SQLAlchemy

    client = get_supabase()
    if not client:
        return None
    try:
        res = client.table(table).insert(data).execute()
        if res.data:
            return res.data[0]
        return None
    except Exception as exc:
        logger.warning("Supabase insert into %s failed (RLS/network): %s", table, exc)
        return None


def supabase_update(table: str, row_id: str, data: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Safely update a record in Supabase by ID."""
    if "postgres" in os.getenv("DATABASE_URL", "").lower():
        return data  # Already updated directly via SQLAlchemy

    client = get_supabase()
    if not client:
        return None
    try:
        res = client.table(table).update(data).eq("id", row_id).execute()
        if res.data:
            return res.data[0]
        return None
    except Exception as exc:
        logger.warning("Supabase update %s id=%s failed: %s", table, row_id, exc)
        return None


def supabase_delete(table: str, row_id: str) -> bool:
    """Safely delete a record in Supabase by ID."""
    if "postgres" in os.getenv("DATABASE_URL", "").lower():
        return True  # Already deleted directly via SQLAlchemy

    client = get_supabase()
    if not client:
        return False
    try:
        client.table(table).delete().eq("id", row_id).execute()
        return True
    except Exception as exc:
        logger.warning("Supabase delete from %s id=%s failed: %s", table, row_id, exc)
        return False
