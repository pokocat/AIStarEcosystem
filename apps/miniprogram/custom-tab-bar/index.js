// 自定义 tabBar — 5 项，中央凸起为「工作台」
// 平台坑：每个 tab 页 onShow 必须主动 setData({selected})。详见 agent.md「自定义 tabBar」
Component({
  data: {
    selected: 0,
    // v0.5.3：消息 tab 红点 / 未读数（由 app-level 轮询通过 setData 推过来）
    unreadTotal: 0,
    list: [
      { path: "/pages/messages/index", text: "消息",   icon: "✉" },
      { path: "/pages/videos/index",   text: "视频",   icon: "▶" },
      { path: "/pages/workbench/index",text: "工作台", icon: "✦", center: true },
      { path: "/pages/market/index",   text: "市场",   icon: "★" },
      { path: "/pages/me/index",       text: "我的",   icon: "◉" }
    ]
  },
  lifetimes: {
    attached() {
      // 平台坑：custom-tab-bar 在 page 挂载之前就 attached；从 globalData 初始化一次未读
      try {
        const app = getApp();
        if (app && app.globalData && app.globalData.unread) {
          this.setData({ unreadTotal: Number(app.globalData.unread.total || 0) });
        }
      } catch (e) {}
    }
  },
  methods: {
    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      const index = e.currentTarget.dataset.index;
      // 平台坑：tabBar 互跳必须 switchTab，navigateTo 会静默失败。详见 agent.md「路由」
      wx.switchTab({ url: path });
      this.setData({ selected: index });
    }
  }
});
