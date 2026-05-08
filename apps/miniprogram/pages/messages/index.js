const { NotificationsApi } = require("../../utils/api.js");
const app = getApp();

let activePollTimer = null;

Page({
  data: {
    todos: [],
    todoTotal: 0,
    messages: []
  },

  onLoad() { this.fetch(); },

  onShow() {
    // 平台坑：自定义 tabBar 选中态需在 onShow 主动 setData。详见 agent.md「自定义 tabBar」
    if (this.getTabBar) {
      const t = this.getTabBar();
      if (t) t.setData({ selected: 0 });
    }
    // v0.5.3：先拿一次 globalData 的最新快照（app 后台轮询填的），UI 立即可见
    if (app.globalData && app.globalData.unread && Array.isArray(app.globalData.unread.conversations) && app.globalData.unread.conversations.length > 0) {
      this.applyOverview(app.globalData.unread);
    }
    // 然后立刻拉一次最新数据（chat 返回时这一拉能立刻把 dot 清掉）
    this.fetch();
    // 订阅 app 后台轮询：有新数据 push 时 page 自动 re-render
    this._unsubscribe = app.subscribeUnread((unread) => this.applyOverview(unread));
    // 页内活跃时 5s 高频轮询（用户停在消息页时实时感更强）
    if (!activePollTimer) activePollTimer = setInterval(() => app.pollUnread(), 5 * 1000);
  },

  onHide() {
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
    if (activePollTimer) { clearInterval(activePollTimer); activePollTimer = null; }
  },

  onUnload() {
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
    if (activePollTimer) { clearInterval(activePollTimer); activePollTimer = null; }
  },

  /** 把 app.globalData.unread 渲染到 page 数据上（与 fetch 输出 shape 一致）。 */
  applyOverview(unread) {
    if (!unread) return;
    const todos = unread.todos || [];
    const total = todos.reduce((s, t) => s + (Number(t.count) || 0), 0);
    this.setData({
      todos,
      messages: unread.conversations || [],
      todoTotal: total
    });
  },

  async fetch() {
    // v0.5.1：从 GET /me/messages-overview 取聚合数据（todos + conversations 含 dot 未读）
    try {
      const r = await NotificationsApi.messagesOverview();
      const total = (r.todos || []).reduce((s, t) => s + (Number(t.count) || 0), 0);
      this.setData({
        todos: r.todos || [],
        messages: r.conversations || [],
        todoTotal: total
      });
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  openChat(e) {
    const botId = e.currentTarget.dataset.bot;
    if (!botId) return;
    wx.navigateTo({ url: "/pages/chat/index?botId=" + botId });
  },

  goRoute(e) {
    const route = e.currentTarget.dataset.route;
    if (!route) return;
    const isTab = ["/pages/messages/index", "/pages/videos/index", "/pages/workbench/index", "/pages/market/index", "/pages/me/index"].some((p) => route.indexOf(p) === 0);
    if (isTab) wx.switchTab({ url: route });
    else wx.navigateTo({ url: route });
  },

  onSearch() {
    wx.showToast({ icon: "none", title: "搜索功能开发中" });
  },

  onFabTap() {
    wx.navigateTo({ url: "/pages/chat/index?botId=pian" });
  }
});
