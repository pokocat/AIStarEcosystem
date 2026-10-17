# Studio 品牌邀请页 · 独立设计原型

用户要求“邀请页先设计，要体现品牌产品力”。本原型沿用 Studio 已有视觉与公开创作示意，先提供设计审阅；没有接入生产注册、短信或邀请 API，没有替换线上页面。

本地启动：

```bash
python3 -m http.server 3068 --bind 127.0.0.1 --directory prototypes/studio-invitation
```

打开 http://127.0.0.1:3068 。可切换人物／影像／故事，点击主动作查看认证后回 Studio 的接入说明，展开邀请说明，底部切换正常／已有账号／失效／读取失败状态。390px 手机与桌面使用同一份内容。

设计说明：[设计稿](../../docs/prototypes/studio-invitation-design.md)。素材与字体来源见 [SOURCES](assets/SOURCES.md)。
