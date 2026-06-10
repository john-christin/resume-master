from datetime import datetime, date, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, cast, Date, Integer
from sqlalchemy.orm import Session

from auth import require_role
from database import get_db
from services import log_service
from models.ai_model_config import AIModelConfig
from models.application import Application
from models.banned_company import BannedCompany
from services import ai_service
from models.knowledge_base import KnowledgeBase
from models.profile import Profile
from models.system_setting import SystemSetting
from models.tech_stack import TechStack
from models.system_log import SystemLog
from models.token_pricing import TokenPricing
from models.user import User
from schemas.admin import (
    ActivateModelRequest,
    AdminOverview,
    AIModelConfigCreate,
    AIModelConfigResponse,
    AIModelConfigUpdate,
    BannedCompanyCreate,
    BannedCompanyResponse,
    BannedCompanyUpdate,
    DailyStatPoint,
    DashboardStats,
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    KnowledgeBaseUpdate,
    PricingRequest,
    PricingResponse,
    ProfileStat,
    ProfileStatPoint,
    SystemLogItem,
    TechStackCreate,
    TechStackResponse,
    TechStackUpdate,
    UserApproveRequest,
    UserCallStat,
    UserCostStat,
    UserDailyPoint,
    UserListItem,
    UserStatItem,
    UserStatsResponse,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

_admin_only = require_role("admin")


def _build_app_filter(from_date: datetime | None, to_date: datetime | None):
    """Build a list of Application date filters."""
    filters = []
    if from_date:
        filters.append(Application.created_at >= from_date)
    if to_date:
        # to_date is parsed as midnight start-of-day; extend to end-of-day
        end_of_day = to_date + timedelta(days=1)
        filters.append(Application.created_at < end_of_day)
    return filters


@router.get("/users", response_model=list[UserListItem])
def list_users(
    status: str | None = None,
    search: str | None = None,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    stmt = select(User)
    if status:
        stmt = stmt.where(User.status == status)
    if search:
        stmt = stmt.where(User.username.ilike(f"%{search}%"))
    stmt = stmt.order_by(User.created_at.desc())

    users = db.scalars(stmt).all()
    result = []
    for u in users:
        app_count = (
            db.scalar(
                select(func.count(Application.id)).where(
                    Application.user_id == u.id
                )
            )
            or 0
        )
        cost = (
            db.scalar(
                select(func.coalesce(func.sum(Application.total_cost), 0)).where(
                    Application.user_id == u.id
                )
            )
            or 0.0
        )
        result.append(
            UserListItem(
                id=u.id,
                username=u.username,
                role=u.role,
                status=u.status,
                profile_count=len(u.profiles),
                application_count=app_count,
                total_cost=cost,
                created_at=u.created_at,
            )
        )
    return result


@router.post("/users/{user_id}/approve")
def approve_user(
    user_id: str,
    data: UserApproveRequest,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    if data.role not in ("admin", "bidder", "caller"):
        raise HTTPException(status_code=400, detail="Invalid role")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.status = "approved"
    user.role = data.role
    user.approved_at = datetime.now(timezone.utc)
    user.approved_by = current_user.id
    db.commit()
    log_service.log_bg(
        log_service.INFO, log_service.ADMIN,
        f"User approved: {user.username} → role={data.role}",
        user_id=current_user.id,
        details={"target_user_id": user_id, "target_username": user.username, "role": data.role},
    )
    return {"detail": "User approved", "user_id": user_id, "role": data.role}


@router.post("/users/{user_id}/reject")
def reject_user(
    user_id: str,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.status = "rejected"
    db.commit()
    log_service.log_bg(
        log_service.INFO, log_service.ADMIN,
        f"User rejected: {user.username}",
        user_id=current_user.id,
        details={"target_user_id": user_id, "target_username": user.username},
    )
    return {"detail": "User rejected", "user_id": user_id}


@router.patch("/users/{user_id}/role")
def change_user_role(
    user_id: str,
    data: UserApproveRequest,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    if data.role not in ("admin", "bidder", "caller"):
        raise HTTPException(status_code=400, detail="Invalid role")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    user.role = data.role
    db.commit()
    log_service.log_bg(
        log_service.INFO, log_service.ADMIN,
        f"Role changed: {user.username} {old_role} → {data.role}",
        user_id=current_user.id,
        details={"target_user_id": user_id, "target_username": user.username, "old_role": old_role, "new_role": data.role},
    )
    return {"detail": "Role updated", "user_id": user_id, "role": data.role}


@router.post("/users/{user_id}/suspend")
def suspend_user(
    user_id: str,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot suspend yourself")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.status == "suspended":
        raise HTTPException(status_code=400, detail="User is already suspended")

    user.status = "suspended"
    db.commit()
    log_service.log_bg(
        log_service.WARNING, log_service.ADMIN,
        f"User suspended: {user.username}",
        user_id=current_user.id,
        details={"target_user_id": user_id, "target_username": user.username},
    )
    return {"detail": "User suspended", "user_id": user_id}


@router.post("/users/{user_id}/unsuspend")
def unsuspend_user(
    user_id: str,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.status != "suspended":
        raise HTTPException(status_code=400, detail="User is not suspended")

    user.status = "approved"
    db.commit()
    log_service.log_bg(
        log_service.INFO, log_service.ADMIN,
        f"User unsuspended: {user.username}",
        user_id=current_user.id,
        details={"target_user_id": user_id, "target_username": user.username},
    )
    return {"detail": "User unsuspended", "user_id": user_id}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    username = user.username
    db.delete(user)
    db.commit()
    log_service.log_bg(
        log_service.WARNING, log_service.ADMIN,
        f"User deleted: {username}",
        user_id=current_user.id,
        details={"target_user_id": user_id, "target_username": username},
    )


@router.get("/stats/overview", response_model=AdminOverview)
def get_admin_overview(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today_start + timedelta(days=1)

    today_count = db.scalar(
        select(func.count(Application.id)).where(
            Application.created_at >= today_start,
            Application.created_at < tomorrow,
        )
    ) or 0
    today_cost = float(
        db.scalar(
            select(func.coalesce(func.sum(Application.total_cost), 0)).where(
                Application.created_at >= today_start,
                Application.created_at < tomorrow,
            )
        ) or 0
    )
    active_users = db.scalar(select(func.count(User.id)).where(User.status == "approved")) or 0
    pending_users = db.scalar(select(func.count(User.id)).where(User.status == "pending")) or 0
    calls_scheduled = db.scalar(
        select(func.count(Application.id)).where(Application.call_scheduled == True)  # noqa: E712
    ) or 0
    return AdminOverview(
        today_count=today_count,
        today_cost=today_cost,
        active_users=active_users,
        pending_users=pending_users,
        calls_scheduled=calls_scheduled,
    )


@router.get("/stats/daily", response_model=list[DailyStatPoint])
def get_daily_stats(
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    user_id: str | None = Query(None),
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    day_col = cast(Application.created_at, Date).label("day")
    stmt = (
        select(day_col, func.count(Application.id), func.coalesce(func.sum(Application.total_cost), 0))
        .group_by(day_col)
        .order_by(day_col)
    )
    for f in _build_app_filter(from_date, to_date):
        stmt = stmt.where(f)
    if user_id:
        stmt = stmt.where(Application.user_id == user_id)
    rows = db.execute(stmt).all()
    return [DailyStatPoint(date=str(r[0]), count=r[1], cost=float(r[2])) for r in rows]


@router.get("/stats/per-user-daily", response_model=list[UserDailyPoint])
def get_per_user_daily(
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    day_col = cast(Application.created_at, Date).label("day")
    stmt = (
        select(
            day_col,
            Application.user_id,
            User.username,
            func.count(Application.id),
            func.coalesce(func.sum(Application.total_cost), 0),
        )
        .join(User, User.id == Application.user_id)
        .group_by(day_col, Application.user_id, User.username)
        .order_by(day_col, User.username)
    )
    for f in _build_app_filter(from_date, to_date):
        stmt = stmt.where(f)
    rows = db.execute(stmt).all()
    return [
        UserDailyPoint(date=str(r[0]), user_id=r[1], username=r[2], count=r[3], cost=float(r[4]))
        for r in rows
    ]


@router.get("/stats/per-profile", response_model=list[ProfileStatPoint])
def get_per_profile_stats(
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    stmt = (
        select(
            Application.profile_id,
            Profile.name,
            User.username,
            func.count(Application.id),
            func.coalesce(func.sum(Application.total_cost), 0),
        )
        .join(Profile, Profile.id == Application.profile_id)
        .join(User, User.id == Application.user_id)
        .group_by(Application.profile_id, Profile.name, User.username)
        .order_by(func.count(Application.id).desc())
    )
    for f in _build_app_filter(from_date, to_date):
        stmt = stmt.where(f)
    rows = db.execute(stmt).all()
    return [
        ProfileStatPoint(profile_id=r[0], name=r[1], username=r[2], count=r[3], cost=float(r[4]))
        for r in rows
    ]


@router.get("/stats/user-costs", response_model=list[UserCostStat])
def get_user_costs(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=6)
    month_start = today_start - timedelta(days=29)
    tomorrow = today_start + timedelta(days=1)

    users = db.scalars(select(User).where(User.status == "approved").order_by(User.username)).all()
    result = []
    for u in users:
        def _count_cost(start: datetime, end: datetime) -> tuple[int, float]:
            c = db.scalar(
                select(func.count(Application.id)).where(
                    Application.user_id == u.id,
                    Application.created_at >= start,
                    Application.created_at < end,
                )
            ) or 0
            cost = float(db.scalar(
                select(func.coalesce(func.sum(Application.total_cost), 0)).where(
                    Application.user_id == u.id,
                    Application.created_at >= start,
                    Application.created_at < end,
                )
            ) or 0)
            return c, cost

        tc, tco = _count_cost(today_start, tomorrow)
        wc, wco = _count_cost(week_start, tomorrow)
        mc, mco = _count_cost(month_start, tomorrow)
        result.append(UserCostStat(
            user_id=u.id, username=u.username,
            today_count=tc, today_cost=tco,
            week_count=wc, week_cost=wco,
            month_count=mc, month_cost=mco,
        ))
    return result


@router.get("/stats/daily-calls", response_model=list[DailyStatPoint])
def get_daily_calls(
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    day_col = cast(Application.created_at, Date).label("day")
    stmt = (
        select(day_col, func.count(Application.id))
        .where(Application.call_scheduled == True)  # noqa: E712
        .group_by(day_col)
        .order_by(day_col)
    )
    for f in _build_app_filter(from_date, to_date):
        stmt = stmt.where(f)
    rows = db.execute(stmt).all()
    return [DailyStatPoint(date=str(r[0]), count=r[1], cost=0.0) for r in rows]


@router.get("/stats/per-user-daily-calls", response_model=list[UserDailyPoint])
def get_per_user_daily_calls(
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    day_col = cast(Application.created_at, Date).label("day")
    stmt = (
        select(day_col, Application.user_id, User.username, func.count(Application.id))
        .join(User, User.id == Application.user_id)
        .where(Application.call_scheduled == True)  # noqa: E712
        .group_by(day_col, Application.user_id, User.username)
        .order_by(day_col, User.username)
    )
    for f in _build_app_filter(from_date, to_date):
        stmt = stmt.where(f)
    rows = db.execute(stmt).all()
    return [UserDailyPoint(date=str(r[0]), user_id=r[1], username=r[2], count=r[3], cost=0.0) for r in rows]


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    total_users = db.scalar(select(func.count(User.id))) or 0
    pending_users = (
        db.scalar(
            select(func.count(User.id)).where(User.status == "pending")
        )
        or 0
    )

    date_filters = _build_app_filter(from_date, to_date)

    # Total apps & cost within period
    apps_stmt = select(func.count(Application.id))
    cost_stmt = select(func.coalesce(func.sum(Application.total_cost), 0))
    for f in date_filters:
        apps_stmt = apps_stmt.where(f)
        cost_stmt = cost_stmt.where(f)

    total_apps = db.scalar(apps_stmt) or 0
    total_cost = db.scalar(cost_stmt) or 0.0

    # Per-user breakdown within period
    users = db.scalars(
        select(User)
        .where(User.status == "approved")
        .order_by(User.created_at.desc())
    ).all()

    user_items = []
    for u in users:
        user_app_stmt = select(func.count(Application.id)).where(
            Application.user_id == u.id
        )
        user_cost_stmt = select(
            func.coalesce(func.sum(Application.total_cost), 0)
        ).where(Application.user_id == u.id)
        for f in date_filters:
            user_app_stmt = user_app_stmt.where(f)
            user_cost_stmt = user_cost_stmt.where(f)

        app_count = db.scalar(user_app_stmt) or 0
        u_cost = db.scalar(user_cost_stmt) or 0.0

        # Per-profile breakdown for this user
        profiles = db.scalars(
            select(Profile).where(Profile.owner_id == u.id)
        ).all()
        profile_stats = []
        for p in profiles:
            p_app_stmt = select(func.count(Application.id)).where(
                Application.user_id == u.id,
                Application.profile_id == p.id,
            )
            p_cost_stmt = select(
                func.coalesce(func.sum(Application.total_cost), 0)
            ).where(
                Application.user_id == u.id,
                Application.profile_id == p.id,
            )
            for f in date_filters:
                p_app_stmt = p_app_stmt.where(f)
                p_cost_stmt = p_cost_stmt.where(f)

            profile_stats.append(
                ProfileStat(
                    profile_id=p.id,
                    name=p.name,
                    application_count=db.scalar(p_app_stmt) or 0,
                    total_cost=db.scalar(p_cost_stmt) or 0.0,
                )
            )

        user_items.append(
            UserStatItem(
                id=u.id,
                username=u.username,
                role=u.role,
                profile_count=len(profiles),
                application_count=app_count,
                total_cost=u_cost,
                profiles=profile_stats,
            )
        )

    return DashboardStats(
        total_users=total_users,
        pending_users=pending_users,
        total_applications=total_apps,
        total_cost=total_cost,
        users=user_items,
    )


@router.get("/stats/user/{user_id}", response_model=UserStatsResponse)
def get_user_stats(
    user_id: str,
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    date_filters = _build_app_filter(from_date, to_date)

    profiles = db.scalars(
        select(Profile).where(Profile.owner_id == user_id)
    ).all()

    profile_stats = []
    total_cost = 0.0
    total_tokens = 0

    for p in profiles:
        p_app_stmt = select(func.count(Application.id)).where(
            Application.user_id == user_id,
            Application.profile_id == p.id,
        )
        p_cost_stmt = select(
            func.coalesce(func.sum(Application.total_cost), 0)
        ).where(
            Application.user_id == user_id,
            Application.profile_id == p.id,
        )
        p_tokens_stmt = select(
            func.coalesce(
                func.sum(
                    Application.prompt_tokens + Application.completion_tokens
                ),
                0,
            )
        ).where(
            Application.user_id == user_id,
            Application.profile_id == p.id,
        )
        for f in date_filters:
            p_app_stmt = p_app_stmt.where(f)
            p_cost_stmt = p_cost_stmt.where(f)
            p_tokens_stmt = p_tokens_stmt.where(f)

        p_cost = db.scalar(p_cost_stmt) or 0.0
        p_tokens = db.scalar(p_tokens_stmt) or 0

        profile_stats.append(
            ProfileStat(
                profile_id=p.id,
                name=p.name,
                application_count=db.scalar(p_app_stmt) or 0,
                total_cost=p_cost,
            )
        )
        total_cost += p_cost
        total_tokens += p_tokens

    return UserStatsResponse(
        user_id=user.id,
        username=user.username,
        profiles=profile_stats,
        total_cost=total_cost,
        total_tokens=total_tokens,
    )


@router.get("/pricing", response_model=PricingResponse | None)
def get_pricing(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    pricing = db.scalars(
        select(TokenPricing).order_by(TokenPricing.effective_from.desc())
    ).first()
    return pricing


@router.post("/pricing", response_model=PricingResponse, status_code=201)
def set_pricing(
    data: PricingRequest,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    pricing = TokenPricing(
        input_price_per_1k=data.input_price_per_1k,
        output_price_per_1k=data.output_price_per_1k,
        effective_from=datetime.now(timezone.utc),
        created_by=current_user.id,
    )
    db.add(pricing)
    db.commit()
    db.refresh(pricing)
    return pricing


@router.post("/pricing/recalculate")
def recalculate_costs(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    """Recalculate total_cost for all applications using current pricing."""
    pricing = db.scalars(
        select(TokenPricing).order_by(TokenPricing.effective_from.desc())
    ).first()
    if not pricing:
        raise HTTPException(status_code=400, detail="No pricing configured")

    input_price = pricing.input_price_per_1k
    output_price = pricing.output_price_per_1k

    apps = db.scalars(select(Application)).all()
    updated = 0
    for app in apps:
        new_cost = (app.prompt_tokens / 1000 * input_price) + (
            app.completion_tokens / 1000 * output_price
        )
        if app.total_cost != new_cost:
            app.total_cost = new_cost
            updated += 1

    db.commit()
    return {"detail": f"Recalculated costs for {updated} applications"}


# --- Knowledge Base CRUD ---


@router.get("/knowledge-bases", response_model=list[KnowledgeBaseResponse])
def list_knowledge_bases(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(KnowledgeBase).order_by(KnowledgeBase.created_at.desc())
    ).all()


@router.post(
    "/knowledge-bases",
    response_model=KnowledgeBaseResponse,
    status_code=201,
)
def create_knowledge_base(
    data: KnowledgeBaseCreate,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    kb = KnowledgeBase(name=data.name, content=data.content, tech_stack_id=data.tech_stack_id)
    db.add(kb)
    db.commit()
    db.refresh(kb)
    return kb


@router.put("/knowledge-bases/{kb_id}", response_model=KnowledgeBaseResponse)
def update_knowledge_base(
    kb_id: str,
    data: KnowledgeBaseUpdate,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    kb = db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    if data.name is not None:
        kb.name = data.name
    if data.content is not None:
        kb.content = data.content
    if data.is_active is not None:
        kb.is_active = data.is_active
    if data.tech_stack_id is not None:
        kb.tech_stack_id = data.tech_stack_id
    db.commit()
    db.refresh(kb)
    return kb


@router.delete("/knowledge-bases/{kb_id}", status_code=204)
def delete_knowledge_base(
    kb_id: str,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    kb = db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    db.delete(kb)
    db.commit()


# --- Tech Stack CRUD ---


@router.get("/tech-stacks", response_model=list[TechStackResponse])
def list_tech_stacks(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(TechStack).order_by(TechStack.created_at.asc())
    ).all()


@router.post("/tech-stacks", response_model=TechStackResponse, status_code=201)
def create_tech_stack(
    data: TechStackCreate,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    existing = db.scalars(
        select(TechStack).where(TechStack.name == data.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tech stack with this name already exists")
    ts = TechStack(name=data.name, description=data.description)
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return ts


@router.put("/tech-stacks/{ts_id}", response_model=TechStackResponse)
def update_tech_stack(
    ts_id: str,
    data: TechStackUpdate,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    ts = db.get(TechStack, ts_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Tech stack not found")
    if data.name is not None:
        ts.name = data.name
    if data.description is not None:
        ts.description = data.description
    if data.is_active is not None:
        ts.is_active = data.is_active
    db.commit()
    db.refresh(ts)
    return ts


@router.delete("/tech-stacks/{ts_id}", status_code=204)
def delete_tech_stack(
    ts_id: str,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    ts = db.get(TechStack, ts_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Tech stack not found")
    db.delete(ts)
    db.commit()


# --- AI Model Config CRUD ---


def _model_to_response(m: AIModelConfig) -> AIModelConfigResponse:
    return AIModelConfigResponse(
        id=m.id,
        provider=m.provider,
        display_name=m.display_name,
        model_id=m.model_id,
        api_key_set=bool(m.api_key),
        endpoint=m.endpoint,
        api_version=m.api_version,
        input_price_per_1k=m.input_price_per_1k,
        output_price_per_1k=m.output_price_per_1k,
        is_active=m.is_active,
        role=m.role,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


@router.get("/models", response_model=list[AIModelConfigResponse])
def list_models(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    models = db.scalars(
        select(AIModelConfig).order_by(AIModelConfig.created_at.desc())
    ).all()
    return [_model_to_response(m) for m in models]


@router.post("/models/test")
def test_model(
    data: AIModelConfigCreate,
    current_user: User = Depends(_admin_only),
):
    """Test if a model configuration is reachable before saving."""
    valid_providers = {"azure_openai", "openai", "anthropic", "google"}
    if data.provider not in valid_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Must be one of: {', '.join(sorted(valid_providers))}",
        )
    config = {
        "provider": data.provider,
        "model_id": data.model_id,
        "api_key": data.api_key,
        "endpoint": data.endpoint,
        "api_version": data.api_version,
    }
    try:
        reply = ai_service.test_model_connection(config)
        return {"success": True, "reply": reply}
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/models", response_model=AIModelConfigResponse, status_code=201)
def create_model(
    data: AIModelConfigCreate,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    valid_providers = {"azure_openai", "openai", "anthropic", "google"}
    if data.provider not in valid_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Must be one of: {', '.join(sorted(valid_providers))}",
        )
    model = AIModelConfig(
        provider=data.provider,
        display_name=data.display_name,
        model_id=data.model_id,
        api_key=data.api_key,
        endpoint=data.endpoint,
        api_version=data.api_version,
        input_price_per_1k=data.input_price_per_1k,
        output_price_per_1k=data.output_price_per_1k,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return _model_to_response(model)


@router.put("/models/{model_id}", response_model=AIModelConfigResponse)
def update_model(
    model_id: str,
    data: AIModelConfigUpdate,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    model = db.get(AIModelConfig, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model config not found")
    if data.display_name is not None:
        model.display_name = data.display_name
    if data.model_id is not None:
        model.model_id = data.model_id
    if data.api_key is not None:
        model.api_key = data.api_key
    if data.endpoint is not None:
        model.endpoint = data.endpoint
    if data.api_version is not None:
        model.api_version = data.api_version
    if data.input_price_per_1k is not None:
        model.input_price_per_1k = data.input_price_per_1k
    if data.output_price_per_1k is not None:
        model.output_price_per_1k = data.output_price_per_1k
    db.commit()
    db.refresh(model)
    return _model_to_response(model)


@router.delete("/models/{model_id}", status_code=204)
def delete_model(
    model_id: str,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    model = db.get(AIModelConfig, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model config not found")
    if model.is_active:
        raise HTTPException(
            status_code=400, detail="Cannot delete the active model"
        )
    db.delete(model)
    db.commit()


@router.post("/models/{model_id}/activate", response_model=AIModelConfigResponse)
def activate_model(
    model_id: str,
    body: ActivateModelRequest | None = None,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    model = db.get(AIModelConfig, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model config not found")

    role = (body.role if body else None) or "primary"
    if role not in ("primary", "utility"):
        raise HTTPException(status_code=400, detail="Role must be 'primary' or 'utility'")

    # Deactivate others with the same role
    same_role = db.scalars(
        select(AIModelConfig).where(
            AIModelConfig.role == role,
            AIModelConfig.is_active.is_(True),
        )
    ).all()
    for m in same_role:
        m.is_active = False
        m.role = None

    model.is_active = True
    model.role = role
    db.commit()
    db.refresh(model)
    return _model_to_response(model)


@router.post("/models/{model_id}/deactivate", response_model=AIModelConfigResponse)
def deactivate_model(
    model_id: str,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    model = db.get(AIModelConfig, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model config not found")
    model.is_active = False
    model.role = None
    db.commit()
    db.refresh(model)
    return _model_to_response(model)


# --- System Logs ---


@router.get("/logs", response_model=list[SystemLogItem])
def list_logs(
    level: str | None = None,
    category: str | None = None,
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    stmt = select(SystemLog).order_by(SystemLog.created_at.desc())
    if level:
        stmt = stmt.where(SystemLog.level == level.upper())
    if category:
        stmt = stmt.where(SystemLog.category == category.lower())
    if from_date:
        stmt = stmt.where(SystemLog.created_at >= from_date)
    if to_date:
        stmt = stmt.where(SystemLog.created_at < to_date + timedelta(days=1))
    stmt = stmt.offset(offset).limit(limit)
    return db.scalars(stmt).all()


@router.get("/logs/count")
def count_logs(
    level: str | None = None,
    category: str | None = None,
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    stmt = select(func.count(SystemLog.id))
    if level:
        stmt = stmt.where(SystemLog.level == level.upper())
    if category:
        stmt = stmt.where(SystemLog.category == category.lower())
    if from_date:
        stmt = stmt.where(SystemLog.created_at >= from_date)
    if to_date:
        stmt = stmt.where(SystemLog.created_at < to_date + timedelta(days=1))
    return {"count": db.scalar(stmt) or 0}


# ── Banned Companies ──────────────────────────────────────────────────────────

@router.get("/banned-companies", response_model=list[BannedCompanyResponse])
def list_banned_companies(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(BannedCompany).order_by(BannedCompany.name)
    ).all()


@router.post("/banned-companies", response_model=BannedCompanyResponse, status_code=201)
def create_banned_company(
    data: BannedCompanyCreate,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    existing = db.scalars(
        select(BannedCompany).where(
            func.lower(BannedCompany.name) == data.name.strip().lower()
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Company is already banned")
    entry = BannedCompany(
        name=data.name.strip(),
        description=data.description or None,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/banned-companies/{entry_id}", response_model=BannedCompanyResponse)
def update_banned_company(
    entry_id: str,
    data: BannedCompanyUpdate,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    entry = db.get(BannedCompany, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    if data.name is not None:
        entry.name = data.name.strip()
    if data.description is not None:
        entry.description = data.description or None
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/banned-companies/{entry_id}", status_code=204)
def delete_banned_company(
    entry_id: str,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    entry = db.get(BannedCompany, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# System Settings
# ---------------------------------------------------------------------------

from pydantic import BaseModel as _BaseModel


class SystemSettingResponse(_BaseModel):
    key: str
    value: str | None


class SystemSettingUpdate(_BaseModel):
    value: str | None


ALLOWED_SETTING_KEYS = {"default_chat_model_id", "default_resume_model_id"}


@router.get("/settings", response_model=list[SystemSettingResponse])
def get_system_settings(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    rows = db.scalars(select(SystemSetting)).all()
    result = {r.key: r.value for r in rows}
    return [
        SystemSettingResponse(key=k, value=result.get(k))
        for k in ALLOWED_SETTING_KEYS
    ]


@router.put("/settings/{key}", response_model=SystemSettingResponse)
def update_system_setting(
    key: str,
    data: SystemSettingUpdate,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    if key not in ALLOWED_SETTING_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown setting key: {key}")
    row = db.get(SystemSetting, key)
    if row is None:
        row = SystemSetting(key=key, value=data.value)
        db.add(row)
    else:
        row.value = data.value
    db.commit()
    db.refresh(row)
    return SystemSettingResponse(key=row.key, value=row.value)
