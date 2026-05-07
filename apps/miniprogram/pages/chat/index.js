const { NotificationsApi } = require("../../utils/api.js");

Page({
  data: {
    statusBarHeight: 44,
    botId: "",
    bot: { name: "", subtitle: "", avatarColor: "#0A0A0A", avatarIcon: "✦", iconColor: "#C8FF00" },
    messages: [],
    anchor: "",
    draft: ""
  },

  onLoad(options) {
    // 平台坑：onLoad options 偶尔为空（webview 跳回）。详见 agent.md「生命周期」
    const botId = (options && options.botId) || "pian";
    try {
      const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
    } catch (e) {}
    this.setData({ botId });
    this.fetch(botId);
  },

  async fetch(botId) {
    try {
      const c = await NotificationsApi.getConversation(botId);
      // 给每条消息一个稳定的 id 用于 wx:key + scroll-into-view
      const messages = (c.messages || []).map((m, i) => ({ ...m, id: "m-" + i }));
      this.setData({
        bot: c.bot || this.data.bot,
        messages,
        anchor: messages.length ? "m-" + (messages.length - 1) : ""
      });
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  back() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/messages/index" });
  },

  onDraftInput(e) {
    this.setData({ draft: e.detail.value });
  },

  send() {
    const text = (this.data.draft || "").trim();
    if (!text) return;
    // mock：把用户消息追加到流末尾，之后 Bot 回一句"已收到"。真实接入后走 server 流式接口。
    const messages = this.data.messages.slice();
    const baseIdx = messages.length;
    messages.push({ id: "m-u-" + baseIdx, type: "user-text", text });
    this.setData({ messages, draft: "", anchor: "m-u-" + baseIdx });
    setTimeout(() => {
      const replyIdx = messages.length;
      const next = messages.slice();
      next.push({ id: "m-r-" + replyIdx, type: "text", text: "收到～我去问下后台再来回你 👌" });
      this.setData({ messages: next, anchor: "m-r-" + replyIdx });
    }, 600);
  },

  goRoute(e) {
    const route = e.currentTarget.dataset.route;
    if (!route) return;
    const isTab = ["/pages/messages/index", "/pages/videos/index", "/pages/workbench/index", "/pages/market/index", "/pages/me/index"].some((p) => route.indexOf(p) === 0);
    if (isTab) wx.switchTab({ url: route });
    else wx.navigateTo({ url: route });
  },

  onMore() {
    wx.showActionSheet({
      itemList: ["置顶会话", "标记已读", "通知设置", "举报"],
      success: () => wx.showToast({ icon: "none", title: "开发中" })
    });
  },

  onPlus() {
    wx.showActionSheet({
      itemList: ["上传图片", "拍摄视频", "发送商品 SKU"],
      success: () => wx.showToast({ icon: "none", title: "附件开发中" })
    });
  }
});
