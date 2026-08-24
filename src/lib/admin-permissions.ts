import { verifyAdminAuth } from "./admin-auth";
import { NextResponse } from "next/server";

export interface PermissionDefinition {
  key: string;
  label: string;
  category: string;
  description: string;
}

export const CPANEL_PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // System Overview
  { key: "metrics.view", label: "View Metrics & Operations", category: "System Overview", description: "Access dashboard system counts and aggregate balances" },
  { key: "admins.view", label: "View Administrators", category: "Admin Management", description: "Access administrative staff directory" },
  { key: "admins.manage", label: "Manage Administrators", category: "Admin Management", description: "Create, edit roles/permissions, and disable administrative accounts" },

  // User Management
  { key: "users.view", label: "View Users Directory", category: "User Management", description: "Search and view registered customer accounts" },
  { key: "users.manage", label: "Manage Users & Balances", category: "User Management", description: "Create accounts, update roles, or adjust user balances" },
  { key: "kyc.view", label: "View KYC Submissions", category: "User Management", description: "Access customer identity verification queue" },
  { key: "kyc.manage", label: "Approve / Reject KYC", category: "User Management", description: "Approve or reject customer KYC document submissions" },
  { key: "freeze.manage", label: "Account Freeze & Security", category: "User Management", description: "Freeze or unfreeze customer accounts and set notices" },
  { key: "limits.manage", label: "Account Limits Manager", category: "User Management", description: "Configure daily and transaction velocity caps" },

  // Branding & Customization
  { key: "branding.manage", label: "Branding & App Config", category: "Branding", description: "Update platform titles, logos, and support details" },
  { key: "banners.manage", label: "Slide Banners Manager", category: "Branding", description: "Upload and manage promotional slides across app routes" },
  { key: "bank_logos.manage", label: "Bank Logos Manager", category: "Branding", description: "Manage and repair high-res financial institution logos" },
  { key: "bill_logos.manage", label: "Bill Logos Manager", category: "Branding", description: "Manage biller and network operator brand logos" },
  { key: "whatsapp.manage", label: "WhatsApp Link & Device", category: "Branding", description: "Connect and monitor Baileys WhatsApp integration" },

  // Finance & Operations
  { key: "vtu.manage", label: "VTU Markups & Pricing", category: "Finance", description: "Set network airtime/data pricing markups" },
  { key: "investments.manage", label: "Fixed Deposits & Yields", category: "Finance", description: "Manage investment interest rates and user portfolios" },
  { key: "deposit.manage", label: "Capital Deposit Tool", category: "Finance", description: "Atomically deposit capital into customer wallets" },

  // E-Commerce Store
  { key: "store.view", label: "View E-Store Directory", category: "Store", description: "Access store products, orders, categories, and stock" },
  { key: "store.manage", label: "Manage Store Products & Orders", category: "Store", description: "Add/edit products, fulfill orders, and manage inventory" },

  // Audit & History
  { key: "user_history.view", label: "User History & Audit Inspector", category: "Audit", description: "Inspect comprehensive user audit ledgers and activity" },
];

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["*"],
  admin: [
    "metrics.view", "admins.view", "users.view", "users.manage",
    "kyc.view", "kyc.manage", "freeze.manage", "limits.manage",
    "branding.manage", "banners.manage", "bank_logos.manage", "bill_logos.manage",
    "whatsapp.manage", "vtu.manage", "investments.manage", "deposit.manage",
    "store.view", "store.manage", "user_history.view"
  ],
  support: ["metrics.view", "users.view", "kyc.view", "store.view", "user_history.view"],
  finance: ["metrics.view", "users.view", "vtu.manage", "investments.manage", "deposit.manage", "user_history.view"],
  kyc_admin: ["metrics.view", "users.view", "kyc.view", "kyc.manage", "user_history.view"],
  read_only: ["metrics.view", "admins.view", "users.view", "kyc.view", "store.view", "user_history.view"],
};

/**
 * Checks if an administrator account has permission for a specific feature key.
 */
export function hasAdminPermission(
  adminDoc: { role?: string; permissions?: string[] } | null | undefined,
  requiredPermission: string
): boolean {
  if (!adminDoc) return false;

  const role = (adminDoc.role || "").toLowerCase();
  if (role === "super_admin") return true;

  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[role] || [];
  const permissions = Array.isArray(adminDoc.permissions) && adminDoc.permissions.length > 0
    ? adminDoc.permissions
    : roleDefaults;

  if (permissions.includes("*")) return true;

  return permissions.includes(requiredPermission);
}

/**
 * Server-side helper to authenticate the request and enforce a specific admin permission.
 */
export async function requireAdminPermission(
  req: Request,
  requiredPermission: string
): Promise<{
  auth?: { uid: string; isAdmin: boolean; email?: string; role?: string; permissions?: string[] };
  authorized: boolean;
  response?: NextResponse;
}> {
  try {
    const auth = await verifyAdminAuth(req);

    if (!auth.isAdmin) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Forbidden", message: "Administrative authentication required." },
          { status: 403 }
        ),
      };
    }

    const role = (auth.role || "").toLowerCase();
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[role] || [];
    const permissions = Array.isArray(auth.permissions) && auth.permissions.length > 0
      ? auth.permissions
      : roleDefaults;

    const isAuthorized = role === "super_admin" || permissions.includes("*") || permissions.includes(requiredPermission);

    if (!isAuthorized) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: "Forbidden",
            message: `Access Denied: You do not have permission ('${requiredPermission}') to access this resource.`,
          },
          { status: 403 }
        ),
      };
    }

    return { auth, authorized: true };
  } catch (err: any) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized", message: err.message || "Authentication failed." },
        { status: 401 }
      ),
    };
  }
}
