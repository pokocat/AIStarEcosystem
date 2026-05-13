// auth.ts — re-export AuthApi 给历史组件用。mock 分支已在 packages/api-client。
export {
  activate,
  listDevAccounts,
  devLogin,
  logout,
  type DevAccount,
  type DevLoginResult,
} from "@ai-star-eco/api-client/api/auth";
