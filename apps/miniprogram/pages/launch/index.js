// pages/launch/index.js — 启动页（首屏）。
//
// id 模式：静默 wx.login → 换账号中心令牌 → 拉 /me → 已开通进工作区，未开通去开通页。
//          用户全程不需要填手机号 / 验证码，也不会看到 legacy 的注册页。
// legacy 模式：有本地 token 直接进工作区，否则去老的「手机号 + 短信 + 激活码」注册页。
// 配置错误（声明了 id 模式却没给账号中心地址）：**停在这里**，只渲染错误屏。
//          不退回 legacy —— 那会让用户注册出一批账号中心里根本不存在的孤儿账号（P2-6）。

const config = require("../../config.js");

const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    status: "正在登录…",
    error: "",
    canRetry: false,
    // 配置错误屏：与「登录失败」分开 —— 用户重试多少次都没用，要改的是发布配置
    configError: ""
  },

  onLoad() {
    // 平台坑：getSystemInfoSync 在 iOS 14 偶尔返回 statusBarHeight=0；做兜底。详见 agent.md「API 不一致」
    try {
      const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
    } catch (e) {}
    this.bootstrap();
  },

  retry() {
    if (config.hasConfigError()) return; // 重试改不了配置
    this.setData({ error: "", canRetry: false, status: "正在登录…" });
    this.bootstrap();
  },

  async bootstrap() {
    // fail closed：配置声明了账号中心却没给地址，这一版哪条登录线都不能走。
    // 退回 legacy 会让用户用「手机号 + 激活码」注册出一个账号中心里没有的账号，
    // 事后既对不上号也没人发现配置错了。
    if (config.hasConfigError()) {
      this.setData({ status: "", error: "", canRetry: false, configError: config.configError });
      return;
    }

    if (!config.isIdMode()) {
      // legacy：保持原有行为（进注册页），只是多认一次本地已有登录态
      const auth = app.globalData.auth || {};
      if (auth.token) wx.switchTab({ url: "/pages/messages/index" });
      else wx.reLaunch({ url: "/pages/login/index" });
      return;
    }

    try {
      await app.ensureIdLogin();
      this.setData({ status: "正在加载账号信息…" });
      await app.refreshMe();
    } catch (e) {
      // 兜底：万一后端把 /me 也纳入了开通闸，直接去开通页，别把用户卡在启动页
      if (e && e.code === "PRODUCT_NOT_ENROLLED") {
        app.globalData.bootstrapped = true;
        wx.reLaunch({ url: "/pages/enroll/index" });
        return;
      }
      this.setData({
        status: "",
        error: (e && e.message) || "登录失败，请稍后重试",
        canRetry: true
      });
      return;
    }

    app.routeAfterLogin();
  },

  callSales() {
    wx.makePhoneCall({ phoneNumber: "13888881234", fail() {} });
  }
});
