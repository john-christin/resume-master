import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import get_approved_user, require_role
from database import get_db
from models.call import Call
from models.call_stage import CallStage
from models.user import User
from schemas.call_stage import (
    CallStageCreate,
    CallStageReorder,
    CallStageResponse,
    CallStageUpdate,
)

router = APIRouter(prefix="/api/call-stages", tags=["call-stages"])

_admin_only = require_role("admin")


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def _unique_value(name: str, db: Session, exclude_id: str | None = None) -> str:
    base = _slugify(name)
    candidate = base
    suffix = 2
    while True:
        stmt = select(CallStage).where(CallStage.value == candidate)
        if exclude_id:
            stmt = stmt.where(CallStage.id != exclude_id)
        if not db.scalars(stmt).first():
            return candidate
        candidate = f"{base}_{suffix}"
        suffix += 1


@router.get("", response_model=list[CallStageResponse])
def list_call_stages(
    _: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    stages = db.scalars(
        select(CallStage).order_by(CallStage.order, CallStage.created_at)
    ).all()
    return stages


@router.post("", response_model=CallStageResponse, status_code=201)
def create_call_stage(
    payload: CallStageCreate,
    _: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    value = _unique_value(payload.name, db)
    max_order = db.scalar(
        select(func.max(CallStage.order))
    )
    now = datetime.utcnow()
    stage = CallStage(
        id=str(uuid.uuid4()),
        name=payload.name,
        value=value,
        order=(max_order or 0) + 1,
        created_at=now,
        updated_at=now,
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.patch("/{stage_id}", response_model=CallStageResponse)
def update_call_stage(
    stage_id: str,
    payload: CallStageUpdate,
    _: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    stage = db.get(CallStage, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    if payload.name is not None:
        stage.name = payload.name
    if payload.order is not None:
        stage.order = payload.order
    stage.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(stage)
    return stage


@router.delete("/{stage_id}", status_code=204)
def delete_call_stage(
    stage_id: str,
    _: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    stage = db.get(CallStage, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    active_count = db.scalar(
        select(func.count())
        .select_from(Call)
        .where(Call.stage == stage.value, Call.is_closed == False)  # noqa: E712
    )
    if active_count:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {active_count} active call(s) in this stage. Move or close them first.",
        )

    db.delete(stage)
    db.commit()


@router.post("/reorder", status_code=204)
def reorder_call_stages(
    payload: CallStageReorder,
    _: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    for index, stage_id in enumerate(payload.ordered_ids):
        stage = db.get(CallStage, stage_id)
        if stage:
            stage.order = index
            stage.updated_at = now
    db.commit()
