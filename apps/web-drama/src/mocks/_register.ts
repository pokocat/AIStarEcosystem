// ─────────────────────────────────────────────────────────────────────────────
// mocks/_register.ts — 集中注册所有 mock handler 到 apiFetch 拦截层。
// 由 app/providers.tsx 顶层 side-effect import；USE_MOCK=0 时 registry 不被读取。
//
// 添加新域：在此 import "./_handlers/<domain>"。每个 handler 文件末尾自带
// registerMocks([...]) 调用。
//
// 顺序意义：同 method+path 后注册者覆盖之前。drama 的 finance handler 故意覆盖
// api-client bootstrap 的 /me/wallet handler，体现 drama 业务的钱包视图。
// ─────────────────────────────────────────────────────────────────────────────

import "./_handlers/artists";
import "./_handlers/dap-avatars";
import "./_handlers/community";
import "./_handlers/film";
import "./_handlers/distribution";
import "./_handlers/wardrobe";
import "./_handlers/notifications";
import "./_handlers/pose";
import "./_handlers/store";
import "./_handlers/generation";
import "./_handlers/settings";
import "./_handlers/scripts";
import "./_handlers/appearance-forge";
// finance 最后注册，覆盖 api-client bootstrap 的 /me/wallet：
import "./_handlers/finance";
