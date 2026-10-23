import { User } from '../types';

export const PERM_INSPECTION_CREATE = 'inspection:create';
export const PERM_INSPECTION_READ = 'inspection:read';
export const PERM_INSPECTION_READ_ALL = 'inspection:read_all';
export const PERM_INSPECTION_INFER = 'inspection:infer';
export const PERM_INSPECTION_RETRY = 'inspection:retry';
export const PERM_INSPECTION_REVIEW = 'inspection:review';

export const PERM_DEFECT_FLAG = 'defect:flag';
export const PERM_DEFECT_CREATE = 'defect:create';
export const PERM_DEFECT_READ = 'defect:read';
export const PERM_DEFECT_UPDATE = 'defect:update';
export const PERM_DEFECT_RESOLVE = 'defect:resolve';

export const PERM_CAPA_CREATE = 'capa:create';
export const PERM_CAPA_READ = 'capa:read';
export const PERM_CAPA_UPDATE = 'capa:update';
export const PERM_CAPA_ASSIGN = 'capa:assign';
export const PERM_CAPA_COMPLETE = 'capa:complete';
export const PERM_CAPA_VERIFY = 'capa:verify';
export const PERM_CAPA_CLOSE = 'capa:close';

export const PERM_BATCH_READ = 'batch:read';
export const PERM_BATCH_CREATE = 'batch:create';
export const PERM_BATCH_QUARANTINE = 'batch:quarantine';
export const PERM_BATCH_RELEASE = 'batch:release';

export const PERM_DASHBOARD_READ = 'dashboard:read';
export const PERM_DASHBOARD_KPI = 'dashboard:kpi';
export const PERM_REPORTS_READ = 'reports:read';

export const PERM_USERS_READ = 'users:read';
export const PERM_USERS_CREATE = 'users:create';
export const PERM_USERS_UPDATE = 'users:update';
export const PERM_USERS_DEACTIVATE = 'users:deactivate';
export const PERM_ROLES_ASSIGN = 'roles:assign';
export const PERM_AUDIT_READ = 'audit:read';
export const PERM_SYSTEM_CONFIG = 'system:config';

export function normalizeRole(roleStr?: string): string {
  if (!roleStr) return 'production_operator';
  const r = roleStr.toLowerCase().trim();
  if (['operator', 'production_operator', 'supervisor'].includes(r)) return 'production_operator';
  if (['inspector', 'quality_inspector'].includes(r)) return 'quality_inspector';
  if (['quality_manager', 'qm'].includes(r)) return 'quality_manager';
  if (['admin', 'system_admin'].includes(r)) return 'system_admin';
  return r;
}

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  // Authoritative server-provided permissions list
  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions.includes(permission);
  }
  // Client-side fallback based on normalized role
  const norm = normalizeRole(user.role);
  if (norm === 'quality_manager') return true;
  if (norm === 'quality_inspector') {
    return [
      PERM_INSPECTION_CREATE, PERM_INSPECTION_READ, PERM_INSPECTION_READ_ALL,
      PERM_INSPECTION_INFER, PERM_INSPECTION_RETRY, PERM_INSPECTION_REVIEW,
      PERM_DEFECT_FLAG, PERM_DEFECT_CREATE, PERM_DEFECT_READ, PERM_DEFECT_UPDATE,
      PERM_CAPA_READ, PERM_BATCH_READ, PERM_DASHBOARD_READ, PERM_DASHBOARD_KPI,
      PERM_REPORTS_READ, PERM_AUDIT_READ
    ].includes(permission);
  }
  if (norm === 'system_admin') {
    return [
      PERM_USERS_READ, PERM_USERS_CREATE, PERM_USERS_UPDATE, PERM_USERS_DEACTIVATE,
      PERM_ROLES_ASSIGN, PERM_AUDIT_READ, PERM_SYSTEM_CONFIG, PERM_DASHBOARD_READ,
      PERM_REPORTS_READ, PERM_INSPECTION_READ, PERM_INSPECTION_READ_ALL,
      PERM_DEFECT_READ, PERM_CAPA_READ, PERM_BATCH_READ
    ].includes(permission);
  }
  // production_operator
  return [
    PERM_INSPECTION_CREATE, PERM_INSPECTION_READ, PERM_INSPECTION_INFER,
    PERM_DEFECT_FLAG, PERM_DEFECT_READ, PERM_CAPA_READ, PERM_CAPA_COMPLETE,
    PERM_BATCH_READ, PERM_BATCH_CREATE, PERM_DASHBOARD_READ
  ].includes(permission);
}

export function hasAnyPermission(user: User | null, ...permissions: string[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

export function canReviewInspection(user: User | null, inspectorId?: number): { allowed: boolean; reason?: string } {
  if (!user) return { allowed: false, reason: 'Authentication required' };
  
  if (!hasPermission(user, PERM_INSPECTION_REVIEW)) {
    return {
      allowed: false,
      reason: `Your role (${user.role}) does not have quality review clearance. Only Quality Inspectors and Managers may confirm defect dispositions.`
    };
  }

  // Separation of duties rule: submitter cannot approve own work
  if (inspectorId && user.id === inspectorId) {
    return {
      allowed: false,
      reason: 'Separation of Duties violation: An inspector cannot review or approve their own inspection submission. An independent Quality Manager or Inspector must verify this record.'
    };
  }

  return { allowed: true };
}

export function canVerifyCapa(user: User | null, assigneeId?: number): { allowed: boolean; reason?: string } {
  if (!user) return { allowed: false, reason: 'Authentication required' };

  if (!hasPermission(user, PERM_CAPA_VERIFY)) {
    return {
      allowed: false,
      reason: 'Only Quality Managers have authorization to verify and close corrective actions.'
    };
  }

  // Separation of duties: assignee cannot verify their own completion
  if (assigneeId && user.id === assigneeId) {
    return {
      allowed: false,
      reason: 'Separation of Duties violation: The assigned owner cannot verify or sign off their own corrective action completion. An independent Quality Manager must verify.'
    };
  }

  return { allowed: true };
}

export function canManageBatches(user: User | null): boolean {
  return hasPermission(user, PERM_BATCH_QUARANTINE) || hasPermission(user, PERM_BATCH_RELEASE);
}

export function canCreateCapa(user: User | null): boolean {
  return hasPermission(user, PERM_CAPA_CREATE);
}

export function canManageDefects(user: User | null): boolean {
  return hasPermission(user, PERM_DEFECT_UPDATE) || hasPermission(user, PERM_DEFECT_RESOLVE);
}

export function canManageUsers(user: User | null): boolean {
  return hasPermission(user, PERM_USERS_UPDATE) && hasPermission(user, PERM_ROLES_ASSIGN);
}

export function getRoleBadge(role?: string): { label: string; desc: string; badgeColor: string } {
  const norm = normalizeRole(role);
  switch (norm) {
    case 'quality_manager':
      return {
        label: 'Quality Manager',
        desc: 'Plant Quality Governance & Quarantine Authority',
        badgeColor: 'bg-[#71845B] text-[#FFFFFF]'
      };
    case 'quality_inspector':
      return {
        label: 'Quality Inspector',
        desc: 'Visual Evidence Analysis & Defect Sign-off',
        badgeColor: 'bg-[#7895A5] text-[#FFFFFF]'
      };
    case 'system_admin':
      return {
        label: 'System Admin',
        desc: 'Security, User Provisioning & Audit Administration',
        badgeColor: 'bg-[#292A26] text-[#FFFFFF]'
      };
    case 'production_operator':
    default:
      return {
        label: 'Production Operator',
        desc: 'Shop Floor Optical Intake & Line Ingestion',
        badgeColor: 'bg-[#C49A52] text-[#FFFFFF]'
      };
  }
}
