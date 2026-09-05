// utils/phone.js — 手机号绑定（统一账号中心）。
// 契约真源：docs/unified-identity-plan.md §5（不同主体 / 手机号策略）/ §12.6。
//
// 为什么要绑：微信只在同一开放平台主体下才返回相同 unionid，本生态几个小程序不一定同主体，
// 所以 unionid 不能当跨端身份键（§5 D5）。凡是有副作用的动作（开通 / 支付 / 生成）之前，
// 都必须先拿到「已验证的手机号」，跨端合并也由手机号触发。
//
// 客户端不读、不存、不比对 unionid。

const config = require("../config.js");
const Auth = require("./auth.js");

/** 当前账号手机号是否已验证 */
function isVerified() {
  if (!config.isIdMode()) return true; // legacy 注册流程本来就要手机号 + 验证码
  if (config.useMock) return true; // mock 模式没有真实令牌，不拦交互流程
  return Auth.isPhoneVerified();
}

// 绑定已在服务端生效、但本地登录态没能跟上时的错误码。调用方据此知道：
// 别把这次当成功（后续动作会拿着一张已经作废的令牌去打），也别提示用户重新绑定（已经绑上了）。
const BIND_RELOGIN_FAILED = "BIND_RELOGIN_FAILED";

function reloginFailed(cause) {
  const e = new Error("绑定成功，但重新登录失败，请重启小程序再试");
  e.code = BIND_RELOGIN_FAILED;
  // 绑定本身是成功的：调用方不应该引导用户再绑一次
  e.bindSucceeded = true;
  if (cause && cause.message) e.cause = cause;
  return e;
}

/**
 * 绑定完成后的收尾：
 *  - reloginRequired=true → 本次微信身份已经改挂到「存活方」账号，本地令牌全部作废，重新静默登录
 *  - 否则 → 刷新令牌，让 phone_verified 这个 claim 变成 true
 * 最后统一刷一次 /api/me（开通状态可能随合并变化）。
 *
 * 失败必须抛出，不能吞（Codex 三轮 P1-9）。原来这两步各自 `.catch(() => null)`：
 * 令牌换不回来、/api/me 拉不到，绑定照样 resolve 成功 —— 于是调用方带着一张
 * **已经被服务端作废**的 access token 继续往下走（合并时被并方的令牌当场进拦截名单），
 * 下一步动作要么 401 要么静默读到旧的开通状态，而用户看到的是「绑定成功」。
 * 现在只有「拿到新令牌」+「/api/me 重新拉到」都成立才算成功。
 */
function afterBind(result) {
  const r = result || {};
  const step = r.reloginRequired
    ? Promise.resolve(Auth.logout()).then(() => Auth.loginWithWechat())
    : Auth.refresh().catch(() => Auth.loginWithWechat());

  return step.then(
    (tokens) => {
      // (a) 真的换到了新令牌 —— resolve 成 undefined / 没有 accessToken 都不算
      if (!tokens || !tokens.accessToken) throw reloginFailed(null);
      // (b) /api/me 重新拉到（开通状态可能随合并变化，拉不到就不能按「已绑定」往下走）
      const app = safeApp();
      if (!app || typeof app.refreshMe !== "function") {
        // 没有 App 实例可刷（极少数：组件在 App 实例化之前用）——令牌已经换好，
        // 不把这算作失败，但也不假装 /me 是新的。
        return null;
      }
      return app.refreshMe().catch((e) => { throw reloginFailed(e); });
    },
    (e) => { throw reloginFailed(e); }
  ).then(() => ({
    survivorUid: r.survivorUid || Auth.getUid(),
    merged: r.merged === true,
    reloginRequired: r.reloginRequired === true
  }));
}

function safeApp() {
  try { return getApp(); } catch (e) { return null; }
}

/** 微信一键取号：`getPhoneNumber` 回调里的 code 交给账号中心换手机号 */
function bindByWechatCode(code) {
  return Auth.idRequest("/api/me/phone/wechat-bind", { method: "POST", data: { code } }).then(afterBind);
}

/** 兜底通道：短信验证码绑定 */
function sendSmsCode(phone) {
  return Auth.idRequest("/api/me/phone/send-code", { method: "POST", data: { phone } });
}

function bindBySms(phone, code) {
  return Auth.idRequest("/api/me/phone/bind", { method: "POST", data: { phone, code } }).then(afterBind);
}

/**
 * 需要手机号的动作调这个：已验证直接放行，未验证则弹出页面里的「绑定手机号」面板。
 *
 * @param {object} page  调用方 Page 实例（this），面板组件要挂在它的 wxml 上（id="phone-bind-sheet"）
 * @param {object} opts  { reason: "开通带货前需要先绑定手机号" }
 * @returns {Promise<boolean>} true = 已验证 / 本次绑定成功
 */
function ensurePhoneVerified(page, opts) {
  if (isVerified()) return Promise.resolve(true);

  const sheet = page && typeof page.selectComponent === "function"
    ? page.selectComponent("#phone-bind-sheet")
    : null;
  if (sheet && typeof sheet.open === "function") return sheet.open(opts || {});

  // 页面没挂面板组件时的兜底：引导去「我的」绑定，不硬失败
  return new Promise((resolve) => {
    wx.showModal({
      title: "需要先绑定手机号",
      content: (opts && opts.reason) || "为了保障账号安全，继续操作前请先绑定手机号。",
      confirmText: "去绑定",
      cancelText: "以后再说",
      success(res) {
        if (res.confirm) wx.switchTab({ url: "/pages/me/index" });
        resolve(false);
      },
      fail() { resolve(false); }
    });
  });
}

module.exports = {
  BIND_RELOGIN_FAILED,
  isVerified,
  ensurePhoneVerified,
  bindByWechatCode,
  sendSmsCode,
  bindBySms
};
