from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import cast, Date, func, select
from sqlalchemy.orm import Session

from auth import get_approved_user
from database import get_db
from models.application import Application
from models.profile import Profile
from models.tech_stack import TechStack
from models.user import User
from pydantic import BaseModel

router = APIRouter(prefix="/api/stats", tags=["stats"])


class MyDailyPoint(BaseModel):
    date: str
    count: int
    cost: float


class MyProfileStat(BaseModel):
    profile_id: str
    name: str
    count: int
    cost: float


class MyStackStat(BaseModel):
    stack_name: str
    count: int


class MySummary(BaseModel):
    today_count: int
    week_count: int
    month_count: int
    month_cost: float
    calls_scheduled: int


class MyStatsResponse(BaseModel):
    summary: MySummary
    daily: list[MyDailyPoint]
    daily_calls: list[MyDailyPoint]
    profiles: list[MyProfileStat]
    stacks: list[MyStackStat]


@router.get("/me", response_model=MyStatsResponse)
def get_my_stats(
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today_start + timedelta(days=1)
    week_start = today_start - timedelta(days=6)
    month_start = today_start - timedelta(days=29)

    def _scalar_count(start: datetime, end: datetime) -> int:
        return db.scalar(
            select(func.count(Application.id)).where(
                Application.user_id == current_user.id,
                Application.created_at >= start,
                Application.created_at < end,
            )
        ) or 0

    def _scalar_cost(start: datetime, end: datetime) -> float:
        return float(
            db.scalar(
                select(func.coalesce(func.sum(Application.total_cost), 0)).where(
                    Application.user_id == current_user.id,
                    Application.created_at >= start,
                    Application.created_at < end,
                )
            ) or 0
        )

    calls_scheduled = db.scalar(
        select(func.count(Application.id)).where(
            Application.user_id == current_user.id,
            Application.call_scheduled == True,  # noqa: E712
        )
    ) or 0

    summary = MySummary(
        today_count=_scalar_count(today_start, tomorrow),
        week_count=_scalar_count(week_start, tomorrow),
        month_count=_scalar_count(month_start, tomorrow),
        month_cost=_scalar_cost(month_start, tomorrow),
        calls_scheduled=calls_scheduled,
    )

    # Daily breakdown
    day_col = cast(Application.created_at, Date).label("day")
    daily_stmt = (
        select(day_col, func.count(Application.id), func.coalesce(func.sum(Application.total_cost), 0))
        .where(Application.user_id == current_user.id)
        .group_by(day_col)
        .order_by(day_col)
    )
    if from_date:
        daily_stmt = daily_stmt.where(Application.created_at >= from_date)
    if to_date:
        daily_stmt = daily_stmt.where(Application.created_at < to_date + timedelta(days=1))
    daily_rows = db.execute(daily_stmt).all()
    daily = [MyDailyPoint(date=str(r[0]), count=r[1], cost=float(r[2])) for r in daily_rows]

    # Per-profile breakdown
    profile_stmt = (
        select(
            Application.profile_id,
            Profile.name,
            func.count(Application.id),
            func.coalesce(func.sum(Application.total_cost), 0),
        )
        .join(Profile, Profile.id == Application.profile_id)
        .where(Application.user_id == current_user.id)
        .group_by(Application.profile_id, Profile.name)
        .order_by(func.count(Application.id).desc())
    )
    if from_date:
        profile_stmt = profile_stmt.where(Application.created_at >= from_date)
    if to_date:
        profile_stmt = profile_stmt.where(Application.created_at < to_date + timedelta(days=1))
    profile_rows = db.execute(profile_stmt).all()
    profiles = [MyProfileStat(profile_id=r[0], name=r[1], count=r[2], cost=float(r[3])) for r in profile_rows]

    # Daily calls scheduled
    calls_daily_stmt = (
        select(day_col, func.count(Application.id))
        .where(
            Application.user_id == current_user.id,
            Application.call_scheduled == True,  # noqa: E712
        )
        .group_by(day_col)
        .order_by(day_col)
    )
    if from_date:
        calls_daily_stmt = calls_daily_stmt.where(Application.created_at >= from_date)
    if to_date:
        calls_daily_stmt = calls_daily_stmt.where(Application.created_at < to_date + timedelta(days=1))
    calls_daily_rows = db.execute(calls_daily_stmt).all()
    daily_calls = [MyDailyPoint(date=str(r[0]), count=r[1], cost=0.0) for r in calls_daily_rows]

    # Per-tech-stack breakdown
    stack_stmt = (
        select(
            func.coalesce(TechStack.name, "General").label("stack_name"),
            func.count(Application.id),
        )
        .outerjoin(TechStack, TechStack.id == Application.tech_stack_id)
        .where(Application.user_id == current_user.id)
        .group_by(func.coalesce(TechStack.name, "General"))
        .order_by(func.count(Application.id).desc())
    )
    if from_date:
        stack_stmt = stack_stmt.where(Application.created_at >= from_date)
    if to_date:
        stack_stmt = stack_stmt.where(Application.created_at < to_date + timedelta(days=1))
    stack_rows = db.execute(stack_stmt).all()
    stacks = [MyStackStat(stack_name=r[0], count=r[1]) for r in stack_rows]

    return MyStatsResponse(summary=summary, daily=daily, daily_calls=daily_calls, profiles=profiles, stacks=stacks)
