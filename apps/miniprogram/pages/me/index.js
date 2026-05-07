const app = getApp();

Page({
  data: {
    auth: { token: "", activationCode: "", phone: "" },
    tokenMasked: ""
  },

  onShow() {
    if (this.getTabBar) {
      const t = this.getTabBar();
      if (t) t.setData({ selected: 4 });
    }
    const auth = app.globalData.auth || {};
    this.setData({
      auth,
      tokenMasked: auth.token ? auth.token.slice(0, 12) + "…" : "—"
    });
  },

  logout() {
    wx.showModal({
      title: "确认退出？",
      success: (res) => {
        if (res.confirm) {
          app.clearAuth();
          wx.reLaunch({ url: "/pages/login/index" });
        }
      }
    });
  }
});
