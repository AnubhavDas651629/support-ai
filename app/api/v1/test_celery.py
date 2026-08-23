from fastapi import APIRouter
from app.api.v1.auth import router
from app.workers.tasks import send_ticket_create_email

router = APIRouter(
    prefix="/text",
    tags = ["Test"]
)

@router.post("/celery")
async def test_celery():
    send_ticket_create_email.delay("test-ticket-id")

    return{
        "message": "Task queued successfully"
    }