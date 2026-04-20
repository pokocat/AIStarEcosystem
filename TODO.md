# 待修清单 / Known Issues

本文件记录已定位但暂未修复的问题，方便后续排期。动手修时请勾掉对应条目并在代码里落实。

## 2026-04-21 · admin 调 server 全 403 + 缺排错手段

### 现象

- 本地联调时，admin (`http://localhost:3003/admin`) 调 `/api/admin/*` 全部 `403 Forbidden`。
- 浏览器 console 上实际报的是 `PARSE_ERROR: Invalid JSON from ...`，因为 Spring Security 默认的 403 响应 body 是空的。
- 排错困难：前端拿不到 code/message，后端日志没有请求级关联 id。

### 根因（互相叠加，需一起治理）

1. **admin `apiFetch` 不发 `Authorization` 头**
   - 位置：`apps/admin/src/api/_client.ts:61-70`
   - 对比 web 实现 `apps/web/src/api/_client.ts:90-96`（会读 `localStorage` token 并带 `Bearer`）。
   - admin 侧完全没有 `getAuthToken` / 头注入逻辑。

2. **admin 没有登录页**
   - `apps/admin/src/app/` 下没有 `login/` 目录，也没有 `AuthContext`。
   - `apps/admin/src/api/auth.ts` 里的 `login()` / `getMe()` 没有任何调用方。
   - 即使修好第 1 点，也没有 token 来源。

3. **`DevAutoAuthFilter` 门控与 `DevAuthController` 不一致**
   - `apps/server/src/main/java/com/aistareco/aep/config/DevAutoAuthFilter.java` 仍是 `@Profile("dev")`。
   - `apps/server/src/main/java/com/aistareco/aep/controller/DevAuthController.java` 已改成 `@ConditionalOnProperty("aep.dev-auth.enabled")`（见 DEPLOYMENT.md §4.4）。
   - 结果：mysql profile + `AEP_DEV_AUTH_ENABLED=true` 时，手动 dev-login 能用，但 admin 前端不带 token 访问时的自动兜底失效 → 403。
   - dev profile 下 DevAutoAuthFilter 应该是能覆盖的，但门控写法不一致本身是个坑。

4. **Spring Security 的 401/403 不走 `GlobalExceptionHandler`**
   - `apps/server/src/main/java/com/aistareco/common/GlobalExceptionHandler.java` 只在 controller 之后生效。
   - Security 链上 `AccessDeniedException` / `AuthenticationException` 由 `AccessDeniedHandler` / `AuthenticationEntryPoint` 处理，当前没自定义 → 默认空 body。
   - 需要补 `SecurityJsonEntryPoint` / `SecurityJsonAccessDeniedHandler`，在 `AepSecurityConfig` 里 wire 上。

5. **后端请求没有 logId / requestId**
   - 现有 `application.yml` 日志 pattern 没有 MDC 字段。
   - 错误响应体里也没有可与日志对照的关联 id。

### 修复方案（落实时再做）

#### server（5 处）

- `apps/server/src/main/java/com/aistareco/aep/config/DevAutoAuthFilter.java`
  - 把 `@Profile("dev")` 改成 `@ConditionalOnProperty(prefix = "aep.dev-auth", name = "enabled", havingValue = "true")`。
  - 同步改内层 `Registration` 的 profile 限制。
- 新增 `apps/server/src/main/java/com/aistareco/common/RequestLogFilter.java`
  - `OncePerRequestFilter`，最高优先级。
  - 生成 8~12 位短 id（`UUID.randomUUID().toString().substring(0,8)`），写入 `MDC.put("logId", ...)`，同时写 `response.addHeader("X-Log-Id", ...)`，`finally` 清 MDC。
- `apps/server/src/main/java/com/aistareco/common/GlobalExceptionHandler.java`
  - 错误响应体加 `logId` 字段（从 `MDC.get("logId")` 读）。
  - `ApiErrorBody` 可能需要补 `logId` 字段或改成 `Map`。
- 新增 `apps/server/src/main/java/com/aistareco/aep/config/SecurityJsonEntryPoint.java` + `SecurityJsonAccessDeniedHandler.java`
  - 两个 handler 都输出同样的 JSON 壳：`{error:{code, message, logId}}`，HTTP 401 / 403。
  - 在 `AepSecurityConfig` 里：`.exceptionHandling(eh -> eh.authenticationEntryPoint(...).accessDeniedHandler(...))`。
- `apps/server/src/main/resources/application.yml`
  - `logging.pattern.level: "%5p [%X{logId:-}]"`，方便每行日志都能看到 logId。

#### admin（4 处）

- `apps/admin/src/api/_client.ts`
  - 加 `AUTH_TOKEN_KEY = "aistareco.admin.token"`、`getAuthToken()` / `setAuthToken()`。
  - 在 `apiFetch` 里带 `Authorization: Bearer <token>`（如果有）。
  - 捕获响应的 `X-Log-Id` 或 body 里的 `logId`，塞进 `ApiError`。
  - 在 throw `ApiError` 之前统一走一次全局 error 回调（由 toast 订阅）。
- 新增 `apps/admin/src/components/ui/sonner.tsx`
  - shadcn 风格的 `Toaster` 包装，统一 position / theme。
- `apps/admin/src/app/layout.tsx`
  - `<AppShell>` 内 / 旁挂 `<Toaster />`。
- 新增 `apps/admin/src/lib/toast-on-error.ts`
  - 订阅 apiFetch 的 error 回调，调用 `sonner` 的 `toast.error` 显示 `[code] message · logId=xxx`。

#### 暂不做

- admin 完整登录页 + AuthContext（本轮不在范围内）。`DevAutoAuthFilter` 改成按 property 门控后，本地开发可以直接无 token 走 dev-auto-auth，不阻塞开发。
- web 侧 error toast（web 已有 token 流程，403 不是当前问题）。

### 验证口径

动手修完后：

1. `curl -i http://localhost:8080/api/admin/studios` 应该返回：
   - `X-Log-Id: <8位>`
   - body 是 JSON，包含 `error.code` / `error.message` / `error.logId`（没登录时是 401/403）。
2. 开 `AEP_DEV_AUTH_ENABLED=true` 后，admin 页面刷新不再出 403。
3. 故意构造一次 500（比如访问不存在的 admin 资源），admin 右上应弹 toast，带 logId；后端日志该行前缀能看到同一个 logId。
