const { CelebrityApi } = require("../../utils/api.js");

const app = getApp();
const CATS = ["全部", "美食", "美妆", "数码", "服饰", "母婴", "家居"];
const SORTS = [
  { id: "hot", label: "热度排序" },
  { id: "price-asc", label: "价格升序" },
  { id: "price-desc", label: "价格降序" }
];

Page({
  data: {
    currentScope: "my", // 'my' | 'market'
    myStars: [],
    myStarsCount: 0,
    marketCount: 48,
    cats: CATS,
    currentCat: "全部",
    stars: [],
    featured: null,
    currentSort: "hot",
    sortLabel: "热度排序"
  },

  onLoad() {
    this.fetchMy();
  },

  onShow() {
    if (this.getTabBar) {
      const t = this.getTabBar();
      if (t) t.setData({ selected: 3 });
    }
    // 从 detail 页面回来，刷新已授权列表（可能新增了授权）
    this.fetchMy();
  },

  setScope(e) {
    const s = e.currentTarget.dataset.s;
    this.setData({ currentScope: s }, () => {
      if (s === "market" && this.data.stars.length === 0) this.fetchMarket();
    });
  },

  async fetchMy() {
    try {
      const list = await CelebrityApi.listMyStars();
      // 给已授权的 star 计算剩余天数
      const today = new Date();
      const enriched = list.map((s) => {
        let expireDays = null;
        if (s.auth && s.auth.expireDate) {
          const exp = new Date(s.auth.expireDate);
          expireDays = Math.max(0, Math.round((exp - today) / 86400000));
        }
        return { ...s, auth: { ...s.auth, expireDays } };
      });
      this.setData({ myStars: enriched, myStarsCount: enriched.length });
    } catch (e) { /* 静默 */ }
  },

  async fetchMarket() {
    try {
      const list = await CelebrityApi.listStars({ category: this.data.currentCat });
      const sorted = this.applySort(list, this.data.currentSort);
      const featured = sorted.find((s) => s.isHot) || sorted[0] || null;
      const rest = sorted.filter((s) => featured && s.id !== featured.id);
      this.setData({ stars: rest, featured });
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  applySort(list, sort) {
    const out = [...list];
    if (sort === "hot") {
      out.sort((a, b) => (b.hotScore || 0) - (a.hotScore || 0));
    } else if (sort === "price-asc" || sort === "price-desc") {
      out.sort((a, b) => {
        const pa = parseInt(String(a.startingPrice || "0").replace(/\D/g, ""), 10) || 0;
        const pb = parseInt(String(b.startingPrice || "0").replace(/\D/g, ""), 10) || 0;
        return sort === "price-asc" ? pa - pb : pb - pa;
      });
    }
    return out;
  },

  setCat(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ currentCat: cat }, () => this.fetchMarket());
  },

  onSort() {
    const idx = SORTS.findIndex((s) => s.id === this.data.currentSort);
    const next = SORTS[(idx + 1) % SORTS.length];
    this.setData({ currentSort: next.id, sortLabel: next.label }, () => this.fetchMarket());
  },

  onSearch() {
    // 真实环境会唤起搜索面板；mock 环境给提示
    wx.showToast({ icon: "none", title: "筛选面板开发中" });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: "/pages/celebrity-detail/index?id=" + id });
  },

  goGenerate(e) {
    // 已授权明星 → 直达生成器，预填 starId
    const id = e.currentTarget.dataset.id;
    app.globalData.selectedStarId = id;
    wx.navigateTo({ url: "/pages/generator/index?starId=" + id });
  },

  onFabTap() {
    wx.showToast({ icon: "none", title: "AI 助手开发中" });
  }
});
