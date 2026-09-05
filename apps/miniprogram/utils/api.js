// utils/api.js — 后端通信层。形状对齐 apps/web/src/api/_client.ts。
// 单环境开关：app.globalData.useMock。所有 URL 必须能在 specs/openapi.yaml 中找到。

const mocks = require("./mocks.js");
const config = require("../config.js");
const Auth = require("./auth.js");

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

function rawRequest(path, options, token) {
  const app = getApp_();
  const baseUrl = app.globalData.apiBaseUrl;
  const opts = options || {};
  const header = Object.assign(
    {
      "Content-Type": "application/json",
      // X-App-Code：
      //   id 模式 —— server 的开通闸按它判定「本次请求属于哪个产品」（celebrity）。
      //   legacy 模式 —— 沿用历史审计来源短码 celebrity-mp（区分「明星带货·小程序」入口）。
      "X-App-Code": config.isIdMode() ? config.appCode : config.legacyAppCode
    },
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
          const body = res.data || {};
          const err = body.error || {};
          const e = new Error(err.message || body.message || ("HTTP " + res.statusCode));
          e.status = res.statusCode;
          e.code = err.code || "HTTP_ERROR";
          e.details = err.details || null;
          reject(e);
        }
      },
      fail(err) { reject(err); }
    });
  });
}

/** 403 PRODUCT_NOT_ENROLLED —— 账号还没开通带货，导去开通页 */
function isNotEnrolled(e) {
  return e && e.status === 403 && e.code === "PRODUCT_NOT_ENROLLED";
}

const NO_REDIRECT_ROUTES = ["pages/enroll/index", "pages/launch/index", "pages/login/index"];

function currentRoute() {
  try {
    const pages = getCurrentPages();
    const top = pages[pages.length - 1];
    return (top && top.route) || "";
  } catch (e) {
    return "";
  }
}

function gotoEnroll() {
  const route = currentRoute();
  if (NO_REDIRECT_ROUTES.indexOf(route) >= 0) return;
  wx.navigateTo({ url: "/pages/enroll/index", fail() { wx.reLaunch({ url: "/pages/enroll/index" }); } });
}

function gotoLogin() {
  const target = config.isIdMode() ? "/pages/launch/index" : "/pages/login/index";
  const route = currentRoute();
  if (NO_REDIRECT_ROUTES.indexOf(route) >= 0) return;
  wx.reLaunch({ url: target });
}

/**
 * 业务后端请求。
 * legacy 模式：沿用 globalData.auth.token。
 * id 模式：带账号中心 access token；401 → 刷新一次 → 还不行就静默重新 wx.login → 再不行回登录页。
 */
function apiFetch(path, options) {
  if (!config.isIdMode()) {
    const app = getApp_();
    const token = (app.globalData.auth && app.globalData.auth.token) || "";
    return rawRequest(path, options, token);
  }

  return Auth.ensureLoggedIn()
    .then((tokens) => rawRequest(path, options, tokens.accessToken))
    .catch((e) => {
      if (isNotEnrolled(e)) { gotoEnroll(); throw e; }
      if (e.status !== 401) throw e;
      // 401 → 刷新一次；刷新失败（令牌被撤销 / 账号已合并）→ 静默重新登录
      return Auth.refresh()
        .catch(() => Auth.loginWithWechat())
        .then(
          (next) => rawRequest(path, options, next.accessToken).catch((e2) => {
            if (isNotEnrolled(e2)) gotoEnroll();
            else if (e2.status === 401) gotoLogin();
            throw e2;
          }),
          () => { gotoLogin(); throw e; }
        );
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
  },
  /** POST /auth/sms/request-code */
  smsRequestCode(phone, purpose = "login") {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay({
      sent: true,
      accepted: true,
      provider: "mock",
      purpose,
      providerCode: "MOCK_OK",
      providerMessage: "Mock SMS accepted",
      deliveryStatus: "NOT_APPLICABLE"
    });
    return apiFetch("/auth/sms/request-code", { method: "POST", data: { phone, purpose } });
  },
  /** POST /auth/sms/register */
  smsRegister(payload) {
    const app = getApp_();
    if (app.globalData.useMock) {
      const phone = payload.phone || "";
      return mockDelay({
        token: "mock-token-" + Date.now(),
        user: { id: "u-mock", role: "STUDIO", phone, phoneVerified: true },
        studio: { id: "s-mock", name: payload.studioName || "AI 明星带货工作室" },
        tenantId: "t-mock"
      });
    }
    return apiFetch("/auth/sms/register", { method: "POST", data: payload });
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
  /** GET /celebrity/projects/{id} — 查询项目详情 */
  getProject(id) {
    const app = getApp_();
    if (app.globalData.useMock) {
      const progress = Math.min(100, Math.floor((Date.now() / 1000) % 100));
      return mockDelay({ id, progress, currentStep: 1, etaSec: 108 });
    }
    return apiFetch("/celebrity/projects/" + id);
  },
  /** v0.5.1：GET /celebrity/jobs/{jobId} — 异步生成任务进度（替代客户端 setInterval） */
  getJobProgress(jobId) {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.buildJobProgress(jobId));
    return apiFetch("/celebrity/jobs/" + encodeURIComponent(jobId || ""));
  },
  /** v0.5.1：GET /celebrity/dictionaries — UI 字典 */
  getDictionaries() {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.CELEBRITY_DICTIONARIES);
    return apiFetch("/celebrity/dictionaries");
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
  /**
   * v0.5.1：消息首页聚合 = 待办中心 + Bot 同事会话预览（含红点 dot）。
   * 走 GET /me/messages-overview。
   */
  messagesOverview() {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay(mocks.MESSAGES_OVERVIEW);
    return apiFetch("/me/messages-overview");
  },
  /** GET /notifications/conversations/{botId} — 单个 Bot 的多消息会话 */
  getConversation(botId) {
    const app = getApp_();
    if (app.globalData.useMock) {
      const c = mocks.CONVERSATIONS[botId] || mocks.CONVERSATIONS.pian;
      return mockDelay(c);
    }
    return apiFetch("/notifications/conversations/" + encodeURIComponent(botId));
  },
  /** v0.5.1：POST /notifications/conversations/{botId}/read-all — 清掉首页红点 */
  markBotRead(botId) {
    const app = getApp_();
    if (app.globalData.useMock) {
      // mock 模式：把对应 bot 的 dot 置 0（影响下一次 messagesOverview）
      const conv = mocks.MESSAGES_OVERVIEW.conversations.find((c) => c.botId === botId);
      if (conv) { conv.dot = 0; conv.accent = false; }
      return mockDelay({ updated: 1, botId });
    }
    return apiFetch("/notifications/conversations/" + encodeURIComponent(botId) + "/read-all", { method: "POST" });
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
  /**
   * POST /me/wallet/recharge — 充值下单（v0.56：不再直接入账）。
   * 返回 RechargeOrder（status=pending）。平台运营线下收款后核准方到账，付款前不发积分。
   * mock：返回一张待确认账单，不改钱包余额。
   */
  recharge(packageId, note) {
    const app = getApp_();
    if (app.globalData.useMock) {
      const pkg = mocks.WALLET_PACKAGES.find((p) => p.id === packageId);
      if (!pkg) return Promise.reject(new Error("套餐不存在"));
      const c = mocks.WALLET_CREDITS || {};
      const now = new Date().toISOString();
      return mockDelay({
        id: "ro-" + Date.now(),
        userId: c.userId,
        packageId: pkg.id,
        packageTag: pkg.tag,
        credits: pkg.credits,
        bonusCredits: Number(pkg.bonusCredits || 0),
        priceCents: pkg.priceCents,
        status: "pending",
        userNote: note,
        createdAt: now,
        updatedAt: now
      });
    }
    return apiFetch("/me/wallet/recharge", { method: "POST", data: { packageId, note } });
  },

  /** GET /me/wallet/recharge/orders — 我的充值订单（v0.56）。 */
  listRechargeOrders() {
    const app = getApp_();
    if (app.globalData.useMock) return mockDelay([]);
    return apiFetch("/me/wallet/recharge/orders");
  }
};

// ── 账号档案 / 开通（统一账号中心 · docs/unified-identity-plan.md §12.2）─────
const MeApi = {
  /** GET /me — 当前账号档案；id 模式下额外带 identityUid + enrollments[] */
  get() {
    const app = getApp_();
    if (app.globalData.useMock) {
      return mockDelay({
        id: "u-mock",
        username: "mock-user",
        displayName: "Boss · 带货方",
        phone: "138****8888",
        identityUid: "uid-mock",
        platforms: ["celebrity"],
        enrollments: [{ product: "celebrity", status: "active", source: "license" }]
      });
    }
    return apiFetch("/me");
  }
};

const EnrollmentApi = {
  /**
   * POST /me/enrollments/{product}/activate — 用激活码开通本产品。
   * 成功后 /me 的 enrollments 里会出现一条 status=active。
   */
  activate(product, licenseKey) {
    const app = getApp_();
    if (app.globalData.useMock) {
      return mockDelay({ product: product, status: "active", source: "license", activatedAt: new Date().toISOString() });
    }
    return apiFetch("/me/enrollments/" + encodeURIComponent(product) + "/activate", {
      method: "POST",
      data: { licenseKey }
    });
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
  MeApi,
  EnrollmentApi,
  DashboardApi
};
