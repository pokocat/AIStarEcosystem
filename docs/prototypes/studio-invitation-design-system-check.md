# Studio 邀请页：既有设计系统核对

2026-10-17 · ordinary extension documenter 记录。范围仅为独立交互设计稿，不代表生产发布或线上注册闭环验收。

## 对照证据与结论

视觉真源为 [Studio DESIGN.md](../../apps/web-aiavatar/DESIGN.md)；产品语境核对 [PRODUCT.md](../../apps/web-aiavatar/PRODUCT.md) 中当前品牌、统一认证、邀请与设备形态约束。页面目标及方向以 [邀请页设计说明](studio-invitation-design.md) 为准。

核对了原型 [HTML](../../prototypes/studio-invitation/index.html)、[CSS](../../prototypes/studio-invitation/style.css)、[交互脚本](../../prototypes/studio-invitation/app.js)，并与既有 `src/styles/ip-brand.css` 的令牌、按钮、字体和焦点语言比对。已查看以下截图：

- [桌面首屏](studio-invitation-preview/desktop.jpg)与[桌面全页](studio-invitation-preview/desktop-full.jpg)，视口 1280×720。
- [手机首屏](studio-invitation-preview/mobile.jpg)与[手机全页](studio-invitation-preview/mobile-full.jpg)，视口 390×844。

结论：原型是既有 Studio 公开首页语言的局部扩展。品牌识别、摄影与中文衬线承担产品表达，邀请人和主操作承担来访上下文；手机将邀请与操作放在大图之前，主动作在首屏内。没有产生需要升级为全局规则的新视觉系统，因此保留既有 `DESIGN.md`、设计 sidecar、`PRODUCT.md` 与全局样式。

## 继承与局部适配

| 维度 | 继承证据 | 原型局部处理 |
|---|---|---|
| 材料与颜色 | 暖灰底 `#f0efec`、白面 `#ffffff`、深墨 `#192229`、浅灰 `#f6f6f5`；主操作 hover `#323e45` | 次文字用 `#626c76`，主要分隔用 `#d9dcde`，相较系统 `#65707e` / `#e8eaec` 更清楚；仅记为原型值，不回写系统 |
| 字体 | Noto Serif SC / Songti SC 承载标题；Manrope / Noto Sans SC / 系统无衬线承载正文和操作 | 页面大标题用 600 字重、桌面流式字号与手机 43px；不替换系统的 display 规格 |
| 按钮与反馈 | 深墨主按钮、白字、小圆角、底色 hover、深墨实线焦点；沿用同一缓动曲线 | 邀请 CTA 高 56px，手机 52px；焦点外偏移 5px，相较系统 3px 是本页适配 |
| 表面与图像 | 平面白面、细边线、圆角裁切，无常驻容器投影；蓝灰侧脸 logo 与暖色摄影 | 双栏展示区、三种创作方向及 FAQ 属于邀请页组成，不扩展为工作页模板 |
| 设备形态 | CSS 与 JS 同读 `html[data-layout]`，默认 960px | 独立原型仅按视口设置属性；没有生产版的用户显式设备偏好读取，接入时须复用现有 layout-mode |

原型的 `:root` 变量只服务于独立 HTML，不是可复制到应用全局的令牌定义。正式接入应沿用 `.ip-brand-surface` 的作用域与既有字体加载；不将此页字号、容器宽度或辅助灰色升格为通用规范。

## 页面交互与状态

- 人物／影像／故事切换会同步图片、替代文本、标题和说明，保留 `tablist` / `tab` / `tabpanel` 关系、选中状态与方向键、Home、End 键支持。展示的是静态创作示意，没有视频播放行为。
- 邀请区直接显示手机号、验证码和“注册并进入 Studio”；取消“接受邀请”、重复登录入口和说明弹窗。手机号与验证码有持续可见标签、数字键盘及自动填充属性；同一表单覆盖注册和已有账号登录。获取验证码与提交仅作本地演示，不触发认证。
- 预览工具及 `?state=` 展示正常邀请、已有账号、邀请失效、读取失败四种状态。已有账号沿用同一验证码表单、保持原关系；失效状态隐藏邀请人并说明仍可普通注册；读取失败隐藏表单并提供重试，避免误当作无邀请注册。
- FAQ 使用原生 details；展开图标已是内联 SVG，展开时隐藏竖线。焦点可见，减少动态偏好关闭过渡和滚动动画。

这些状态与交互仅记录本页行为，不新增通用业务组件、全局状态色或加载规范。截图证明布局与可读性；本记录对脚本进行静态核对，不将其表述为完整的认证或无障碍验收。

## 素材与复用边界

素材均来自既有 Studio 品牌与功能示意，来源及用途见 [SOURCES.md](../../prototypes/studio-invitation/assets/SOURCES.md)。图片明确标为「AI 创作示意」，不冒充邀请人作品或效果保证；邀请人头像使用名称首字。复用范围为此品牌邀请入口的结构、文案层次、创作方向切换和状态设计，不能据此增加积分、奖励、开通或创作效果承诺。

尚未接入邀请码解析、ID 本人 API、短信、注册、登录、OIDC/PKCE、邀请绑定与应用回跳；没有创建账号、调用生产 API 或改变产品开通、积分。未来接入仍由 ID 保存关系，已有账号不新增或改写注册邀请关系，注册不代表产品开通。

本次未发现需要为邀请页修改既有系统文档的新增规则；所列原型值差异及设备偏好边界均留作接入记录，没有借此修订既有文档或处理其他页面的漂移。

2026-10-17 v2：用户要求取消中间点击，已以直接手机号／验证码表单替换确认模块；品牌、图片、字体与全局系统保持。独立复核已查看更新后的四张截图，结论 ship、无必改项。此增量不新增全局设计规则。

## 2026-10-17 · 实施对照（Studio 待发布）

以上章节及[邀请页设计说明](studio-invitation-design.md)中“尚未接入短信、注册”“仅作本地演示”、固定演示验证码，以及“未读取用户设备偏好”的描述，均为独立 HTML 原型阶段的历史记录，不代表当前应用实现。原型仍保留演示行为；实际入口为 `apps/web-aiavatar/src/app/invite/[code]/page.tsx` 与 `src/ip/invitation-registration.tsx`，两者须分别验收。

| 对照项 | 独立原型 | 当前应用实现 |
|---|---|---|
| 视觉作用域 | 独立 HTML 使用 `:root` 局部变量 | `src/styles/invitation-registration.css` 将页面令牌和选择器限定在 `.studio-invite`；沿用暖灰、白面、深墨、中文衬线与既有字体加载，不新增全局视觉规则 |
| 邀请读取 | 本地状态工具与示例数据 | `InvitationApi.getInvitationPreview` 直连 ID `GET /api/auth/invitations/{code}`；读取失败隐藏表单并重试，明确失效后才允许普通注册 |
| 短信 | 固定 `123456`，本地倒计时 | `InvitationApi.sendInvitationSms` 直连 ID `POST /api/auth/sms/send-code`；成功后显示已发送与 60 秒重试倒计时，错误保留表单并显示原因 |
| 注册与登录 | 本地提交反馈，不认证 | `loginWithIdSms` 向 ID `/oauth2/token` 提交 `urn:aibuzz:params:oauth:grant-type:sms`；有效邀请随 `invite_code` 传递，使用现有令牌存储，成功后进入 `/dashboard`。账号、短信核验和邀请绑定仍归 ID，已有账号关系不改写，注册不自动开通产品 |
| 设备形态 | 原型按视口自行设置属性 | 应用根布局沿用 `LAYOUT_BOOT_SCRIPT` 与 `src/shell/layout-mode.ts`；页面 CSS 读取既有 `html[data-layout]`，复用用户显式选择优先、未选择时默认 960px 的规则，不另建邀请页设备判定 |
| 图片 | 原型 PNG | 应用使用 `/invitation/{image,video,script}.webp`；来源和 `cwebp -q 88` 转换校验见 [SOURCES.md](../../prototypes/studio-invitation/assets/SOURCES.md) |

本次已核对上述应用代码、`packages/api-client/src/api/invitation.ts`、`packages/api-client/src/oidc.ts` 及既有布局入口，并查看实现截图：[桌面 1280×720](studio-invitation-live-preview/desktop.png)、[手机 390×844](studio-invitation-live-preview/mobile.png)。两张截图中的邀请表单、示意图与品牌材料延续原型；手机先显示邀请与主操作，图片在其后。截图是应用本地渲染证据，不能证明真实短信已送达或生产新账号注册完成。

本轮视觉复核已通过；此记录补齐普通扩展的实施差异，不修改 `PRODUCT.md`、`DESIGN.md`、全局令牌或其他页面。ID `ba79d5a` 已部署，Studio 本轮版本仍待发布；使用真实生产短信完成全新账号注册、关系绑定及进入 Studio 的闭环仍待人工验收，不能据代码接通或视觉通过宣称已完成。
