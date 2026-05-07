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
    pendingGeneration: null
  },

  onLaunch() {
    try {
      const cached = wx.getStorageSync("auth");
      if (cached && cached.token) {
        this.globalData.auth = cached;
      }
    } catch (e) {}
  },

  setAuth(auth) {
    this.globalData.auth = auth;
    try { wx.setStorageSync("auth", auth); } catch (e) {}
  },

  clearAuth() {
    this.globalData.auth = { token: "", activationCode: "", phone: "" };
    try { wx.removeStorageSync("auth"); } catch (e) {}
  }
});
