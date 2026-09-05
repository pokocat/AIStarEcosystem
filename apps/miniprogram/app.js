// AI 明星带货 · 小程序入口
// 复用 apps/server 后端（默认 http://localhost:8080/api，正式环境替换 baseUrl）
// 运营审核能力在 apps/admin（小程序内不暴露 admin 入口）。
//
// v0.34+ 多环境配置：从 config/env.js 读 useMock / apiBaseUrl；不存在则用内置 fallback。
// 模板见 config/env.example.js；env.js 已在 .gitignore，请按环境填写。

// v0.149：配置读取统一收敛到 config.js（含统一账号中心 authMode / idBaseUrl）。
// fallback 保留 v0.33 之前的 dev-friendly 默认（useMock=true）：
//   - 本地开发者首次 clone 没建 env.js 时，仍能用 mock 数据无网络启动
//   - 生产上线前必须 cp config/env.example.js config/env.js 并改 useMock=false + 真实 apiBaseUrl
const config = require("./config.js");
const Auth = require("./utils/auth.js");

App({
  globalData: {
    // 由 config/env.js 注入，避免硬编 + 方便多环境切换
    useMock: config.useMock,
    apiBaseUrl: config.apiBaseUrl,
    // 登录模式：id = 统一账号中心（微信静默登录）；legacy = 手机号 + 短信 + 激活码
    authMode: config.authMode,
    // 当前登录态（激活码 + token）—— legacy 模式使用
    auth: {
      token: "",
      activationCode: "",
      phone: ""
    },
    // id 模式登录态（真值在 storage 的 "auth.id"，这里只是给页面读的快照）
    idAuth: null,
    idClaims: null,
    // /api/me 快照（含 identityUid + enrollments[]）
    me: null,
    // id 模式：首屏登录 + 开通判定完成之前不启动轮询，避免打出必然 403 的请求
    bootstrapped: false,
    // 当前选择的明星（在 market → detail → generator 之间共享）
    selectedStarId: "",
    // 生成任务上下文（generator → generating → videos）
    pendingGeneration: null,
    // v0.5.3：未读聚合（由 app-level 轮询填充；tabBar / messages 页订阅）
    unread: {
      total: 0,        // 所有 Bot 未读求和
      byBot: {},       // botId → dot
      todos: [],       // 上次拉到的待办（已带 count）
      conversations: [] // 上次拉到的会话预览（已带 dot 与 preview）
    }
  },

  // 平台坑：`require` 在 App 顶层 import 会触发 mocks 模块循环依赖（`api` → `app` → `api`），
  // 所以延迟到第一次轮询时再取。详见 agent.md「分包 / 异步加载」
  _pollTimer: null,
  _unreadSubs: [],
  // v0.5.3：前台 15s 兜底轮询；用户停在消息页 / chat 页有更紧的 5s 子轮询；
  // 业务关键节点（生成提交 / 充值成功）调 triggerUnreadRefresh() 立即拉。
  // 真实 WebSocket / wx.subscribeMessage 留 v0.6+。
  _POLL_INTERVAL_MS: 15 * 1000,

  onLaunch() {
    try {
      const cached = wx.getStorageSync("auth");
      // 平台坑：某些 iOS 版本没值时返回空字符串，判空必须先判对象。详见 agent.md「存储」
      if (cached && cached.token) {
        this.globalData.auth = cached;
      }
    } catch (e) {}
    if (config.hasConfigError()) {
      // 启动页会渲染错误屏并停在那里；这里不做任何登录相关的准备工作
      console.error("[config]", config.configError);
    } else if (config.isIdMode()) {
      // 把 storage 里的令牌快照同步进 globalData（页面可直接读 idClaims）
      const tokens = Auth.peek();
      if (tokens) {
        this.globalData.idAuth = tokens;
        this.globalData.idClaims = Auth.getClaims();
      }
      // 轮询等首屏 bootstrap 完成后再开，见 startUnreadPolling
    }
    this.startUnreadPolling();
  },

  /** 平台坑：onShow 多次触发；startUnreadPolling 自身做幂等。详见 agent.md「生命周期」 */
  onShow() {
    this.startUnreadPolling();
  },

  onHide() {
    this.stopUnreadPolling();
  },

  setAuth(auth) {
    this.globalData.auth = auth;
    try { wx.setStorageSync("auth", auth); } catch (e) {}
  },

  clearAuth() {
    this.globalData.auth = { token: "", activationCode: "", phone: "" };
    try { wx.removeStorageSync("auth"); } catch (e) {}
  },

  // ── 统一账号中心（id 模式）────────────────────────────────────────────────
  // 契约真源：docs/unified-identity-plan.md §6 / §12.6

  /** 静默登录（幂等；已有可用令牌直接返回） */
  ensureIdLogin() {
    // fail closed：配置错误时绝不尝试登录（idBaseUrl 是空串，请求会打到一个荒唐的地址）。
    // 正常路径下启动页已经停在错误屏，这里只是兜住漏网的调用方。
    if (config.hasConfigError()) {
      const e = new Error(config.configError);
      e.code = "CONFIG_ERROR";
      return Promise.reject(e);
    }
    if (!config.isIdMode()) return Promise.resolve(null);
    // mock 模式不打真实账号中心（本地开发者可能压根没跑账号中心服务，它在独立仓库 pokocat/aibuzz-id）
    if (this.globalData.useMock) return Promise.resolve(null);
    return Auth.ensureLoggedIn().then((tokens) => {
      this.globalData.idAuth = tokens;
      this.globalData.idClaims = Auth.getClaims();
      return tokens;
    });
  },

  /** 拉一次 /api/me，缓存到 globalData（含 enrollments） */
  refreshMe() {
    const { MeApi } = require("./utils/api.js");
    return MeApi.get().then((me) => {
      this.globalData.me = me || null;
      if (config.isIdMode()) this.globalData.idClaims = Auth.getClaims();
      return me;
    });
  },

  /** 本产品（celebrity）是否已开通；enrollments 缺失时回落 platforms，兼容尚未升级的后端 */
  isEnrolled() {
    const me = this.globalData.me;
    if (!me) return false;
    const list = me.enrollments;
    // 只要后端给了 enrollments 数组，它就是唯一真值 —— **空数组也是**（Codex 三轮 P2-3）。
    // 原来写的是 `length > 0` 才认，于是「一个产品都没开通」的新账号会掉进下面的
    // platforms 兼容分支，被老语义（platforms 为空 = 全集）判成已开通，直接跳过开通页。
    // platforms 只服务「后端还没升级、压根没有 enrollments 字段」这一种情况。
    if (Array.isArray(list)) {
      return list.some((e) => e && e.product === config.product && String(e.status || "").toLowerCase() === "active");
    }
    const platforms = me.platforms;
    if (Array.isArray(platforms) && platforms.length > 0) return platforms.indexOf(config.product) >= 0;
    // 老后端：platforms 为空历史语义 = 全集
    return Array.isArray(platforms);
  },

  /** 登录 + /me 就绪之后的落地路由：未开通去开通页，已开通进工作区 */
  routeAfterLogin() {
    this.globalData.bootstrapped = true;
    if (config.isIdMode() && !this.isEnrolled()) {
      wx.reLaunch({ url: "/pages/enroll/index" });
      return;
    }
    this.startUnreadPolling();
    wx.switchTab({ url: "/pages/messages/index" });
  },

  /** 退出登录（两种模式都清干净） */
  signOut() {
    this.stopUnreadPolling();
    this.clearAuth();
    Auth.logout();
    this.globalData.idAuth = null;
    this.globalData.idClaims = null;
    this.globalData.me = null;
    this.globalData.bootstrapped = false;
  },

  // ── 未读轮询 ─────────────────────────────────────────────────────────

  /**
   * 立即拉一次 + 每 30s 拉一次（前台时）。
   * 平台坑：必须在 onHide 清 interval，否则被动后台 setData 会报警。详见 agent.md「网络」
   */
  startUnreadPolling() {
    if (this._pollTimer) return; // 幂等
    // 配置错误（声明 id 模式却没给账号中心地址）：整个应用停在启动页的错误屏上，别再打请求
    if (config.hasConfigError()) return;
    // id 模式：首屏还没跑完登录 / 开通判定时不要轮询 —— 未开通账号会打出一串必然 403 的请求
    if (config.isIdMode() && !this.globalData.bootstrapped) return;
    this.pollUnread(); // 立即一次
    this._pollTimer = setInterval(() => this.pollUnread(), this._POLL_INTERVAL_MS);
  },

  stopUnreadPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  async pollUnread() {
    try {
      const { NotificationsApi } = require("./utils/api.js");
      const r = await NotificationsApi.messagesOverview();
      const byBot = {};
      let total = 0;
      (r.conversations || []).forEach((c) => {
        const dot = Number(c.dot || 0);
        byBot[c.botId] = dot;
        total += dot;
      });
      this.globalData.unread = {
        total,
        byBot,
        todos: r.todos || [],
        conversations: r.conversations || []
      };
      this._notifyUnreadSubs();
      this._propagateTabBar(total);
    } catch (e) { /* 静默：网络抖动不打扰用户 */ }
  },

  /**
   * 订阅 unread 变化（messages 页用；返回 unsubscribe 函数）。
   * 注意：subscriber 函数被持久持有，pages 在 onUnload 必须调 unsubscribe，否则内存泄漏。
   */
  subscribeUnread(cb) {
    if (typeof cb !== "function") return () => {};
    this._unreadSubs.push(cb);
    // 立即推送一次当前快照
    try { cb(this.globalData.unread); } catch (e) {}
    return () => {
      this._unreadSubs = this._unreadSubs.filter((x) => x !== cb);
    };
  },

  _notifyUnreadSubs() {
    this._unreadSubs.forEach((cb) => {
      try { cb(this.globalData.unread); } catch (e) {}
    });
  },

  /** 把未读总数推到所有 page 的自定义 tabBar（消息 tab 显示红点 / 数字）。 */
  _propagateTabBar(total) {
    try {
      const pages = getCurrentPages();
      pages.forEach((p) => {
        if (typeof p.getTabBar === "function") {
          const t = p.getTabBar();
          if (t) t.setData({ unreadTotal: total });
        }
      });
    } catch (e) {}
  },

  /**
   * v0.5.3：业务关键节点立即触发一次未读拉取（"准实时"提示）。
   * 调用点：
   *   - generator.startGenerate 提交成功之后
   *   - recharge.submit 充值落账之后
   *   - 视频发布 / 重新生成确认后
   * 用法：getApp().triggerUnreadRefresh()
   */
  triggerUnreadRefresh() {
    return this.pollUnread();
  }

  // ── 何时升级到 WebSocket / wx.subscribeMessage（v0.6+）────────────────
  //
  // 当前 15s 后台轮询 + 5s 页内活跃轮询 + 业务关键点立即触发，已经足以覆盖
  // "用户在线时近实时同步"。如果未来需要：
  //
  // (A) 用户离线（小程序未打开）也能收到提醒：
  //     接入 wx.subscribeMessage 模板消息（用户授权一次后服务端可推一次）
  //
  // (B) 真双向实时（< 1s 延迟、bidi）：
  //     接入 wx.connectSocket（WebSocket）；server 起 /ws，按 userId hold session 表
  //     业务事件触发 → server 主动 emit；miniprogram 在 onMessage 时合并到
  //     globalData.unread 并 _notifyUnreadSubs / _propagateTabBar
  //     onClose / onError 时回退到 polling（互为兜底）
  //     心跳：30s ping，60s 没回 pong 视为断开
  //
  // (C) Server-Sent Events (SSE)：微信小程序原生不支持 EventSource，跳过。
});
