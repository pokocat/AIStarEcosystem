const { CelebrityApi } = require("../../utils/api.js");
const { formatCompactNumber, formatPercent } = require("../../utils/format.js");

Page({
  data: {
    gmvInt: "0",
    gmvFrac: "00",
    exposureFmt: "0",
    orderFmt: "0",
    convFmt: "0%",
    pipeline: [],
    shortcuts: [],
    myStars: []
  },

  onLoad() { this.fetch(); },

  onShow() {
    if (this.getTabBar) {
      const t = this.getTabBar();
      if (t) t.setData({ selected: 2 });
    }
  },

  async fetch() {
    try {
      const o = await CelebrityApi.overview();
      // 平台坑：toLocaleString 在某些 iOS WebView 受限；自己拼分隔符。详见 agent.md「API 不一致」
      const total = Number(o.todayGmv || 0);
      const intPart = Math.floor(total).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      const frac = (Math.round((total - Math.floor(total)) * 100)).toString().padStart(2, "0");
      this.setData({
        gmvInt: "¥" + intPart,
        gmvFrac: frac,
        exposureFmt: formatCompactNumber(o.videoExposure),
        orderFmt: o.orderCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
        convFmt: formatPercent(o.conversionRateChange, 1),
        pipeline: o.pipeline || [],
        shortcuts: o.shortcuts || [],
        myStars: o.myStars || []
      });
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  goRoute(e) {
    const route = e.currentTarget.dataset.route;
    if (!route) return;
    const isTab = ["/pages/messages/index", "/pages/videos/index", "/pages/workbench/index", "/pages/market/index", "/pages/me/index"].some((p) => route.indexOf(p) === 0);
    if (isTab) wx.switchTab({ url: route });
    else wx.navigateTo({ url: route });
  }
});
