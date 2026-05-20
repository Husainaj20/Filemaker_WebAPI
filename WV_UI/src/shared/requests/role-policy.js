const ROLE_PERMISSIONS = {
  viewer: ["requests:read", "reports:view"],
  operator: [
    "requests:read",
    "requests:write",
    "reports:view",
    "reports:export",
  ],
  admin: [
    "requests:read",
    "requests:write",
    "reports:view",
    "reports:export",
    "diagnostics:view",
  ],
};

export const ROLES = Object.freeze(Object.keys(ROLE_PERMISSIONS));

export function normalizeRole(role, fallback = "operator") {
  const normalized = String(role || "").trim().toLowerCase();
  if (ROLE_PERMISSIONS[normalized]) return normalized;

  const normalizedFallback = String(fallback || "").trim().toLowerCase();
  if (ROLE_PERMISSIONS[normalizedFallback]) return normalizedFallback;

  return "operator";
}

export function getRolePermissions(role, fallback = "operator") {
  return ROLE_PERMISSIONS[normalizeRole(role, fallback)] || [];
}

export function hasPermission(role, permission, fallback = "operator") {
  return getRolePermissions(role, fallback).includes(String(permission || ""));
}
