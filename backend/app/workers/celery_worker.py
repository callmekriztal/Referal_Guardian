"""
Celery Background Monitoring Worker

Periodically finds stuck referral cases and runs the Referral Guardian agent.
"""
import logging
import os

from celery import Celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL") or "redis://localhost:6379/0"
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)

celery_app = Celery(
    "referral_guardian",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "monitor-stuck-cases": {
            "task": "app.workers.celery_worker.monitor_stuck_cases",
            "schedule": crontab(minute="*/30"),  # every 30 minutes
        }
    },
)


@celery_app.task(name="app.workers.celery_worker.monitor_stuck_cases", bind=True)
def monitor_stuck_cases(self):
    """
    Periodic job: find stuck/active cases with no recent activity
    and run the Referral Guardian agent for each.

    Skips cases that already have a PENDING recommendation (don't duplicate).
    """
    logger.info("[Celery] Starting stuck-case monitoring sweep")

    try:
        from app.models.database import SessionLocal
        from app.services.case_service import get_stuck_cases, has_pending_recommendation
        from app.agent.graph import get_graph

        db = SessionLocal()
        try:
            stuck = get_stuck_cases(db)
            logger.info("[Celery] Found %d stuck/inactive cases", len(stuck))
            processed = []

            graph = get_graph()

            for case_data in stuck:
                case_id = case_data["id"]
                try:
                    if has_pending_recommendation(db, case_id):
                        logger.info("[Celery] Skipping case %s — already has pending recommendation", case_id)
                        continue

                    logger.info("[Celery] Running agent for case %s", case_id)
                    thread_id = f"case-{case_id}"
                    config = {"configurable": {"thread_id": thread_id}}

                    initial_state = {
                        "case_id": case_id,
                        "step_count": 0,
                    }

                    for _ in graph.stream(initial_state, config, stream_mode="values"):
                        pass  # consume stream until interrupt or END

                    processed.append(case_id)

                except Exception as exc:
                    logger.exception("[Celery] Agent failed for case %s: %s", case_id, exc)

        finally:
            db.close()

        return {
            "checked": len(stuck),
            "processed": processed,
        }

    except Exception as exc:
        logger.exception("[Celery] monitor_stuck_cases task failed: %s", exc)
        raise self.retry(exc=exc, countdown=60, max_retries=3)
