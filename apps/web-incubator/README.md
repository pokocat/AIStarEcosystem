# web-incubator · AI 艺人孵化平台全端演示

把设计方给的 Figma Make 原型（压缩包《AI 艺人孵化》）整体搬进仓库的独立应用，端口 **3020**。
**纯前端演示**：全部是示例数据，AI 生成是定时器模拟，不调接口、不扣积分，刷新后操作结果会丢。
页面左下角常驻「演示数据」，并设置了 `noindex`。

产品范围见 [PRODUCT.md](PRODUCT.md)，原型自带的需求文档在 [docs/](docs/)。

## 启动

```bash
pnpm dev:incubator
```

打开 http://localhost:3020 。线上地址 https://incubator.aibuzz.cn 。可以用 `?end=` 直接进某一端：

| 地址 | 端 |
|---|---|
| `/` | 落地页（可切换十种 IP 类型的方案页） |
| `/?end=producer_login` | 生态创业者登录（随便填即可进入） |
| `/?end=producer_app` | 生态创业者 / MCN 工作台 |
| `/?end=celebrity_ip` | 明星 IP 端 |
| `/?end=brand_portal` | 品牌端 |
| `/?end=admin` | 运营后台 |
| `/?end=fan` | 粉丝端 |
| `/?end=miniapp_entrepreneur` | 创业者小程序（手机外壳模拟） |
| `/?end=miniapp_clip` | 切片小程序（手机外壳模拟） |

各端之间用右下角的圆形按钮切换。

## 代码结构

```
src/app/            Next 外壳：layout + 只在客户端渲染的 PrototypeHost
src/prototype/      搬来的原型：App.tsx、components/、data/、translations.ts、styles/
public/fonts/       自托管 Inter、JetBrains Mono（不依赖 Google Fonts）
public/images/      全站演示图（AI 生成，自托管），出图要求见 docs/image-manifest.json
docs/               原型自带的 PRD、明星端产品文档、设计迭代记录（只读留档）
```

技术上是 Next 16 + React 19 + Tailwind v4 的客户端单页（`dynamic(..., { ssr: false })`），
页面切换仍是原型的 `useState` 状态机，工作台内部的菜单没有写进地址栏。
不依赖 `@ai-star-eco/*` 共享包，样式不会影响其他应用。

## 相对原型改了什么

`src/prototype/` 是搬来的代码，**尽量少改，改了在这里记一笔**：

- **只搬用到的文件**：原型 186 个业务文件加一整套 UI 组件，入口和运营后台实际用到的是 131 个文件（约 5 万行）。
  没搬的有：和 `mcn/` 重复的 `producer/`、未挂载的旧页面、Supabase 边缘函数、Figma 平台文件。
- **运营后台接上了入口**：`admin/AdminConsole` 在原型里没有入口，这里加到了右下角切换器。
- **语言固定中文**（AGENTS.md §4.6）：去掉所有语言切换按钮，`lang` 恒为 `zh`。
  组件里的 `zh ? '中文' : 'English'` 分支和 `translations.ts` 的英文**还留在源码里**，运行时走不到。
- **地址栏同步**：当前端写进 `?end=`，刷新和浏览器后退可用。
- **去掉浏览器原生弹窗**（AGENTS.md §8）：标签删除改成就地「确认删除 / 取消」；
  「前往培训认证」原来只弹一句话，现在真的跳到培训认证页。
- **手机宽度**：运营后台侧栏默认收起、明星端侧栏改成顶部横向滚动、明星端和品牌端顶栏不再挤成多行。
- **类型错误全部修掉**，严格模式通过（44 处，有几处是真问题：`PlatformAccount` 没引入、
  `activeMembers` 写成数字、用户管理的搜索框图标传了不存在的属性）。
- **真实人物全部换成虚拟**：原型的示例数据里有九位真实艺人和一部真实电视剧，配着虚构的授权状态、GMV 和合同，
  不能放到公网。对照：于震→陈屿、肖战→顾然、杨幂→苏枝、王一博→陆星野、刘亦菲→林鹿白、贾乃亮→周景行、郝邵文→许知遥、
  李立群→程远山、张艺星（和张艺兴太像）→宋一鸣、《亮剑》→《破晓行动》。`docs/` 里留档的原始文档没改，不随应用发布。
- 文案只改了三句命中门禁（§9）的营销词。其余界面文字保持原样，**没有**按 §8 的文案规范逐条修改。

## 已知问题（都来自原型）

- 艺人图标、类型标记有很多三个字母的占位（`SNG`、`ACT`、`CEL 正式出道！`），是原型用来代替 emoji 的。
- 孵化成功后，新艺人不会出现在矩阵列表里；其他「现状差距」见 `docs/prd/` 各章末尾。
- 图片全部是我们生成的演示图，放在 `public/images/`，人物都是虚构的。换图时按 `docs/image-manifest.json` 里的要求重新生成同名文件；同一个人全站共用一张图，商品图不带品牌标识，但示例数据里仍写着 SK-II、Jo Malone 等真实品牌名（见 TODO）。
- 和正式产品有重叠：明星端的正式实现是 `apps/web-star`，运营后台的正式实现是 `apps/admin`，
  创作者工作台的正式实现是 `apps/web-celebrity`、`apps/web-aiavatar`。本应用**不替代**它们。

## 版本日志

### 2026-11-05 · 首版（本地未发布）

- 从原型搬入全部端：落地页、登录、生态创业者工作台、明星端、品牌端、运营后台、粉丝端、两个小程序。
- 不接后端，没有迁移和接口。

### 2026-11-06 · 部署到 incubator.aibuzz.cn

- 真实艺人和作品换成虚拟；登记 `web-incubator` 服务（构建、部署、校验脚本，env / systemd / nginx 示例）。
- 公开访问、不用登录，设置了 noindex。发布记录见 `docs/releases/web-incubator-release-20261106.md`。
