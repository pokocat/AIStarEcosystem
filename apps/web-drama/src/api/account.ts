// account.ts — 让历史组件 `import * as AccountApi from "@/api/account"` 拿 namespace。
// mock 分支收敛在 packages/api-client/_mocks.ts。
export {
  getMe,
  updateProfile,
  getMyTenants,
  getMyWallet,
  getMyLedger,
} from "@ai-star-eco/api-client/api/account";
