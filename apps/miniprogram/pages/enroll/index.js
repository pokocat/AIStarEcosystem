// pages/enroll/index.js — 开通 AI 明星带货。
//
// 统一账号中心接入后，「登录」和「开通」被拆成两件事：
//   登录 = 微信静默授权（账号中心发令牌，全生态通认）
//   开通 = 用激活码把「AI 明星带货」这个产品的权益挂到账号上（真值在产品后端）
//
// 契约真源：docs/unified-identity-plan.md §12.2（enrollment）/ §12.6（小程序）。

const { EnrollmentApi } = require("../../utils/api.js");
const { formatActivationCode } = require("../../utils/format.js");
const Phone = require("../../utils/phone.js");
const config = require("../../config.js");

const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    code: "",
    canSubmit: false,
    submitting: false,
    error: "",
    // 从哪儿被拦过来的（成功后原路返回）
    fromRedirect: false
  },

  onLoad(options) {
    try {
      const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
    } catch (e) {}
    // 平台坑：options 在某些基础库会缺字段，加兜底。详见 agent.md「生命周期」
    const pages = getCurrentPages();
    this.setData({ fromRedirect: pages.length > 1 });
  },

  onCodeInput(e) {
    const code = formatActivationCode(e.detail.value);
    this.setData({ code, error: "" }, () => {
      this.setData({ canSubmit: /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(this.data.code) });
    });
  },

  async submit() {
    if (!this.data.canSubmit || this.data.submitting) return;

    // §5 / §12.6：开通是有副作用的动作，先确保手机号已验证
    const ok = await Phone.ensurePhoneVerified(this, {
      reason: "开通带货服务前需要先绑定手机号，方便后续找回账号与开具凭证。"
    });
    if (!ok) return;

    this.setData({ submitting: true, error: "" });
    wx.showLoading({ title: "开通中…", mask: true });
    try {
      await EnrollmentApi.activate(config.product, this.data.code);
      await app.refreshMe();
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ icon: "success", title: "开通成功" });
      setTimeout(() => this.leave(), 600);
    } catch (e) {
      wx.hideLoading();
      this.setData({ submitting: false, error: this.explain(e) });
    }
  },

  /** 把后端错误码翻译成用户看得懂的话（不把内部码摆到界面上） */
  explain(e) {
    const code = (e && e.code) || "";
    if (code === "LICENSE_KEY_UNAVAILABLE") return "这个激活码无效或已被使用，请找销售经理确认";
    if (code === "NETWORK_ERROR") return "网络不给力，请稍后重试";
    return (e && e.message) || "开通失败，请稍后重试";
  },

  leave() {
    // 开通成功即进入工作区，未读轮询可以开了
    app.globalData.bootstrapped = true;
    app.startUnreadPolling();
    if (this.data.fromRedirect) {
      wx.navigateBack({ fail() { wx.switchTab({ url: "/pages/messages/index" }); } });
    } else {
      wx.switchTab({ url: "/pages/messages/index" });
    }
  },

  callSales() {
    wx.makePhoneCall({ phoneNumber: "13888881234", fail() {} });
  },

  onAgreement(e) {
    const k = e.currentTarget.dataset.k;
    wx.showToast({ icon: "none", title: (k === "user" ? "用户协议" : "隐私政策") + "（开发中）" });
  },

  logout() {
    wx.showModal({
      title: "退出登录？",
      content: "退出后需要重新用微信授权进入。",
      success: (res) => {
        if (res.confirm) {
          app.signOut();
          wx.reLaunch({ url: "/pages/launch/index" });
        }
      }
    });
  }
});
