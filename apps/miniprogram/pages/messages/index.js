const { NotificationsApi } = require("../../utils/api.js");

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
    // 从 chat 页返回时，刷新红点 / 时间
    this.fetch();
  },

  async fetch() {
    try {
      const r = await NotificationsApi.list();
      const total = (r.todos || []).reduce((s, t) => s + t.count, 0);
      this.setData({ todos: r.todos || [], messages: r.messages || [], todoTotal: total });
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
