import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import require_role
from database import get_db
from models.doc_style import DocStyle
from models.user import User
from schemas.doc_style import DocStyleCreate, DocStyleResponse, DocStyleUpdate

router = APIRouter(prefix="/api/doc-styles", tags=["doc-styles"])

_any_user = require_role("admin", "bidder", "caller")
_admin_only = require_role("admin")


@router.get("", response_model=list[DocStyleResponse])
def list_doc_styles(
    current_user: User = Depends(_any_user),
    db: Session = Depends(get_db),
):
    return db.scalars(select(DocStyle).order_by(DocStyle.created_at.asc())).all()


@router.post("", response_model=DocStyleResponse, status_code=201)
def create_doc_style(
    data: DocStyleCreate,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    existing = db.scalars(select(DocStyle).where(DocStyle.name == data.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="A style with this name already exists")
    style = DocStyle(
        name=data.name,
        description=data.description,
        is_system=False,
        config=json.dumps(data.config.model_dump()),
        created_by=current_user.id,
    )
    db.add(style)
    db.commit()
    db.refresh(style)
    return style


@router.put("/{style_id}", response_model=DocStyleResponse)
def update_doc_style(
    style_id: str,
    data: DocStyleUpdate,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    style = db.get(DocStyle, style_id)
    if not style:
        raise HTTPException(status_code=404, detail="Doc style not found")
    if data.name is not None:
        existing = db.scalars(
            select(DocStyle).where(DocStyle.name == data.name, DocStyle.id != style_id)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="A style with this name already exists")
        style.name = data.name
    if data.description is not None:
        style.description = data.description
    if data.config is not None:
        style.config = json.dumps(data.config.model_dump())
    db.commit()
    db.refresh(style)
    return style


@router.delete("/{style_id}", status_code=204)
def delete_doc_style(
    style_id: str,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
):
    style = db.get(DocStyle, style_id)
    if not style:
        raise HTTPException(status_code=404, detail="Doc style not found")
    if style.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete a system style")
    db.delete(style)
    db.commit()
