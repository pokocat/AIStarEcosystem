import type { OperatorRole } from "@ai-star-eco/types/account";

export function canUseOperatorTools(role?: OperatorRole | null): boolean {
  return role === "operator" || role === "super_admin";
}
