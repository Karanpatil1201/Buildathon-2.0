from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, AuditLog
from app.schemas import UserCreate, UserOut, Token, UserLogin, UserUpdate, AuditLogOut
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.rbac import (
    PERM_USERS_READ, PERM_USERS_CREATE, PERM_USERS_UPDATE,
    PERM_ROLES_ASSIGN, PERM_AUDIT_READ, PERM_CAPA_CREATE,
    require_permissions, require_any_permission, has_permission, normalize_role
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_USERS_CREATE))
):
    existing = db.query(User).filter(
        (User.username == user_in.username) | (User.email == user_in.email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    hashed = get_password_hash(user_in.password)
    user = User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hashed,
        role=user_in.role,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit = AuditLog(
        entity_type="USER",
        entity_id=user.id,
        actor_id=current_user.id,
        action="CREATE_USER",
        previous_state=None,
        new_state=user.role,
        notes=f"Admin {current_user.username} created user {user.username} with role {user.role}"
    )
    db.add(audit)
    db.commit()

    return user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user account")
    
    token = create_access_token({"sub": user.username, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(PERM_USERS_READ, PERM_CAPA_CREATE))
):
    return db.query(User).all()

@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_USERS_UPDATE, PERM_ROLES_ASSIGN))
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Self-escalation / Self-promotion protection:
    # Users cannot modify their own role or promote themselves
    if user_in.role is not None and user_in.role != target_user.role:
        if current_user.id == target_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Self-escalation policy violation: Users cannot alter their own assigned role or permissions."
            )
        target_user.role = user_in.role

    if user_in.full_name is not None:
        target_user.full_name = user_in.full_name
    if user_in.email is not None:
        target_user.email = user_in.email
    if user_in.is_active is not None:
        target_user.is_active = user_in.is_active

    audit = AuditLog(
        entity_type="USER",
        entity_id=target_user.id,
        actor_id=current_user.id,
        action="UPDATE_USER_PERMISSIONS",
        previous_state=None,
        new_state=target_user.role,
        notes=f"Admin {current_user.username} updated profile for user {target_user.username}"
    )
    db.add(audit)
    db.commit()
    db.refresh(target_user)
    return target_user

@router.get("/audit", response_model=List[AuditLogOut])
def list_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_AUDIT_READ))
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return logs

