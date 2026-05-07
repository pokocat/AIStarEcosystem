const { CelebrityApi } = require("../../utils/api.js");

const CATS = ["全部", "美食", "美妆", "数码", "服饰", "母婴", "家居"];

Page({
  data: {
    cats: CATS,
    currentCat: "全部",
    stars: [],
    featured: null
  },

  onLoad() { this.fetch(); },

  onShow() {
    if (this.getTabBar) {
      const t = this.getTabBar();
      if (t) t.setData({ selected: 3 });
    }
  },

  async fetch() {
    try {
      const list = await CelebrityApi.listStars({ category: this.data.currentCat });
      const featured = list.find((s) => s.isHot) || list[0] || null;
      const rest = list.filter((s) => featured && s.id !== featured.id);
      this.setData({ stars: rest, featured });
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  setCat(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ currentCat: cat }, () => this.fetch());
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: "/pages/celebrity-detail/index?id=" + id });
  }
});
