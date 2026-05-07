const { WalletApi } = require("../../utils/api.js");
const app = getApp();

Page({
  data: {
    auth: { token: "", activationCode: "", phone: "—" },
    credits: { total: 0, license: 0, recharge: 0, gift: 0, pending: 0 }
  },

  onShow() {
    if (this.getTabBar) {
      const t = this.getTabBar();
      if (t) t.setData({ selected: 4 });
    }
    const auth = app.globalData.auth || {};
    this.setData({ auth: { ...auth, phone: auth.phone || "—" } });
    this.fetchCredits();
  },

  async fetchCredits() {
    try {
      const c = await WalletApi.getCredits();
      this.setData({ credits: c });
    } catch (e) { /* 静默 */ }
  },

  goRecharge() { wx.navigateTo({ url: "/pages/recharge/index" }); },

  onLedger() { wx.showToast({ icon: "none", title: "交易明细开发中" }); },

  onSettings() {
    wx.showActionSheet({
      itemList: ["账号设置", "通知偏好", "清理缓存"],
      success: () => wx.showToast({ icon: "none", title: "开发中" })
    });
  },

  onProfile() { wx.showToast({ icon: "none", title: "账号资料开发中" }); },

  onMyStars() { wx.switchTab({ url: "/pages/market/index" }); },
  onMyVideos() { wx.switchTab({ url: "/pages/videos/index" }); },

  onInvite() {
    wx.showActionSheet({
      itemList: ["分享给微信好友", "复制邀请链接", "查看邀请记录"],
      success: () => wx.showToast({ icon: "none", title: "邀请开发中" })
    });
  },

  onSales() {
    wx.makePhoneCall({ phoneNumber: "13888881234", fail() {} });
  },

  onFeedback() { wx.showToast({ icon: "none", title: "反馈通道开发中" }); },

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
