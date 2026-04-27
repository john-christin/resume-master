from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import require_role
from database import get_db
from services import log_service
from models.ai_model_config import AIModelConfig
from models.application import Application
from services import ai_service
from models.knowledge_base import KnowledgeBase
from models.profile import Profile
from models.system_log import SystemLog
from models.token_pricing import TokenPricing
from models.user import User
from schemas.admin import (
    ActivateModelRequest,
    AIModelConfigCreate,
    AIModelConfigResponse,
    AIModelConfigUpdate,
    DashboardStats,
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    KnowledgeBaseUpdate,
    PricingRequest,
    PricingResponse,
    ProfileStat,
    SystemLogItem,
    UserApproveRequest,
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
    kb = KnowledgeBase(name=data.name, content=data.content)
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
