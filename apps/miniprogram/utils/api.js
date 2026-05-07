// utils/api.js — 后端通信层。形状对齐 apps/web/src/api/_client.ts。
// 单环境开关：app.globalData.useMock。所有 URL 必须能在 specs/openapi.yaml 中找到。

const mocks = require("./mocks.js");

function getApp_() {
  // 平台坑：测试/单元里 getApp 不可用，做兜底。详见 agent.md「API 不一致」
  try { return getApp(); } catch (e) { return { globalData: { useMock: true, apiBaseUrl: "", auth: {} } }; }
}

function mockDelay(data, ms) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms == null ? 240 : ms));
}

/** 解开 ApiResponse / PageEnvelope 信封 */
function unwrap(resp) {
  if (resp && resp.success === true && "data" in resp) return resp.data;
  if (resp && resp.pagination && Array.isArray(resp.data)) return resp.data;
  return resp;
}

function apiFetch(path, options) {
  const app = getApp_();
  const baseUrl = app.globalData.apiBaseUrl;
  const token = (app.globalData.auth && app.globalData.auth.token) || "";
  const opts = options || {};
  const header = Object.assign(
    { "Content-Type": "application/json" },
    token ? { Authorization: "Bearer " + token } : {},
    opts.header || {}
  );
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl + path,
      method: opts.method || "GET",
      data: opts.data,
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(unwrap(res.data));
        } else {
          reject(new Error("HTTP " + res.statusCode));
        }
      },
      fail(err) { reject(err); }
    });
  });
}

// ── Auth ────────────────────────────────────────────────────────────────────
const AuthApi = {
  /** POST /auth/activate */
  activate(payload) {
    const app = getApp_();
    if (app.globalData.useMock) {
      return mockDelay({
        token: "mock-token-" + Date.now(),
        activationCode: payload.activationCode,
        phone: payload.phone,
        user: { id: "u-mock", role: "MERCHANT" }
      });
    }
    return apiFetch("/auth/activate", { method: "POST", data: payload });
  }
};

// ── Celebrity Zone ──────────────────────────────────────────────────────────
const CelebrityApi = {
  /** GET /celebrity/overview */
  overview() {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.ZONE_OVERVIEW);
    return apiFetch("/celebrity/overview");
  },
  /** GET /celebrity/stars */
  listStars(filter) {
    const app = getApp_();
    if (app.globalData.useMock) {
      let stars = [...mocks.MARKET_STARS];
      if (filter && filter.category && filter.category !== "全部") {
        stars = stars.filter((s) => s.category === filter.category || (s.subCategories || []).includes(filter.category));
      }
      return mockDelay(stars);
    }
    const qs = filter ? "?category=" + encodeURIComponent(filter.category || "") : "";
    return apiFetch("/celebrity/stars" + qs);
  },
  /** GET /celebrity/stars/{id} */
  getStar(id) {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.STAR_DETAIL_MAP[id] || mocks.STAR_DETAIL_MAP["star-li"]);
    return apiFetch("/celebrity/stars/" + id);
  },
  /** GET /celebrity/stars?owner=me — 仅当前账号已授权/审核中的明星 */
  listMyStars() {
    const app = getApp_();
    if (app.globalData.useMock) {
      // 客户端按 auth.status 过滤即可（authorized + pending）
      const list = mocks.MARKET_STARS.filter((s) => s.auth && (s.auth.status === "authorized" || s.auth.status === "pending"));
      return mockDelay(list);
    }
    return apiFetch("/celebrity/stars?owner=me");
  },
  /** GET /celebrity/templates */
  listTemplates() {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.TEMPLATE_STYLES);
    return apiFetch("/celebrity/templates");
  },
  /** GET /celebrity/engine-pricing */
  listEngines() {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.ENGINES);
    return apiFetch("/celebrity/engine-pricing");
  },
  /** POST /celebrity/generate — 启动生成异步任务 */
  generate(req) {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay({ jobId: "job-" + Date.now(), projectId: "proj-mock" });
    return apiFetch("/celebrity/generate", { method: "POST", data: req });
  },
  /** GET /celebrity/projects/{id} — 查询生成进度（前端轮询） */
  getProject(id) {
    const app = getApp_();
    if (app.globalData.useMock) {
      // 为了 demo，返回一个进度变化值（按 onLoad 计时模拟）
      const progress = Math.min(100, Math.floor((Date.now() / 1000) % 100));
      return mockDelay({ id, progress, currentStep: 1, etaSec: 108 });
    }
    return apiFetch("/celebrity/projects/" + id);
  },
  /** GET /celebrity/videos */
  listVideos(filter) {
    const app = getApp_();
    if (app.globalData.useMock) {
      let list = [...mocks.VIDEO_ASSETS];
      if (filter && filter.state && filter.state !== "all") list = list.filter((v) => v.state === filter.state);
      return mockDelay({ items: list, generating: mocks.VIDEO_GENERATING, wallet: mocks.WALLET });
    }
    const qs = filter && filter.state ? "?state=" + filter.state : "";
    return apiFetch("/celebrity/videos" + qs);
  },
  /** GET /celebrity/videos/{id} 或 /celebrity/projects/{projectId}/videos */
  getVideo(id) {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.VIDEO_DETAIL);
    return apiFetch("/celebrity/videos/" + id);
  },
  /** POST /celebrity/projects/{projectId}/distribute */
  distribute(projectId, channels) {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay({ ok: true, channels });
    return apiFetch("/celebrity/projects/" + projectId + "/distribute", { method: "POST", data: { channels } });
  }
};

// ── Notifications ───────────────────────────────────────────────────────────
const NotificationsApi = {
  list() {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay({ todos: mocks.TODOS, messages: mocks.BOT_MESSAGES });
    return apiFetch("/notifications");
  },
  /** GET /notifications/conversations/{botId} — 单个 Bot 的多消息会话 */
  getConversation(botId) {
    const app = getApp_();
    if (app.globalData.useMock) {
      const c = mocks.CONVERSATIONS[botId] || mocks.CONVERSATIONS.pian;
      return mockDelay(c);
    }
    return apiFetch("/notifications/conversations/" + encodeURIComponent(botId));
  }
};

// ── Wallet ──────────────────────────────────────────────────────────────────
const WalletApi = {
  /** GET /me/wallet — 余额走 ledger 累计；本地仅展示，不直接 update */
  get() {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.WALLET);
    return apiFetch("/me/wallet");
  },
  /** GET /me/wallet/credits — 积分点数（license + recharge + gift） */
  getCredits() {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.WALLET_CREDITS);
    return apiFetch("/me/wallet/credits");
  },
  /** GET /finance/recharge-packages 或 /me/wallet/packages */
  listPackages() {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.WALLET_PACKAGES);
    return apiFetch("/me/wallet/packages");
  },
  /** POST /me/wallet/recharge — mock 直接成功；真实环境需走支付回调 */
  recharge(packageId) {
    const app = getApp_();
    if (app.globalData.useMock) {
      const pkg = mocks.WALLET_PACKAGES.find((p) => p.id === packageId);
      if (!pkg) return Promise.reject(new Error("套餐不存在"));
      // 模拟落账：充值进 recharge bucket（不修改原 mock 对象，避免污染单测）
      const c = mocks.WALLET_CREDITS;
      const bonus = pkg.bonus ? parseInt((pkg.bonus.match(/\d+/) || [0])[0], 10) : 0;
      c.recharge += pkg.credits;
      c.gift += bonus;
      c.total = c.license + c.recharge + c.gift;
      return mockDelay({ ok: true, package: pkg, credits: c });
    }
    return apiFetch("/me/wallet/recharge", { method: "POST", data: { packageId } });
  }
};

// ── Dashboard ───────────────────────────────────────────────────────────────
const DashboardApi = {
  get(range) {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.DASHBOARD);
    return apiFetch("/celebrity/overview?range=" + (range || "7d"));
  }
};

module.exports = {
  apiFetch,
  AuthApi,
  CelebrityApi,
  NotificationsApi,
  WalletApi,
  DashboardApi
};
