// utils/auth.js — 统一账号中心（id.aibuzz.cn）登录态。
// 契约真源：docs/unified-identity-plan.md §6（小程序接入流程）/ §12.6（小程序）。
//
// 只在 config.authMode === "id" 时生效；legacy 模式下本模块不参与任何请求。
//
// 关键点：
//   - 静默登录：wx.login 拿 code → POST /oauth2/token（微信小程序 grant）
//   - 本地只存 access / refresh，session_key 永远留在账号中心
//   - refresh 单飞（并发 401 只换一次令牌）
//   - JWT payload 只做「读 claim」用途，不做签名校验（校验在 server 侧）

const config = require("../config.js");

const STORAGE_KEY = "auth.id";
const GRANT_WECHAT_MINI = "urn:aibuzz:params:oauth:grant-type:wechat-mini";
// 提前 60s 视为过期，避免「刚好卡在边界」的一次无谓 401
const EXPIRY_SKEW_MS = 60 * 1000;

let _refreshPromise = null;
let _loginPromise = null;

// ── 错误 ────────────────────────────────────────────────────────────────────

// 账号中心返回的是标准 OAuth2 错误体 { error, error_description }；
// error = 我们自己的业务码，error_description 已经是中文。
const ERROR_TEXT = {
  WX_CODE_INVALID: "微信登录凭证已过期，请重试",
  ACCOUNT_CLOSED: "该账号已注销，如需恢复请联系客服",
  ACCOUNT_SUSPENDED: "账号已被停用，请联系客服",
  ACCOUNT_STATE_INVALID: "登录状态已失效，请重新登录",
  invalid_grant: "登录状态已失效，请重新登录",
  invalid_client: "小程序登录配置有误，请联系技术支持",
  NETWORK_ERROR: "网络不给力，请稍后重试",
  NO_REFRESH_TOKEN: "登录状态已失效，请重新登录"
};

function makeError(code, message, status) {
  const e = new Error(message || ERROR_TEXT[code] || "登录失败，请稍后重试");
  e.code = code || "AUTH_ERROR";
  if (status) e.status = status;
  return e;
}

function fromOauthResponse(res) {
  const body = (res && res.data) || {};
  const code = body.error || "HTTP_" + (res && res.statusCode);
  // error_description 由账号中心给中文；没有就用本地兜底文案
  return makeError(code, body.error_description || ERROR_TEXT[code], res && res.statusCode);
}

// ── base64url → 字符串（小程序没有 atob / TextDecoder）────────────────────

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64UrlToBytes(input) {
  const s = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (ch === "=") break;
    const v = B64.indexOf(ch);
    if (v < 0) continue;
    buffer = ((buffer << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

function bytesToUtf8(bytes) {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    let cp;
    if (b < 0x80) {
      cp = b;
    } else if (b >= 0xc0 && b < 0xe0) {
      cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if (b >= 0xe0 && b < 0xf0) {
      cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else {
      cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    }
    if (cp > 0xffff) {
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      out += String.fromCharCode(cp);
    }
  }
  return out;
}

/**
 * 解 JWT 的 payload 段读 claim（sub / phone_verified / wx_openid / exp）。
 * 只用于「界面上要不要提示绑手机号」这类判断；令牌真伪由 server 用账号中心公钥验。
 */
function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return {};
    const json = bytesToUtf8(base64UrlToBytes(parts[1]));
    const payload = JSON.parse(json);
    return payload && typeof payload === "object" ? payload : {};
  } catch (e) {
    return {};
  }
}

// ── 本地存储 ────────────────────────────────────────────────────────────────

function readTokens() {
  try {
    const v = wx.getStorageSync(STORAGE_KEY);
    // 平台坑：某些 iOS 版本首次读返回空字符串而不是 undefined。详见 agent.md「存储」
    if (!v || !v.accessToken) return null;
    return v;
  } catch (e) {
    return null;
  }
}

function writeTokens(tokens) {
  try {
    wx.setStorageSync(STORAGE_KEY, tokens);
  } catch (e) {}
  syncGlobal(tokens);
  return tokens;
}

function clearTokens() {
  try {
    wx.removeStorageSync(STORAGE_KEY);
  } catch (e) {}
  syncGlobal(null);
}

function syncGlobal(tokens) {
  try {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.idAuth = tokens || null;
      app.globalData.idClaims = tokens ? decodeJwtPayload(tokens.accessToken) : null;
    }
  } catch (e) {
    // 平台坑：App 尚未实例化时 getApp() 会 throw。详见 agent.md「生命周期」
  }
}

function applyTokenResponse(resp) {
  const prev = readTokens();
  const expiresIn = Number((resp && resp.expires_in) || 0);
  const tokens = {
    accessToken: (resp && resp.access_token) || "",
    // 账号中心开了 refresh token rotation 时会回新的；没回就沿用旧的
    refreshToken: (resp && resp.refresh_token) || (prev && prev.refreshToken) || "",
    expiresAt: Date.now() + (expiresIn > 0 ? expiresIn * 1000 : 3600 * 1000)
  };
  if (!tokens.accessToken) throw makeError("AUTH_ERROR", "账号中心没有返回登录令牌");
  return writeTokens(tokens);
}

// ── 网络 ────────────────────────────────────────────────────────────────────

/**
 * 平台坑：header 声明 application/x-www-form-urlencoded 时，wx.request 对 object 的
 * 序列化在各基础库不一致，且不会对 value 里的 `:` 做百分号编码 —— 而我们的 grant_type
 * 是 `urn:aibuzz:params:oauth:grant-type:wechat-mini`，必须编码。所以自己拼 body 字符串。
 * 详见 agent.md「网络」
 */
function encodeForm(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
    .join("&");
}

function postForm(path, params) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.idBaseUrl + path,
      method: "POST",
      header: { "content-type": "application/x-www-form-urlencoded" },
      data: encodeForm(params),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data || {});
        else reject(fromOauthResponse(res));
      },
      fail() {
        reject(makeError("NETWORK_ERROR"));
      }
    });
  });
}

/**
 * 调账号中心自己的资源接口（/api/me/phone/**），带 Bearer；401 自动刷新一次再重放。
 * 注意：这些接口在账号中心（idBaseUrl），不是产品后端（apiBaseUrl）。
 */
function idRequest(path, options) {
  const opts = options || {};
  return ensureLoggedIn().then((tokens) =>
    rawIdRequest(path, opts, tokens.accessToken).catch((e) => {
      if (e.status !== 401) throw e;
      return refresh()
        .catch(() => loginWithWechat())
        .then((next) => rawIdRequest(path, opts, next.accessToken));
    })
  );
}

function rawIdRequest(path, opts, accessToken) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.idBaseUrl + path,
      method: opts.method || "GET",
      data: opts.data,
      header: Object.assign(
        { "content-type": "application/json" },
        accessToken ? { Authorization: "Bearer " + accessToken } : {},
        opts.header || {}
      ),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data;
          // 账号中心单资源也可能套 { success, data } 信封，两种都收
          if (body && body.success === true && "data" in body) resolve(body.data);
          else resolve(body);
        } else {
          const body = res.data || {};
          const err = body.error && typeof body.error === "object" ? body.error : {};
          const code = err.code || body.error || "HTTP_" + res.statusCode;
          const e = makeError(code, err.message || body.error_description || body.message, res.statusCode);
          reject(e);
        }
      },
      fail() {
        reject(makeError("NETWORK_ERROR"));
      }
    });
  });
}

// ── 登录 ────────────────────────────────────────────────────────────────────

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res && res.code) resolve(res.code);
        else reject(makeError("WX_CODE_INVALID", "没有拿到微信登录凭证，请重试"));
      },
      fail() {
        reject(makeError("NETWORK_ERROR"));
      }
    });
  });
}

function exchangeWechatCode(code) {
  return postForm("/oauth2/token", {
    grant_type: GRANT_WECHAT_MINI,
    client_id: config.idClientId,
    code
  }).then(applyTokenResponse);
}

/**
 * 微信静默登录。code 5 分钟有效且一次性，账号中心判 WX_CODE_INVALID 时
 * 自动重新 wx.login 再换一次（只重试一次，避免死循环）。
 */
function loginWithWechat() {
  if (_loginPromise) return _loginPromise;
  _loginPromise = wxLogin()
    .then(exchangeWechatCode)
    .catch((e) => {
      if (e && e.code === "WX_CODE_INVALID") {
        return wxLogin().then(exchangeWechatCode);
      }
      throw e;
    })
    .then(
      (r) => {
        _loginPromise = null;
        return r;
      },
      (e) => {
        _loginPromise = null;
        throw e;
      }
    );
  return _loginPromise;
}

/** 刷新令牌（单飞：并发 401 只换一次） */
function refresh() {
  if (_refreshPromise) return _refreshPromise;
  const tokens = readTokens();
  if (!tokens || !tokens.refreshToken) return Promise.reject(makeError("NO_REFRESH_TOKEN"));
  _refreshPromise = postForm("/oauth2/token", {
    grant_type: "refresh_token",
    client_id: config.idClientId,
    refresh_token: tokens.refreshToken
  })
    .then(applyTokenResponse)
    .then(
      (r) => {
        _refreshPromise = null;
        return r;
      },
      (e) => {
        _refreshPromise = null;
        // refresh 失败通常意味着账号被合并 / 注销 / 令牌被撤销 → 本地令牌作废
        if (e && (e.status === 400 || e.status === 401)) clearTokens();
        throw e;
      }
    );
  return _refreshPromise;
}

/** 有可用令牌就直接用；快过期先刷新；都不行就静默重新登录。 */
function ensureLoggedIn() {
  const tokens = readTokens();
  if (tokens && tokens.expiresAt && Date.now() < tokens.expiresAt - EXPIRY_SKEW_MS) {
    syncGlobal(tokens);
    return Promise.resolve(tokens);
  }
  if (tokens && tokens.refreshToken) {
    return refresh().catch(() => loginWithWechat());
  }
  return loginWithWechat();
}

function logout() {
  clearTokens();
  _refreshPromise = null;
  _loginPromise = null;
}

// ── claim 读取 ──────────────────────────────────────────────────────────────

/** 当前令牌（不触发网络；没有就返回 null） */
function peek() {
  return readTokens();
}

function getClaims() {
  const tokens = readTokens();
  return tokens ? decodeJwtPayload(tokens.accessToken) : {};
}

/** 手机号是否已验证（决定「带货生成 / 支付 / 开通」前要不要弹绑定） */
function isPhoneVerified() {
  const c = getClaims();
  return c.phone_verified === true || c.phone_verified === "true";
}

/** 账号中心的用户 id（uid），server 侧本地档案按它 JIT 建档 */
function getUid() {
  return getClaims().sub || "";
}

function getWxOpenId() {
  return getClaims().wx_openid || "";
}

module.exports = {
  STORAGE_KEY,
  loginWithWechat,
  ensureLoggedIn,
  refresh,
  logout,
  peek,
  clearTokens,
  idRequest,
  getClaims,
  getUid,
  getWxOpenId,
  isPhoneVerified,
  decodeJwtPayload
};
