// ============================================================
// mocks/auth-override.ts — web-aiavatar 本地 mock 覆盖（仅 USE_MOCK）。
//
// 共享 _bootstrap-mocks 的 /me、/auth/dev-login 返回的是无 operatorRole 的普通用户。
// 运营配置能力需要 operatorRole，这里按 localStorage 开关（登录页「以运营身份进入」）
// 覆盖这两个 handler，注入 operatorRole=operator。仅前端 mock 演示用；live 由后端 JWT.role 决定。
// ============================================================
import { registerMock, mockDelay, setAuthToken } from "@ai-star-eco/api-client";
import type { AepUser } from "@ai-star-eco/types/account";

const OPERATOR_FLAG = "aiavatar.mock.operator";

export function setMockOperator(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(OPERATOR_FLAG, "1");
    else window.localStorage.removeItem(OPERATOR_FLAG);
  } catch {
    /* ignore */
  }
}
export function isMockOperator(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OPERATOR_FLAG) === "1";
  } catch {
    return false;
  }
}

const NOW = new Date().toISOString();
const BASE_USER: AepUser = {
  id: "aiavatar-demo-user",
  username: "aiavatar_demo",
  displayName: "演示创作者",
  kind: "studio",
  status: "active",
  operatorRole: null,
  platforms: [],
  emailVerified: false,
  phoneVerified: false,
  hasPassword: false,
  langPreference: "zh",
  createdAt: NOW,
  updatedAt: NOW,
  lastLoginAt: NOW,
  studio: null,
};

function currentUser(): AepUser {
  const op = isMockOperator();
  return {
    ...BASE_USER,
    displayName: op ? "演示运营" : "演示创作者",
    operatorRole: op ? "operator" : null,
  };
}

let registered = false;
/** 注册本地 mock 覆盖（幂等）。在 providers 客户端挂载时调一次。 */
export function installAuthOverrides() {
  if (registered) return;
  registered = true;
  // 覆盖 /me：按运营开关返回 operatorRole。
  registerMock("GET", "/me", () => mockDelay(currentUser()));
  // 覆盖 dev-login：写 token + 返回带 operatorRole 的用户。
  registerMock("POST", "/auth/dev-login", () => {
    setAuthToken("mock-aiavatar-token");
    return mockDelay({ token: "mock-aiavatar-token", user: currentUser() });
  });
}
