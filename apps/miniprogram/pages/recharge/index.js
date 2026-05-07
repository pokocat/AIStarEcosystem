const { WalletApi } = require("../../utils/api.js");

Page({
  data: {
    credits: { totalBalance: 0, licenseBalance: 0, rechargeBalance: 0, giftBalance: 0, pendingBalance: 0 },
    packages: [],
    currentPkgId: "",
    currentPkg: { priceYuan: 0 }
  },

  onLoad() { this.fetch(); },

  /** 把 server 形态的 RechargePackage（priceCents/bonusCredits）派生为渲染态（priceYuan/bonusText） */
  enrich(pkg) {
    if (!pkg) return { priceYuan: 0 };
    const cents = pkg.priceCents || 0;
    const yuan = (cents / 100);
    const priceYuan = Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2);
    const bonusText = pkg.bonusCredits && pkg.bonusCredits > 0
      ? "+ " + pkg.bonusCredits + " 赠送"
      : "";
    return { ...pkg, priceYuan, bonusText };
  },

  async fetch() {
    try {
      const [credits, packagesRaw] = await Promise.all([
        WalletApi.getCredits(),
        WalletApi.listPackages()
      ]);
      const packages = (packagesRaw || []).map((p) => this.enrich(p));
      // 默认选中推荐包
      const recommended = packages.find((p) => p.recommended) || packages[0];
      this.setData({
        credits,
        packages,
        currentPkgId: recommended ? recommended.id : "",
        currentPkg: recommended || { priceYuan: 0 }
      });
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  selectPkg(e) {
    const id = e.currentTarget.dataset.id;
    const pkg = this.data.packages.find((p) => p.id === id);
    this.setData({ currentPkgId: id, currentPkg: pkg || { priceYuan: 0 } });
  },

  async submit() {
    if (!this.data.currentPkgId) return;
    wx.showLoading({ title: "支付中…", mask: true });
    try {
      // mock：直接调充值落账。真实环境：先 wx.requestPayment 走微信支付，回调成功后再 recharge 落账。
      const r = await WalletApi.recharge(this.data.currentPkgId);
      wx.hideLoading();
      wx.showToast({ icon: "success", title: "充值成功" });
      // RechargeResponseDto: { wallet, ledgerEntry } —— credits 用 wallet 字段更新
      this.setData({ credits: r.wallet || r.credits || this.data.credits });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ icon: "none", title: e.message || "充值失败" });
    }
  }
});
