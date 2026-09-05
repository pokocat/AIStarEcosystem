const { WalletApi } = require("../../utils/api.js");
const Phone = require("../../utils/phone.js");
const config = require("../../config.js");
const app = getApp();

Page({
  data: {
    auth: { token: "", activationCode: "", phone: "—" },
    credits: { totalBalance: 0, licenseBalance: 0, rechargeBalance: 0, giftBalance: 0, pendingBalance: 0 },
    // v0.149：id 模式下手机号是账号中心的 claim，未绑定时给一个显式入口
    idMode: config.isIdMode(),
    phoneVerified: true
  },

  onShow() {
    if (this.getTabBar) {
      const t = this.getTabBar();
      if (t) t.setData({ selected: 4 });
    }
    this.syncAccount();
    this.fetchCredits();
  },

  /** 手机号真值：id 模式取账号中心令牌里的 claim / /me，legacy 取本地登录态 */
  syncAccount() {
    const auth = app.globalData.auth || {};
    if (!config.isIdMode()) {
      this.setData({ auth: { ...auth, phone: auth.phone || "—" }, phoneVerified: true });
      return;
    }
    const me = app.globalData.me || {};
    const verified = Phone.isVerified();
    this.setData({
      auth: { ...auth, phone: me.phone || (verified ? "已绑定" : "未绑定") },
      phoneVerified: verified
    });
  },

  /** 「绑定手机号」入口（也是其它页面兜底引导过来的落点） */
  async bindPhone() {
    const ok = await Phone.ensurePhoneVerified(this, {
      reason: "绑定手机号后，换设备也能找回账号，充值与开票也需要它。"
    });
    if (ok) {
      try { await app.refreshMe(); } catch (e) {}
      this.syncAccount();
      this.fetchCredits();
    }
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
      content: config.isIdMode() ? "退出后需要重新用微信授权进入。" : "",
      success: (res) => {
        if (res.confirm) {
          app.signOut();
          wx.reLaunch({ url: config.isIdMode() ? "/pages/launch/index" : "/pages/login/index" });
        }
      }
    });
  }
});
