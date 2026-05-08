// AI 明星带货 · 小程序入口
// 复用 apps/server 后端（默认 http://localhost:8080/api，正式环境替换 baseUrl）
// 运营审核能力在 apps/admin（小程序内不暴露 admin 入口）。

App({
  globalData: {
    // 是否走 mock 数据：开发态可置 true，避免依赖 server。生产置 false。
    useMock: true,
    // 后端 base url；线上替换为 https://your-domain/api
    apiBaseUrl: "https://api.aistareco.local/api",
    // 当前登录态（激活码 + token）
    auth: {
      token: "",
      activationCode: "",
      phone: ""
    },
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
      if (cached && cached.token) {
        this.globalData.auth = cached;
      }
    } catch (e) {}
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

  // ── 未读轮询 ─────────────────────────────────────────────────────────

  /**
   * 立即拉一次 + 每 30s 拉一次（前台时）。
   * 平台坑：必须在 onHide 清 interval，否则被动后台 setData 会报警。详见 agent.md「网络」
   */
  startUnreadPolling() {
    if (this._pollTimer) return; // 幂等
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
