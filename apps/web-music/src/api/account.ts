// account.ts — re-export AccountApi 的所有函数为 top-level，让历史组件可以
// `import * as AccountApi from "@/api/account"` 拿到 namespace（不变签名）。
// 业务 mock 分支已经收敛到 packages/api-client 的 _mocks.ts。
export {
  getMe,
  updateProfile,
  getMyTenants,
  getMyWallet,
  getMyLedger,
} from "@ai-star-eco/api-client/api/account";
