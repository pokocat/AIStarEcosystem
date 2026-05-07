// pages/login/index.js — 激活码登录
const { AuthApi } = require("../../utils/api.js");
const { formatActivationCode } = require("../../utils/format.js");

const app = getApp();
let smsTimer = null;

Page({
  data: {
    statusBarHeight: 44,
    form: { code: "", phone: "", sms: "" },
    cooldown: 0,
    agreed: true,
    canSubmit: false
  },

  onLoad() {
    // 平台坑：getSystemInfoSync 在 iOS 14 偶尔返回 statusBarHeight=0；做兜底。详见 agent.md「API 不一致」
    try {
      const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
    } catch (e) {}
  },

  onUnload() {
    if (smsTimer) { clearInterval(smsTimer); smsTimer = null; }
  },

  onCodeInput(e) {
    const code = formatActivationCode(e.detail.value);
    this.setData({ "form.code": code }, () => this.validate());
  },

  onPhoneInput(e) {
    const phone = String(e.detail.value || "").replace(/\D/g, "").slice(0, 11);
    this.setData({ "form.phone": phone }, () => this.validate());
  },

  onSmsInput(e) {
    const sms = String(e.detail.value || "").replace(/\D/g, "").slice(0, 6);
    this.setData({ "form.sms": sms }, () => this.validate());
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed }, () => this.validate());
  },

  validate() {
    const { form, agreed } = this.data;
    const codeOk = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(form.code);
    const phoneOk = /^1\d{10}$/.test(form.phone);
    const smsOk = /^\d{6}$/.test(form.sms);
    this.setData({ canSubmit: codeOk && phoneOk && smsOk && agreed });
  },

  sendSms() {
    if (this.data.cooldown > 0) return;
    if (!/^1\d{10}$/.test(this.data.form.phone)) {
      wx.showToast({ icon: "none", title: "请输入正确的手机号" });
      return;
    }
    this.setData({ cooldown: 60 });
    smsTimer = setInterval(() => {
      const next = this.data.cooldown - 1;
      if (next <= 0) {
        clearInterval(smsTimer); smsTimer = null;
        this.setData({ cooldown: 0 });
      } else {
        this.setData({ cooldown: next });
      }
    }, 1000);
    wx.showToast({ icon: "none", title: "验证码已发送（mock）" });
  },

  async submit() {
    if (!this.data.canSubmit) return;
    wx.showLoading({ title: "激活中…", mask: true });
    try {
      const r = await AuthApi.activate({
        activationCode: this.data.form.code,
        phone: this.data.form.phone,
        smsCode: this.data.form.sms
      });
      app.setAuth({ token: r.token, activationCode: r.activationCode, phone: r.phone });
      wx.hideLoading();
      // 平台坑：登录页是 navigateTo 进来；进入 tabBar 必须用 switchTab。详见 agent.md「路由」
      wx.switchTab({ url: "/pages/messages/index" });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ icon: "none", title: "激活失败：" + (e.message || "未知错误") });
    }
  },

  callSales() {
    wx.makePhoneCall({ phoneNumber: "13888881234", fail() {} });
  }
});
