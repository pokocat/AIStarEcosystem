# Studio 品牌邀请页 · 独立设计原型

用户要求“邀请页先设计，要体现品牌产品力”。本原型沿用 Studio 已有视觉与公开创作示意，先提供设计审阅；没有接入生产注册、短信或邀请 API，没有替换线上页面。

本地启动：

```bash
python3 -m http.server 3068 --bind 127.0.0.1 --directory prototypes/studio-invitation
```

打开 http://127.0.0.1:3068 。可切换人物／影像／故事，直接输入手机号、获取演示验证码并提交注册表单，展开邀请说明，底部切换正常／已有账号／失效／读取失败状态。390px 手机与桌面使用同一份内容。

设计说明：[设计稿](../../docs/prototypes/studio-invitation-design.md)。素材与字体来源见 [SOURCES](assets/SOURCES.md)。

2026-10-17 简化版：取消“接受邀请”和说明弹窗，首屏直接展示手机号、验证码与“注册并进入 Studio”。演示验证码为 123456，不会发送短信、提交手机号或创建账号。
