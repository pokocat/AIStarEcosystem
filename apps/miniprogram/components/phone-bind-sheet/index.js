// components/phone-bind-sheet — 「绑定手机号」底部面板（可复用）。
//
// 用法：
//   1) 页面 json 里 usingComponents 加 "phone-bind-sheet": "/components/phone-bind-sheet/index"
//   2) 页面 wxml 末尾放 <phone-bind-sheet id="phone-bind-sheet" />
//   3) 需要手机号的动作前：const ok = await Phone.ensurePhoneVerified(this, { reason: "…" })
//
// 平台坑：一键取号必须由用户真实点击 <button open-type="getPhoneNumber"> 触发，
// 不能用 JS 主动调起；而且只有「已认证的非个人主体小程序」才有这个能力，
// 个人主体 / 未认证会直接回 fail —— 所以永远保留短信兜底通道。详见 agent.md「登录 / 手机号」

const Phone = require("../../utils/phone.js");

Component({
  options: {
    // 让宿主页面的样式不污染面板
    addGlobalClass: false
  },

  data: {
    visible: false,
    reason: "",
    mode: "wechat", // wechat | sms
    busy: false,
    error: "",
    phone: "",
    code: "",
    cooldown: 0,
    canSubmitSms: false,
    // 绑定已在服务端生效、但本地登录态没换上（Codex 三轮 P1-9）。
    // 这时既不能当成功放行，也不能让用户再绑一次 —— 面板只剩一条「知道了」。
    blocked: false
  },

  detached() {
    this._clearTimer();
    this._settle(false);
  },

  methods: {
    /**
     * 打开面板。返回 Promise<boolean>：true = 绑定成功，false = 用户放弃 / 失败。
     */
    open(opts) {
      const options = opts || {};
      this._clearTimer();
      this.setData({
        visible: true,
        reason: options.reason || "为了保障账号与资金安全，继续操作前请先绑定手机号。",
        mode: "wechat",
        busy: false,
        error: "",
        phone: "",
        code: "",
        cooldown: 0,
        canSubmitSms: false,
        blocked: false
      });
      return new Promise((resolve) => {
        this._resolve = resolve;
      });
    },

    close() {
      if (this.data.busy) return;
      // blocked 态下 _settle 已经走过（resolve(false)），这里只负责收起面板
      this._clearTimer();
      this.setData({ visible: false });
      this._settle(false);
    },

    /** 阻止面板内点击穿透到遮罩 */
    noop() {},

    _settle(ok) {
      const resolve = this._resolve;
      this._resolve = null;
      if (typeof resolve === "function") resolve(ok === true);
    },

    _clearTimer() {
      // 计时器挂实例上，避免同页多实例互相清掉对方的倒计时
      if (this._smsTimer) { clearInterval(this._smsTimer); this._smsTimer = null; }
    },

    _done() {
      this._clearTimer();
      this.setData({ visible: false, busy: false });
      wx.showToast({ icon: "success", title: "手机号已绑定" });
      this._settle(true);
    },

    _fail(e) {
      // 绑定成功但本地登录态没换上：手上这张令牌服务端已经作废，
      // 继续走调用方那个「等手机号」的动作只会 401 或读到过期数据 —— 直接判否。
      if (e && e.code === Phone.BIND_RELOGIN_FAILED) {
        this._clearTimer();
        this.setData({
          busy: false,
          blocked: true,
          error: e.message || "绑定成功，但重新登录失败，请重启小程序再试"
        });
        // 面板留在屏幕上把话说清楚，但调用方的待办动作到此为止
        this._settle(false);
        return;
      }
      const msg = (e && e.message) || "绑定失败，请稍后重试";
      this.setData({ busy: false, error: msg });
    },

    // ── 微信一键取号 ────────────────────────────────────────────────────────

    onGetPhoneNumber(e) {
      if (this.data.blocked || this.data.busy) return;
      const detail = e.detail || {};
      const errMsg = String(detail.errMsg || "");
      if (!detail.code || errMsg.indexOf("ok") < 0) {
        // 用户拒绝授权 / 小程序主体没有该能力
        this.setData({
          error: errMsg.indexOf("deny") >= 0
            ? "你取消了授权，可改用短信验证码绑定"
            : "微信一键绑定暂时不可用，请用短信验证码绑定",
          mode: "sms"
        });
        return;
      }
      this.setData({ busy: true, error: "" });
      Phone.bindByWechatCode(detail.code)
        .then((r) => {
          if (r && r.merged) {
            // 合并到了同手机号的老账号：告诉用户发生了什么，不要静默
            wx.showToast({ icon: "none", title: "已合并到你的原有账号" });
          }
          this._done();
        })
        .catch((err) => this._fail(err));
    },

    // ── 短信兜底 ────────────────────────────────────────────────────────────

    switchToSms() {
      if (this.data.blocked) return;
      this.setData({ mode: "sms", error: "" });
    },

    switchToWechat() {
      if (this.data.blocked) return;
      this.setData({ mode: "wechat", error: "" });
    },

    onPhoneInput(e) {
      const phone = String(e.detail.value || "").replace(/\D/g, "").slice(0, 11);
      this.setData({ phone }, () => this._validate());
    },

    onCodeInput(e) {
      const code = String(e.detail.value || "").replace(/\D/g, "").slice(0, 6);
      this.setData({ code }, () => this._validate());
    },

    _validate() {
      this.setData({
        canSubmitSms: /^1\d{10}$/.test(this.data.phone) && /^\d{6}$/.test(this.data.code)
      });
    },

    sendCode() {
      if (this.data.blocked || this.data.cooldown > 0 || this.data.busy) return;
      if (!/^1\d{10}$/.test(this.data.phone)) {
        this.setData({ error: "请输入正确的手机号" });
        return;
      }
      this.setData({ busy: true, error: "" });
      Phone.sendSmsCode(this.data.phone)
        .then(() => {
          this.setData({ busy: false, cooldown: 60 });
          this._smsTimer = setInterval(() => {
            const next = this.data.cooldown - 1;
            if (next <= 0) { this._clearTimer(); this.setData({ cooldown: 0 }); }
            else this.setData({ cooldown: next });
          }, 1000);
          wx.showToast({ icon: "none", title: "验证码已发送" });
        })
        .catch((err) => this._fail(err));
    },

    submitSms() {
      if (this.data.blocked || !this.data.canSubmitSms || this.data.busy) return;
      this.setData({ busy: true, error: "" });
      Phone.bindBySms(this.data.phone, this.data.code)
        .then((r) => {
          if (r && r.merged) wx.showToast({ icon: "none", title: "已合并到你的原有账号" });
          this._done();
        })
        .catch((err) => this._fail(err));
    }
  }
});
