import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from auth import get_approved_user
from database import get_db
from models.application import Application
from models.call import Call
from models.user import User
from schemas.call import CallCreate, CallResponse, CallUpdate

router = APIRouter(prefix="/api/calls", tags=["calls"])

_DETAIL_FIELDS = {
    "scheduled_at", "recording_link", "with_whom",
    "interviewer_role", "call_type", "call_link", "additional_note",
}


def _parse_stage_data(raw: str | None) -> dict[str, dict]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, ValueError):
        return {}


def _snapshot(call: Call) -> dict:
    """Capture all mutable call detail fields into a plain dict."""
    return {
        "status": call.status,
        "scheduled_at": call.scheduled_at.isoformat() if call.scheduled_at else None,
        "recording_link": call.recording_link,
        "with_whom": call.with_whom,
        "interviewer_role": call.interviewer_role,
        "call_type": call.call_type,
        "call_link": call.call_link,
        "additional_note": call.additional_note,
    }


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _apply_snapshot(call: Call, saved: dict) -> None:
    """Restore detail fields from a saved snapshot dict onto the call ORM object."""
    call.status = saved.get("status", "scheduled")
    call.scheduled_at = _parse_dt(saved.get("scheduled_at"))
    call.recording_link = saved.get("recording_link")
    call.with_whom = saved.get("with_whom")
    call.interviewer_role = saved.get("interviewer_role")
    call.call_type = saved.get("call_type")
    call.call_link = saved.get("call_link")
    call.additional_note = saved.get("additional_note")


def _clear_details(call: Call) -> None:
    """Reset all mutable detail fields to empty defaults for a brand-new stage."""
    call.status = "scheduled"
    call.scheduled_at = None
    call.recording_link = None
    call.with_whom = None
    call.interviewer_role = None
    call.call_type = None
    call.call_link = None
    call.additional_note = None


def _call_to_response(call: Call) -> dict:
    app = call.application
    return {
        "id": call.id,
        "application_id": call.application_id,
        "stage": call.stage,
        "status": call.status,
        "scheduled_at": call.scheduled_at,
        "recording_link": call.recording_link,
        "with_whom": call.with_whom,
        "interviewer_role": call.interviewer_role,
        "call_type": call.call_type,
        "call_link": call.call_link,
        "additional_note": call.additional_note,
        "stage_statuses": _parse_stage_data(call.stage_statuses),
        "is_closed": call.is_closed,
        "created_at": call.created_at,
        "updated_at": call.updated_at,
        "job_title": app.job_title if app else None,
        "company": app.company if app else None,
        "profile_name": app.profile_name if app else None,
        "user_username": app.user.username if app and app.user else None,
    }


@router.get("", response_model=list[CallResponse])
def list_calls(
    stage: str | None = Query(None),
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Call)
        .options(selectinload(Call.application).selectinload(Application.user))
        .join(Call.application)
    )

    if current_user.role == "bidder":
        stmt = stmt.where(Application.user_id == current_user.id)

    stmt = stmt.where(Call.is_closed == False)  # noqa: E712

    if stage:
        stmt = stmt.where(Call.stage == stage)

    calls = db.scalars(stmt).all()
    return [_call_to_response(c) for c in calls]


@router.post("", response_model=CallResponse, status_code=201)
def create_call(
    payload: CallCreate,
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "caller":
        raise HTTPException(status_code=403, detail="Callers cannot create calls")

    application = db.get(Application, payload.application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.role == "bidder" and application.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.call:
        if application.call.is_closed:
            # Re-open the closed call instead of creating a duplicate
            application.call.is_closed = False
            application.call_scheduled = True
            db.commit()
            db.refresh(application.call)
            return _call_to_response(application.call)
        raise HTTPException(
            status_code=409,
            detail="A call already exists for this application",
        )

    now = datetime.utcnow()
    initial_stage_data = {
        payload.stage: {
            "status": payload.status,
            "scheduled_at": payload.scheduled_at.isoformat() if payload.scheduled_at else None,
            "recording_link": payload.recording_link,
            "with_whom": payload.with_whom,
            "interviewer_role": payload.interviewer_role,
            "call_type": payload.call_type,
            "call_link": payload.call_link,
            "additional_note": payload.additional_note,
        }
    }
    call = Call(
        application_id=payload.application_id,
        stage=payload.stage,
        status=payload.status,
        scheduled_at=payload.scheduled_at,
        recording_link=payload.recording_link,
        with_whom=payload.with_whom,
        interviewer_role=payload.interviewer_role,
        call_type=payload.call_type,
        call_link=payload.call_link,
        additional_note=payload.additional_note,
        stage_statuses=json.dumps(initial_stage_data),
        created_at=now,
        updated_at=now,
    )
    application.call_scheduled = True
    db.add(call)
    db.commit()
    db.refresh(call)
    db.refresh(application)
    return _call_to_response(call)


@router.patch("/{call_id}", response_model=CallResponse)
def update_call(
    call_id: str,
    payload: CallUpdate,
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "caller":
        raise HTTPException(status_code=403, detail="Callers cannot modify calls")

    call = db.get(Call, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    application = db.get(Application, call.application_id)
    if current_user.role == "bidder" and (
        not application or application.user_id != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Call not found")

    update_data = payload.model_dump(exclude_unset=True)
    stage_data = _parse_stage_data(call.stage_statuses)

    # Handle is_closed separately — it syncs application.call_scheduled
    new_is_closed = update_data.pop("is_closed", None)
    if new_is_closed is not None:
        call.is_closed = new_is_closed
        if application:
            application.call_scheduled = not new_is_closed

    new_stage = update_data.pop("stage", None)
    new_status = update_data.pop("status", None)
    has_detail_fields = bool(update_data.keys() & _DETAIL_FIELDS)

    if new_stage and new_stage != call.stage:
        # Save snapshot of current stage before leaving
        stage_data[call.stage] = _snapshot(call)

        if has_detail_fields or new_status is not None:
            # Edit dialog: apply explicitly provided values, then move stage
            if new_status is not None:
                call.status = new_status
            for field, value in update_data.items():
                setattr(call, field, value)
            call.stage = new_stage
        else:
            # Drag-only: restore full snapshot for the new stage, or clear it
            call.stage = new_stage
            if new_stage in stage_data:
                _apply_snapshot(call, stage_data[new_stage])
            else:
                _clear_details(call)
    else:
        # No stage change: apply status and detail updates in place
        if new_status is not None:
            call.status = new_status
        for field, value in update_data.items():
            setattr(call, field, value)

    # Always persist current state to stage_data for the current stage
    stage_data[call.stage] = _snapshot(call)
    call.stage_statuses = json.dumps(stage_data)
    call.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(call)
    return _call_to_response(call)


@router.delete("/{call_id}", status_code=204)
def delete_call(
    call_id: str,
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "caller":
        raise HTTPException(status_code=403, detail="Callers cannot delete calls")

    call = db.get(Call, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    application = db.get(Application, call.application_id)
    if current_user.role == "bidder" and (
        not application or application.user_id != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Call not found")

    if application:
        application.call_scheduled = False
    db.delete(call)
    db.commit()
