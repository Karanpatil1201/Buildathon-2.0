from enum import Enum
from typing import List, Set, Dict, Optional
from fastapi import HTTPException, status, Depends
from app.models import User

class Role(str, Enum):
    PRODUCTION_OPERATOR = "production_operator"
    QUALITY_INSPECTOR = "quality_inspector"
    QUALITY_MANAGER = "quality_manager"
    SYSTEM_ADMIN = "system_admin"

# Normalization mapping for backward compatibility with existing databases and tests
ROLE_ALIASES: Dict[str, Role] = {
    "operator": Role.PRODUCTION_OPERATOR,
    "production_operator": Role.PRODUCTION_OPERATOR,
    "supervisor": Role.PRODUCTION_OPERATOR,  # Production supervisor operating on the line
    "inspector": Role.QUALITY_INSPECTOR,
    "quality_inspector": Role.QUALITY_INSPECTOR,
    "quality_manager": Role.QUALITY_MANAGER,
    "qm": Role.QUALITY_MANAGER,
    "admin": Role.SYSTEM_ADMIN,
    "system_admin": Role.SYSTEM_ADMIN,
}

def normalize_role(role_str: Optional[str]) -> Role:
    if not role_str:
        return Role.PRODUCTION_OPERATOR
    normalized = role_str.strip().lower()
    return ROLE_ALIASES.get(normalized, Role.PRODUCTION_OPERATOR)

# -------------------------------------------------------------
# Explicit Permission Registry
# -------------------------------------------------------------

# Inspections
PERM_INSPECTION_CREATE = "inspection:create"
PERM_INSPECTION_READ = "inspection:read"
PERM_INSPECTION_READ_ALL = "inspection:read_all"
PERM_INSPECTION_INFER = "inspection:infer"
PERM_INSPECTION_RETRY = "inspection:retry"
PERM_INSPECTION_REVIEW = "inspection:review"

# Defects
PERM_DEFECT_FLAG = "defect:flag"
PERM_DEFECT_CREATE = "defect:create"
PERM_DEFECT_READ = "defect:read"
PERM_DEFECT_UPDATE = "defect:update"
PERM_DEFECT_RESOLVE = "defect:resolve"

# Corrective Actions (CAPA)
PERM_CAPA_CREATE = "capa:create"
PERM_CAPA_READ = "capa:read"
PERM_CAPA_UPDATE = "capa:update"
PERM_CAPA_ASSIGN = "capa:assign"
PERM_CAPA_COMPLETE = "capa:complete"
PERM_CAPA_VERIFY = "capa:verify"
PERM_CAPA_CLOSE = "capa:close"

# Batches & Containment
PERM_BATCH_READ = "batch:read"
PERM_BATCH_CREATE = "batch:create"
PERM_BATCH_QUARANTINE = "batch:quarantine"
PERM_BATCH_RELEASE = "batch:release"

# Reports & Dashboard
PERM_DASHBOARD_READ = "dashboard:read"
PERM_DASHBOARD_KPI = "dashboard:kpi"
PERM_REPORTS_READ = "reports:read"

# Administration & Security
PERM_USERS_READ = "users:read"
PERM_USERS_CREATE = "users:create"
PERM_USERS_UPDATE = "users:update"
PERM_USERS_DEACTIVATE = "users:deactivate"
PERM_ROLES_ASSIGN = "roles:assign"
PERM_AUDIT_READ = "audit:read"
PERM_SYSTEM_CONFIG = "system:config"

# -------------------------------------------------------------
# Role-to-Permission Policy Mapping
# -------------------------------------------------------------

ROLE_PERMISSIONS: Dict[Role, Set[str]] = {
    # 1. PRODUCTION OPERATOR
    # Can upload images, run inference, view permitted records, view batches.
    # CANNOT confirm defects, sign off quality decisions, or manage/verify CAPA.
    Role.PRODUCTION_OPERATOR: {
        PERM_INSPECTION_CREATE,
        PERM_INSPECTION_READ,
        PERM_INSPECTION_INFER,
        PERM_DEFECT_FLAG,
        PERM_DEFECT_READ,
        PERM_CAPA_READ,
        PERM_CAPA_COMPLETE,  # Operator can mark an assigned remediation step completed
        PERM_BATCH_READ,
        PERM_BATCH_CREATE,
        PERM_DASHBOARD_READ,
    },

    # 2. QUALITY INSPECTOR
    # Access review workbench and Grad-CAM evidence.
    # Can confirm defects or mark no defect, request additional evidence.
    # CANNOT manage users, change model config, or verify/close their own CAPA.
    Role.QUALITY_INSPECTOR: {
        PERM_INSPECTION_CREATE,
        PERM_INSPECTION_READ,
        PERM_INSPECTION_READ_ALL,
        PERM_INSPECTION_INFER,
        PERM_INSPECTION_RETRY,
        PERM_INSPECTION_REVIEW,
        PERM_DEFECT_FLAG,
        PERM_DEFECT_CREATE,
        PERM_DEFECT_READ,
        PERM_DEFECT_UPDATE,
        PERM_CAPA_READ,
        PERM_BATCH_READ,
        PERM_DASHBOARD_READ,
        PERM_DASHBOARD_KPI,
        PERM_REPORTS_READ,
        PERM_AUDIT_READ,
    },

    # 3. QUALITY MANAGER
    # Owns plant quality performance, defect containment, and CAPA governance.
    # Full defect/CAPA/containment workflow authority.
    # CANNOT grant administrator privileges or manage system accounts.
    Role.QUALITY_MANAGER: {
        PERM_INSPECTION_CREATE,
        PERM_INSPECTION_READ,
        PERM_INSPECTION_READ_ALL,
        PERM_INSPECTION_INFER,
        PERM_INSPECTION_RETRY,
        PERM_INSPECTION_REVIEW,
        PERM_DEFECT_FLAG,
        PERM_DEFECT_CREATE,
        PERM_DEFECT_READ,
        PERM_DEFECT_UPDATE,
        PERM_DEFECT_RESOLVE,
        PERM_CAPA_CREATE,
        PERM_CAPA_READ,
        PERM_CAPA_UPDATE,
        PERM_CAPA_ASSIGN,
        PERM_CAPA_COMPLETE,
        PERM_CAPA_VERIFY,
        PERM_CAPA_CLOSE,
        PERM_BATCH_READ,
        PERM_BATCH_CREATE,
        PERM_BATCH_QUARANTINE,
        PERM_BATCH_RELEASE,
        PERM_DASHBOARD_READ,
        PERM_DASHBOARD_KPI,
        PERM_REPORTS_READ,
        PERM_AUDIT_READ,
        PERM_USERS_READ,  # Quality Manager can view users to populate CAPA assignee list
    },

    # 4. SYSTEM ADMINISTRATOR
    # Manages user accounts, role assignments, system settings, security logs.
    # CRITICAL: Separated from Quality Authority. Does NOT automatically receive
    # permission to approve defects, release batches, or verify/close CAPAs.
    Role.SYSTEM_ADMIN: {
        PERM_USERS_READ,
        PERM_USERS_CREATE,
        PERM_USERS_UPDATE,
        PERM_USERS_DEACTIVATE,
        PERM_ROLES_ASSIGN,
        PERM_AUDIT_READ,
        PERM_SYSTEM_CONFIG,
        PERM_DASHBOARD_READ,
        PERM_REPORTS_READ,
        # Read-only audit visibility on operational records
        PERM_INSPECTION_READ,
        PERM_INSPECTION_READ_ALL,
        PERM_DEFECT_READ,
        PERM_CAPA_READ,
        PERM_BATCH_READ,
    },
}

def get_role_permissions(role_str: Optional[str]) -> List[str]:
    canonical_role = normalize_role(role_str)
    permissions = ROLE_PERMISSIONS.get(canonical_role, set())
    return sorted(list(permissions))

def has_permission(role_str: Optional[str], permission: str) -> bool:
    canonical_role = normalize_role(role_str)
    permissions = ROLE_PERMISSIONS.get(canonical_role, set())
    return permission in permissions

# -------------------------------------------------------------
# FastAPI Dependencies for Authorization
# -------------------------------------------------------------

def require_permissions(*required_perms: str):
    """
    Enforces that the authenticated user possesses ALL of the specified permissions.
    """
    from app.auth import get_current_user
    def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        user_perms = ROLE_PERMISSIONS.get(normalize_role(current_user.role), set())
        missing = [p for p in required_perms if p not in user_perms]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required permission(s): {', '.join(missing)}. Your role: {current_user.role}"
            )
        return current_user
    return permission_checker

def require_any_permission(*required_perms: str):
    """
    Enforces that the authenticated user possesses AT LEAST ONE of the specified permissions.
    """
    from app.auth import get_current_user
    def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        user_perms = ROLE_PERMISSIONS.get(normalize_role(current_user.role), set())
        if not any(p in user_perms for p in required_perms):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required one of: {', '.join(required_perms)}. Your role: {current_user.role}"
            )
        return current_user
    return permission_checker
