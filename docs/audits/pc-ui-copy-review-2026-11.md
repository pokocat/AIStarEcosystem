# PC 站界面文案审阅稿（2026-11）

> 范围：`apps/web-aiavatar` 桌面形态，涵盖首页（新版和旧版）、AI 视频、AI 图片、画布、导演台、项目、资产、发行，以及我的、企业、邀请、登录，另加用户能看到的服务端报错和 `scenes.json`。
> 状态：**第 1 批（含品牌标语和 0.5 的门禁项）已改并提交**，其余批次仍是审阅稿。分支 `dev/pc-ui-copy`。规则依据 `.claude/skills/ui-copy/` 和 AGENTS.md §8「UI 文案」。
> 读法：每批先看主表（位置｜原文｜改为｜依据）。每批末尾有四节：「叫法变动」「测试会受影响的」「需要核实或连带改行为」「存疑」。最需要你拍板的内容已在本页开头汇总。

## 0.1 数量

| 批次 | 范围 | 主表行数（约） |
|---|---|---|
| 1 | 外壳、首页新旧两版、全站报错弹窗、品牌标语 | 40 + 11 |
| 2 | 项目、/create、灵感 / 模板 | 93 |
| 3 | AI 视频、AI 图片、scenes.json | 131 |
| 4A | 画布工作台（不含助手） | 257 |
| 4B | 画布里的创作助手 | 155 |
| 5 | 短剧导演台 | 229 |
| 6 | 资产、发行、名片、授权 | 207 |
| 7 | 我的、企业、邀请、登录、服务端报错 | 86 + 79 |

各批由不同的人分头整理。跨批的同一个叫法已按 0.3 统一；某一批里的写法和 0.3 不一致时，以 0.3 为准。

## 0.2 品牌标语（2026-11-03 已定）

用户决定：已定稿的标语不好也要改，「让灵感成形，让 IP 出圈」有 AI 味，两个「让」叠成排比，「出圈」是营销词。

- 主标语：**一个 IP，无限可能**
- 副标题（需要时才放）：**制作形象、图片、视频和短剧。** 只写能做什么，不再重复愿景。
- 品牌位：「IP Studio · 声量引擎旗下」保持不变。「声量引擎」只出现在品牌位。

| 位置 | 原文 | 改为 |
|---|---|---|
| `components/landing/ip-home.tsx:127` 新版首页 h1 | `<span>声量引擎</span>，让灵感成形，让 IP 出圈` | 一个 IP，无限可能 |
| `components/landing/ip-home.tsx:157` 新版页脚 | 让灵感成形，让 IP 出圈。 | 一个 IP，无限可能。 |
| `components/landing/ip-home-classic.tsx:96` 旧版首屏 h1 | 让灵感成形`<br />`让 IP 出圈 | 一个 IP，无限可能 |
| `ip-home-classic.tsx:97` 旧版副标题 | 从一个灵感开始，创造数字人、图片、视频与故事。…让你的 IP 拥有形象、声音与作品。 | 制作形象、图片、视频和短剧。 |
| `ip-home-classic.tsx:100` 首屏小字 | 一个角色，无限可能 | 删除，避免同一屏出现两次 |
| `ip-home-classic.tsx:119` 旧版页脚 | 让灵感成形，让 IP 出圈。 | 一个 IP，无限可能。 |
| `app/layout.tsx:43` description | 让灵感成形，让 IP 出圈。从一个灵感开始，创造数字人、图片、视频与故事。 | 一个 IP，无限可能。制作形象、图片、视频和短剧。 |
| `app/invite/[code]/page.tsx:7` description | 让灵感成形，让 IP 出圈。验证手机号，加入 IP Studio。 | 一个 IP，无限可能。验证手机号，加入 IP Studio。 |
| `ip/invitation-registration.tsx:98` h1 | 让灵感成形`<br/>`让 IP 出圈`<span className="period">。</span>` | 一个 IP，无限可能`<span className="period">。</span>` |
| `ip/invitation-registration.tsx:122` 页脚 | 让灵感成形，让 IP 出圈。 | 一个 IP，无限可能。 |
| `ip/enterprise-invitation-landing.tsx:182` 页脚 | 让灵感成形，让 IP 出圈。 | 一个 IP，无限可能。 |
| `shell/ip-navigation.tsx:21–22` | 让想象力创造更大的世界 / 从一个灵感开始 | 不改。这个文件没有任何地方引用，是死代码，记进 TODO。 |

同步改的地方：
- **测试**：`components/landing/ip-home.test.tsx:103–109` 现在断言 h1 里有「声量引擎」。改成断言页面有且只有一个 level 1 标题，并且品牌位链接的 aria-label 带「声量引擎旗下」，不再断言标语文字。用例名和注释一起改。
- **样式**：新版 h1 原来用 `<span>` 单独给「声量引擎」上色，去掉 span 后要看一眼 `.home-hero h1 span` 的规则是否还被别处用到。两句标题都要在 1440 和 1280 宽下看换行。
- **规则已同步改（2026-11-03）**：AGENTS.md §8「不是翻译腔」那一段、ui-copy 的 SKILL.md「标题和导航」和「不动的」、references/examples.md「首页和营销位」，都写明标语也按这套规则审视，并加了这次的改写对照。
- 历史记录（`docs/VERSION_HISTORY.md:4903` 等）保留原样，不改。

## 0.3 跨批统一的叫法（改动时全仓同步）

| 现在的几种说法 | 统一为 | 涉及批次 |
|---|---|---|
| 正在读取 X… / 暂时读不到 / 没读出来 / 重新读取 / 重试读取 | 正在加载 X… / X 加载失败，请稍后刷新重试。/ 重试 | 全部 |
| 可以再点一次 / 复制后发给我们 | 请重试。多次失败时，可复制「错误详情」反馈给我们。 | 1、2、全部报错 |
| 回到 X / 回 X / 回资产货架 | 返回 X / 返回资产 | 2、3、5、6 |
| 在画布上看 / 去画布看 | **在画布上查看**（回复下面的按钮已经这么叫；第 3 批写的「在画布中查看」改用这个） | 3、4B |
| 新建创作 / 开始创作（新建画布那个按钮） | 新建画布 | 2 |
| 另存一份 / · 另一份 | 另存为新画布 / · 副本（场景页草稿也跟着改） | 3、4A |
| 生成时的描述 / 生成指令 / 本次生成提示词 | 提示词。导演台的「出图提示词」另有一处存疑，见第 5 批。 | 2、5、6 |
| 可选 / 有就写 / 不写也行 | 选填 | 3、4B |
| 保存画布模板 / 存为官方内容 | 保存为模板 / 保存为官方内容 | 2、4A |
| 放入画布 | 放进画布（AGENTS.md 里的叫法） | 4B |
| 在途 | 进行中 | 4A、7 |
| 个人钱包 | 个人积分 | 7 |
| 出图 / 出片 / 拍（按钮和状态里） | 生成图片 / 生成视频。「成片」作名词保留。 | 全部 |

## 0.4 改文字之前要先决定的事（各批「需要核实」里最要紧的）

这些地方文字和产品真实行为对不上。只改文字改不对，要么改行为，要么你确认按现状写。

1. **公开名片显示写死的演示内容**（第 6 批 #1）：固定图片、「想聊门店线上化……」，还有「真人复刻 · 本人授权」，对 AI 原创形象也照样显示。这是事实错误，建议优先处理。
2. **冻结上限当价格显示**（第 5 批 #1、第 4B 批 #2、第 4A 批 #3）：导演台助手「每轮最多 N 积分」（`director-assistant.tsx:789/980`）、`director-brief.tsx:149/167`、技能草稿确认弹窗、按秒计费配音的「预冻结 X 积分」。按规则应写「按实际用量结算」。
3. **「视频任务没建齐，请稍后再试」可能导致重复扣费**（第 7 批）：出这句话时，已有一部分视频任务建好并冻结了积分，用户照提示再点一次，会把整批重新提交。要先改行为。
4. **余额不足提示被正则读取**（第 7 批）：`StudioPaymentMessage` 用正则匹配 `CreditService` 那句「积分余额不足…」。只改文字会让匹配失效，必须两边一起改。
5. **「交给创作助手」写「确认后才扣积分」不对**（第 3 批 #1）：跳到画布后会自动发出第一句，这一轮对话按用量计费。
6. **删除片段的确认框没提视频**（第 5 批 #2）：服务端会连视频一起删，不能撤销，也不检查有没有正在生成的视频。
7. **灰按钮只在悬停里写原因**（第 3、4B、5 批，共 6 处左右）：规则要求按钮能点、点了说原因，或者把原因写在旁边。前一种要改交互。
8. **技能胶囊的悬停说明过时**（第 4B 批 #1）：它写「有制作在进行时保持不变」，而 10-23 起制作中也会换方法。
9. **开通的产品名四种叫法并存**（第 7 批叫法变动 1）：「数字资产 / 数字资产产品 / 数字资产平台 / 数字人资产平台」，需要你定一个名字，可选「IP Studio」或「数字资产」。
10. **时间格式不合 §4.8**：公开分享页、企业页、邀请页用 `toLocaleString` 自己拼时间，要改代码用 `formatDateTime()`。
11. **AGENTS.md 声音样本限制过时**（第 5 批 #8）：AGENTS.md 写 2–15 秒、15 MiB，代码和界面是至少 2 秒、最大 25 MB。要改的是 AGENTS.md。
12. **H3「优化另需少量积分」与规则冲突**（第 4A 批存疑）：AGENTS.md 定的是这句，ui-copy 规则要求写「按实际用量结算」。你定哪个，我同步改另一边。

## 0.5 门禁要求必须改的手机端文字

§9「1b」门禁扫的是全部前端，手机专用的页面也算。下面两处虽然只在手机上出现，也必须改。写法直接用主仓库里还没提交的那版：
- `app/me/page.tsx:192` 原文「画布和场景草稿，接着做」，改为「画布与场景草稿，可继续编辑」
- `ip/canvas-gate.tsx:133` 原文「或者发到电脑上接着做」，改为「或发送到电脑上继续编辑」

主仓库里另外 3 处未提交的改动（`studio-projects.tsx:73/75`、`studio-workspace.tsx:1119`、`cards/[id]/edit/page.tsx:486`），已经分别收进第 2、4A、6 批，两边写法一致或接近。

## 0.6 不在范围内、要你决定改不改

- **`src/canvas/locales/zh-CN.ts`**（vendored 画布）
  - 「加载中... / 正在打开画布...」用了三个英文句点，应为「…」。
  - 「松开即可添加参考图」等 4 处用了「即可」。
  - 第 295、300 行有破折号和口语。
  - WebDAV 设置里的「目录」可改为「文件夹」。
  - 插件脚本说明（43/44/52 行）写给开发者看，不改。
- **`src/proto/`**（旧手机端，约 25 处）
  - 破折号、「即可」、感叹号。
  - 「正在出片」「正在出图…」。
  - `proto/api.ts:926` 的相对时间「昨天 15:30」。
  - 「约 15 秒即可生成第一版形象」里的「15 秒」要核实是否属实。
- **没有挂到任何页面上的文件**：`StudioSceneWorkshop`、`CreateCenter`、`atlas.tsx`、`saved-canvas-assets.tsx`、`shell/ip-navigation.tsx`。建议删文件或记进 TODO，不改文案。

---

# 第 1 批 · 外壳、首页新旧两版、全站报错弹窗（已改，2026-11-03）

另外随这一批改了：品牌标语（见 0.2）、0.5 列出的 7 处门禁命中（含 web-drama 两处，写法照主仓库未提交的那版），场景浮层「正在读取场景…」改为「正在加载场景…」，钱包悬停「点击查看积分」改为「点击查看明细」；去掉了不再用到的 `.home-hero h1 span` 和 `.ip-home-hero-note` 样式。

## 外壳与首页

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `components/landing/ip-home.tsx:140` | 按目标选一个场景，直接开始 | 按目标选择场景 | 说明简洁 |
| `ip-home.tsx:141` aria | 向左看更多场景 / 向右看更多场景 | 上一组场景 / 下一组场景 | 标准叫法 |
| `ip-home.tsx:149` | 点开先看画布，喜欢就做同款 | 预览画布后可做同款 | 去口语 |
| `ip-home.tsx:151` | 正在读取灵感… | 正在加载灵感… | 统一用「加载」 |
| `ip-home.tsx:152` | 灵感暂时没读出来，稍后刷新再看。 | 灵感加载失败，请稍后刷新重试。 | 书面报错 |
| `ip-home.tsx:154` | 这一类还没有内容，先看看别的分类。 | 此分类暂无内容。 | 空态 |
| `ip-home.tsx:98`、`ip-home-classic.tsx:73` 弹窗标题 | 用这句话新建画布没有完成 | 开始对话没有完成 | 标题用按钮上的动作 |
| 同上，下一步 | 输入的内容还在框里，可以再点一次「开始对话」。 | 输入的内容已保留，请再次点击「开始对话」。 | 去口语 |
| `ip-home.tsx:73/113`、`ip-home-classic.tsx:52/88` | 可以再点一次；反复失败的话展开「错误详情」复制后发给我们。 | 请重试。多次失败时，可复制「错误详情」反馈给我们。 | 去口语 |
| `ip/studio-conversation-start.tsx:45` 占位 | 说说你的想法，比如：照这条视频的拍法，把商品换成我的保温杯 | 描述你想做的内容，例如：参照这条视频的拍法，把商品换成我的保温杯 | 占位给例子 |
| `studio-conversation-start.tsx:49` | 先写一句想做什么 | 请先输入想做的内容 | 去口语 |
| 同上 | 继续保存刚才的想法并打开画布 | 继续保存并打开画布 | 简洁 |
| `studio-conversation-start.tsx:53`（旧版） | 助手每轮回复按实际用量扣少量积分；出图、出片先报价，你确认了才开始。还没想好？逛逛灵感或专项创作 | 助手回复按实际用量扣除积分；生成图片和视频前会先报价，确认后开始。也可浏览「灵感」或「专项创作」。 | 「少量」无法保证；去口语 |
| `ip-home-classic.tsx:21–24` 四张卡 | 找到角色的样子，延展视角与表情 / 角色写真、场景设计，让灵感成形 / 让 IP 动起来，讲述新的故事 / 从故事与剧本，走向分镜和成片 | 设计角色形象，生成多视角与表情 / 角色写真与场景设计 / 由图片或文字生成视频片段 / 从剧本到分镜与成片 | 「让……」排比；写真实能力 |
| `ip-home-classic.tsx:27–29` 示意卡 | 让想象更温柔 / 创造属于你的故事 / 让角色真正活起来 | 日常写真与场景 / 世界观与人物设定 / 从形象延伸到短剧 | 排比、空话 |
| `ip-home-classic.tsx:110` | 你的灵感，留在每一张画布里 | 最近编辑的画布 | 功能区不用营销腔 |
| `ip-home-classic.tsx:111` | 正在读取近期画布… / 还没有个人画布。从一个角色或一个故事开始吧。 | 正在加载近期画布… / 还没有个人画布。（「创建空白画布」按钮保留） | 统一用「加载」；空态 |
| `ip-home-classic.tsx:62` | 近期画布未读取 | 近期画布加载失败 | 报错写清结果 |
| `ip-home-classic.tsx:114` | 探索角色、世界与故事的更多可能 · 创作示意 | 角色、世界观与故事示例 · 创作示意 | 空话 |
| `shell/account-workspace.tsx:44` | 回到项目 | 返回项目 | 标准叫法 |
| `shell/rail-scene-flyout.tsx:70` | 场景暂时读不到，点「AI 视频」进页面看 | 场景加载失败，可点击「AI 视频」进入页面查看 | 书面报错 |
| `shell/wallet-badge.tsx:22` | {企业}分给你的企业积分，不含冻结积分。生成时可以选用；点击查看企业 | {企业} 分配给你的企业积分（不含冻结积分），生成时可选用。点击查看企业 | 书面；中英之间加空格 |

## 全站报错弹窗 `ip/studio-errors.tsx`

| 行 | 原文 | 改为 |
|---|---|---|
| 239 | 这项内容刚在别处改过，页面已经刷新到最新内容，不用再手动刷新。 / …刷新页面看一下最新内容。 | 此内容已在其他地方修改，页面已更新为最新内容。 / …请刷新页面查看最新内容。 |
| 243 | 需要的话重新修改后再试。 | 如有需要，请修改后重试。 |
| 244 | 价格有变化，刷新页面后重新确认。 | 价格已更新，请刷新页面后重新确认。 |
| 245 | 本次用量还在核对，请先查看原任务状态，需要协助时把错误详情发给我们。 | 本次用量正在核对，请先查看原任务状态。如需协助，可复制「错误详情」反馈给我们。 |
| 246 | 换一个仍可用的视频模型后再生成。 | 请更换可用的视频模型后重新生成。 |
| 247 | 按上面的原因检查生成描述和参考素材，调整后再生成；没有指出具体内容时，把错误详情发给我们核查。 | 请根据上述原因检查描述和参考素材，调整后重新生成。原因不明确时，可复制「错误详情」反馈给我们。 |
| 249 | 按上面的原因处理；原因不明确或反复出现时，展开「错误详情」复制后发给我们。 | 请根据上述原因处理。原因不明确或多次出现时，可复制「错误详情」反馈给我们。 |
| 250 | 这项内容已经不在了，可能在别处删掉了。刷新页面看一下最新内容，不用再重试。 | 此内容已不存在，可能已在其他地方删除。请刷新页面查看最新内容。 |
| 251 | 等正在进行的那一项完成后再试。 | 请等待进行中的操作完成后重试。 |
| 252 | 检查网络后刷新页面，看一下这次操作有没有生效，再决定要不要重试。 | 请检查网络并刷新页面，确认操作是否已生效后再决定是否重试。 |
| 253 | 按上面的积分钱包提示处理后再试。 | 请按上述积分提示处理后重试。 |
| 254 | 可以稍后再试一次；反复出现的话，展开「错误详情」复制后发给我们。 | 请稍后重试。多次失败时，可复制「错误详情」反馈给我们。 |
| 280 | 网络连接中断，没收到服务器的回应。 | 网络连接中断，未收到服务器响应。 |
| 213 | 复制未完成，请选中上方文字复制。 | 复制失败，请选中上方文字手动复制。 |

同步位置：`components/hub/studio-home.tsx:47/60/72` 里有同一句报错说明，一起改。没有测试断言这些文字。


---

# 第二批：项目、画布·自由创作（/create）、灵感 / 模板

读过的文件（行号以当前工作区源码为准；「条」= 带中文的界面字符串大致条数）：

- `ip/studio-projects.tsx`（125 行，约 58 条）
- `ip/project-card-preview.tsx`（2 条）、`ip/project-preview.ts`（10 条，节点类型兜底名，无问题）
- `ip/project-history.tsx`（约 26 条，画布「⋯ → 历史记录」）
- `ip/canvas-cover-editor.tsx`（10 条）、`ip/canvas-cover-api.ts`（2 条，只在 mock 分支抛，不列）
- `ip/canvas-thumb.tsx`（2 条，无问题）
- `ip/studio-create-home.tsx`（11 条）、`ip/studio-create-tools.ts`（9 条）、`ip/studio-entry.ts`（32 条；标题在 /create 显示，描述只在手机首页显示）、`ip/use-start-new-canvas.ts`（1 条）
- `ip/studio-template-market.tsx`（28 条）、`ip/studio-template-library.tsx`（14 条）、`ip/studio-template-preview.tsx`（11 条）、`ip/studio-template-publish.tsx`（14 条）、`ip/studio-template-source.tsx`（56 条，画布「⋯ → 模板 vN · 制作计划」）、`ip/studio-template-use.tsx`（3 条）
- `ip/studio-gallery.tsx`（11 条）
- `ip/studio-scene-workshop.tsx`（16 条）、`ip/studio-scenes.ts`（8 条）：**没有挂载**（`/scenes` 已改成跳 `/video`，全仓没有地方引用 `StudioSceneWorkshop`），不列
- `app/projects/page.tsx`、`app/projects/[id]/page.tsx`（无文案）、`app/projects/demos/page.tsx`（约 55 条，官方内容管理）
- `app/create/page.tsx`、`app/templates/page.tsx`、`app/scenes/page.tsx`（只做跳转，无文案）
- `app/market/[id]/page.tsx`（19 条）、`app/stars/[id]/page.tsx`（23 条）
- `components/hub/discover.tsx`（10 条）：`/discover` 桌面可从账号菜单「发现」进入，`/market/*`、`/stars/*` 从发现页和资产页进入，所以这三页按 PC 可见处理
- `components/hub/create-center.tsx`（17 条）：**没有挂载**（`CreateCenter` 全仓无引用），不列
- `components/landing/atlas.tsx`（12 条，只有图片 alt 文字，且整个文件无引用），不列

---

## 项目页（/projects）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-projects.tsx:73`、`:75` | 每张画布都在这里，点开接着做 | 每张画布都在这里，点开可继续编辑 | 去「接着做」；examples.md 原样对照 |
| `ip/studio-projects.tsx:75` | 新建创作 | 新建画布 | 这个按钮就是新建一张画布（`startNewCanvas()`），与 /create 的「新建画布」卡片、空态按钮同名；见「叫法变动」 |
| `ip/studio-projects.tsx:76` | · 新画布没有创建成功，可以再点一次「新建创作」。 | · 新画布没有创建成功，请重试。 | 不写「再点一次」；与第一批报错下一步统一 |
| `ip/studio-projects.tsx:85` | 正在读取画布… | 正在加载画布… | 加载中统一「正在加载 X…」 |
| `ip/studio-projects.tsx:85` | 暂时无法读取画布 | 画布加载失败 | 加载失败统一写法（下方 GalleryState 已给原因和「重新加载」，这一行只做计数提示，不必再带下一步） |
| `ip/studio-projects.tsx:87` | 从第一张画布开始 | 还没有画布 | 空态「还没有 X」 |
| `ip/studio-projects.tsx:87` | 开始一次创作，画布会保存在这里。 | 新建的画布会保存在这里。 | 简洁书面，和按钮对上 |
| `ip/studio-projects.tsx:87` | 换个关键词，或清除当前筛选。 | 请更换关键词，或清除筛选。 | 去口语「换个」 |
| `ip/studio-projects.tsx:87` | 开始创作（空态按钮，调 `newCanvas.start()`） | 新建画布 | 空态给页面已有的那个动作，叫法与右上角一致 |
| `ip/studio-projects.tsx:95`、`ip/project-card-preview.tsx:19` | 正在读取内容… | 正在加载内容… | 加载中统一 |
| `ip/studio-projects.tsx:31` | 回到 AI 视频继续 / 回到 AI 图片继续 | 在 AI 视频中编辑 / 在 AI 图片中编辑 | 用户在项目页并不是从那里来的，「回到…继续」不成立；写清去哪、做什么（若坚持返回类叫法见「存疑」） |
| `ip/studio-projects.tsx:121` | 删除画布（确认弹窗标题） | 删除这张画布？ | 确认弹窗标题写要做的事，问句 |
| `ip/studio-projects.tsx:122` | 确认删除「{name}」？画布内的节点和连线将一并删除，此操作无法撤销。 | 「{name}」中的节点和连线将一并删除，删除后无法恢复。 | 标题已问过，正文只说后果；服务端是软删除但没有任何恢复入口，「无法恢复」属实 |
| `ip/studio-projects.tsx:122` | 确认删除 | 删除 | 危险操作按钮写具体动作（若保留「确认删除」也可，见测试小节） |

## 画布「⋯ → 历史记录」

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/project-history.tsx:55` | 图片已放回画布，但尚未保存，请先重试保存 | 图片已添加到画布，但尚未保存，请重试保存。 | 去「先」；「放回」口语 |
| `ip/project-history.tsx:59` | 当前画布会先保存，可在历史记录里找回。 | 恢复前将保存当前画布，之后可在历史记录中找回。 | 去「先」，书面 |
| `ip/project-history.tsx:63` | 当前画布尚未保存，请先处理保存问题 | 当前画布尚未保存，请保存后重试。 | 「处理保存问题」空泛，说清下一步 |
| `ip/project-history.tsx:84` | 已保存到资产，可在顶部「资产」页查看 | 已保存到资产，可在「资产」页查看。 | 信：新版导航在左侧，不在顶部 |
| `ip/project-history.tsx:94` | 保留最近 50 个内容版本。版本记录从此次更新开始，之前的成图和指令可在「生成记录」找回。 | 保留最近 50 个画布版本。更早的生成图片和指令可在「生成记录」中找回。 | 「从此次更新开始」是发布说明口吻；服务端确实只留 50 个（`IpProjectService.java:218`） |

## 设置封面（项目页、灵感页共用）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/canvas-cover-editor.tsx:30` | 上传一张封面，或从画布中选择图片。恢复自动后，优先显示已有图片，没有图片则显示画布缩略图。 | 上传封面，或从画布中选择图片。恢复自动封面后，优先显示画布中的图片；没有图片时显示画布里的文字内容。 | 信：2026-10-30 起无图时显示正文摘录 / 步骤 / 「空白画布」（`project-card-preview.tsx` 的 `ProjectWordsCover`），不再画缩略图 |
| `ip/canvas-cover-editor.tsx:35` | 正在读取画布图片… | 正在加载画布图片… | 加载中统一 |
| `ip/canvas-cover-editor.tsx:36` | 重试读取 | 重试 | 标准叫法 |
| `ip/canvas-cover-editor.tsx:38` | 选择图片即可保存 | 选择图片后自动保存 | 去「即可」；说清点了图就保存 |

## 画布·自由创作（/create）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-create-home.tsx:23` | 一张空白画布，打开就有助手，直接开始。 | 新建空白画布，并打开创作助手。 | 去口语；说清点了会发生什么（进 `?start=assistant`） |
| `ip/studio-create-home.tsx:71` | · 新画布没有创建成功，可以再点一次「新建画布」。 | · 新画布没有创建成功，请重试。 | 同项目页 |
| `ip/studio-create-home.tsx:89` | 官方模板正在准备中。你可以先新建一张画布。 | 暂无官方模板。 | 空态「暂无 X」；去「先」；上方已有「新建画布」卡片，不必再提 |

## 灵感 / 模板（/templates）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-template-market.tsx:57` | 模板目录（aria-label） | 模板列表 | 「目录」是开发词 |
| `ip/studio-template-market.tsx:59` | 正在读取内容… | 正在加载内容… | 加载中统一 |
| `ip/studio-template-market.tsx:59` | 暂时无法读取内容 | 内容加载失败 | 加载失败统一（下方 GalleryState 另给原因和「重新加载」） |
| `ip/studio-template-market.tsx:64` | 精选案例正在准备中 | 暂无精选案例 | 空态统一 |
| `ip/studio-template-market.tsx:64` | 换个关键词，再看看。 | 请更换关键词后重试。 | 去「再看看」 |
| `ip/studio-template-market.tsx:64` | 在个人画布中选择“发布为模板”，以后就可以从同一流程开始创作。 | 在画布右上角「⋯」中选择「保存为模板」，之后可从同一流程开始创作。 | 信：实际菜单项叫「保存为模板」（`canvas-host.tsx:142`）；用「」不用“”；去「就」 |
| `ip/studio-template-market.tsx:64` | 可以先从空白画布开始创作。 | 可新建画布开始创作。 | 去「先」 |
| `ip/studio-template-market.tsx:64` | 去创作（链接到 /create） | 开始创作 | 与同页右上角「开始创作」（同一链接）同名，去「去」 |

## 画布内「模板」弹窗 / 模板只读预览

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-template-library.tsx:26` | 打开查看完整画布和成品素材。需要继续创作时，点「做同款」。 | 打开后可查看完整画布和成品素材。点击「做同款」可复制到自己的画布。 | 写点击统一「点击「X」」；说清做同款的结果（建个人副本） |
| `ip/studio-template-library.tsx:28` | 正在读取模板（Spin aria-label） | 正在加载模板 | 加载中统一 |
| `ip/studio-template-library.tsx:28` | 还没有个人模板，可以在画布顶部保存。 | 还没有个人模板。可在画布右上角「⋯」中选择「保存为模板」。 | 信：入口在「⋯」菜单里，不是顶栏 |
| `ip/studio-template-library.tsx:28` | 当前没有可用的官方模板。 | 暂无官方模板。 | 空态统一 |
| `ip/studio-template-use.tsx:52` | 正在读取模板… | 正在加载模板… | 加载中统一 |
| `ip/studio-template-preview.tsx:46` | 此节点等待填写内容或添加参考素材。 | 此节点尚未填写内容或添加参考素材。 | 只读预览里「等待填写」像在催用户，写状态 |

## 保存为模板（画布「⋯ → 保存为模板 / 存为官方内容」）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-template-publish.tsx:35` | 保存画布模板 | 保存为模板 | 弹窗标题与打开它的菜单项同名 |
| `ip/studio-template-publish.tsx:36` | 保存完整画布 | 保存模板 | 按钮写动作 + 对象；和标题对上（「完整」放在说明里） |
| `ip/studio-template-publish.tsx:38` | 保留全部节点、文字、连线和已生成的图片、视频。别人打开后就能看到这张画布。 | 将保留全部节点、文字、连线及已生成的图片和视频。 | 信：默认「仅自己」可见，「别人打开后就能看到」不成立；谁能看由下面的选项说明 |
| `ip/studio-template-publish.tsx:32` | 已保存完整画布：{n} 个节点。{所有用户 / 你}可以从画布模板中查看。 | 已保存为模板（{n} 个节点）。{所有用户 / 你}可在「模板」中查看。 | 与按钮叫法一致；「可以从…查看」口语。入口：画布左栏「模板」、/templates |
| `ip/studio-template-publish.tsx:42` | 谁可以看到 | 可见范围 | 表单标签用名词；服务端报错也叫「可见范围」（`StudioTemplateService.java:58`） |

## 模板制作计划（画布「⋯ → 模板 vN · 制作计划」）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-template-source.tsx:21` | 可以生成 / 正在生成 / 生成失败 / 来源已改变 | 待生成 / 生成中 / 失败 / 来源已变更 | 状态用标准词 |
| `ip/studio-template-source.tsx:42` | 当前模型或价格不可用，请检查平台配置 | 当前模型或价格不可用，请稍后重试或联系平台处理。 | 用户没有平台配置权限，别让他去做不该他做的事 |
| `ip/studio-template-source.tsx:42` | 请先完成前序步骤或采用主形象 | 请完成前序步骤或采用主形象后重试。 | 去「先」 |
| `ip/studio-template-source.tsx:53` | 画布锁定此版本。按步骤生成，每次确认费用；需要采用确认的上游结果未采用前，下游不会执行。刷新会找回原任务。 | 此画布已锁定该模板版本。按步骤生成，每步单独确认费用；上游结果采用前，依赖它的步骤不会执行。刷新可找回已提交的任务。 | 读得懂的书面语，去「上游 / 下游」并列堆叠 |
| `ip/studio-template-source.tsx:54` | 我套用这个版本：{n} 个画布，{n} 个已完成；已消费 {n} 积分，冻结 {n}；采用 {n} 个结果，首轮采用 {n} 个，失败任务 {n} 个。 | 已使用此版本：{n} 张画布，{n} 张已完成；已消费 {n} 积分，冻结 {n} 积分；采用 {n} 个结果，其中首次即采用 {n} 个；失败任务 {n} 个。 | 「冻结」后缺单位；画布量词统一「张」；「首轮采用」看不懂 |
| `ip/studio-template-source.tsx:59` | 这是一张人物设定图，可整张作为角色参考。拍摄新画面时指定所需视角；图生视频先生成单独的镜头画面。 | 这是一张人物设定图，可整张作为角色参考。生成新画面时请指定视角；图生视频前，请生成单独的镜头画面。 | 「拍摄」→「生成」；去「先」 |
| `ip/studio-template-source.tsx:62` | 原产物保留；只重做此步骤，不会自动重跑其他步骤。 | 原结果将保留。重新生成只针对此步骤，不会自动重新生成其他步骤。 | 「产物 / 重跑」是开发词 |
| `ip/studio-template-source.tsx:64` | 只重做此步骤 / 生成此步骤（后接 · {n} 积分） | 重新生成 / 生成（后接 · {n} 积分） | 按钮标准叫法；「此步骤」由所在卡片说明 |
| `ip/studio-template-source.tsx:65` | 撤回采用确认 | 取消采用 | 标准叫法 |
| `ip/studio-template-source.tsx:69` | 完整输出 / 部分输出 | 完整资产包 / 部分资产包 | 「输出」是开发词，且与 `:73` 说明里的叫法统一 |
| `ip/studio-template-source.tsx:73` | 使用已采用的图片。中文由排版服务绘制；保留每张原图及来源清单。未包含全部输出时明确标为部分资产包。 | 使用已采用的图片排版，并附每张原图及来源清单。未包含全部图片时，将标注为部分资产包。 | 「排版服务绘制中文」是实现细节 |
| `ip/studio-template-source.tsx:77` | 确认只重做此步骤（弹窗标题） | 确认重新生成 | 与按钮一致 |
| `ip/studio-template-source.tsx:77` | 确认 {cost} 积分并提交 | 确认生成 · {cost} 积分 | examples.md「确认生成 · 600 积分」 |
| `ip/studio-template-source.tsx:78` | 保留原产物；依赖它的结果会显示来源已改变。 | 原结果将保留；依赖它的步骤将显示「来源已变更」。 | 去开发词，与状态名对上 |
| `ip/studio-template-source.tsx:79` | 已提交的指令保持不变，再次点击会恢复原请求。 | 已提交的指令不可修改，再次点击将恢复原请求。 | 说清为什么输入框不能改 |
| `ip/studio-template-source.tsx:79` | 可调整本次创作指令，模板原版本不变。引用仍按配方锁定。 | 可修改本次创作指令，不影响模板。参考素材按模板设定锁定。 | 「配方 / 引用」是内部词 |
| `ip/studio-template-source.tsx:82` | 可新建 IP 或明确更新所选人物主形象。 | 可新建 IP，或更新所选人物的主形象。 | 「明确更新」生硬 |

## 官方内容管理（/projects/demos，运营可见）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `app/projects/demos/page.tsx:60` | 没加载出来，刷新页面再试 | 官方内容加载失败，请稍后刷新重试。 | 加载失败统一 |
| `app/projects/demos/page.tsx:78` | 「{name}」已下线，用户看不到了 | 「{name}」已下线 | 口语；后果在页首说明里已写 |
| `app/projects/demos/page.tsx:81`、`:102`、`:125` | 没成功，再试一次 / 没存上，再试一次 / 没删掉，再试一次（`reportStudioError` 的 fallback，即弹窗「原因」） | 删掉这三个 `fallback`，用默认的「操作未完成，请重试」 | 原因栏写「再试一次」不是原因；标题已写哪个操作没完成 |
| `app/projects/demos/page.tsx:119` | 「{name}」已删除，但有 {n} 个素材没清掉，要运维去存储里手动删 | 「{name}」已删除，{n} 个素材未能清理，需运维在存储中手动删除。 | 去口语 |
| `app/projects/demos/page.tsx:136` | 这一页只有平台运营能看。 | 此页面仅平台运营可访问。 | 书面 |
| `app/projects/demos/page.tsx:136` | 回到项目 | 返回项目 | 返回类按钮统一 |
| `app/projects/demos/page.tsx:153` | 还没发过官方内容。 | 还没有官方内容。 | 空态统一 |
| `app/projects/demos/page.tsx:153` | 在画布顶栏选择「存为官方内容」，发布后就会出现在这里。 | 在画布右上角「⋯」中选择「存为官方内容」，发布后将显示在这里。 | 信：入口在「⋯」菜单；去「就」 |
| `app/projects/demos/page.tsx:173`、`:178` | 名字 / 别人看到的名字（占位） | 名称 / 用户看到的名称 | 表单书面词 |
| `app/projects/demos/page.tsx:186` | 选填。写清楚这套工作流能做出什么 | 选填，例如：一张照片生成多角度人物设定图 | 占位给例子 |
| `app/projects/demos/page.tsx:189` | 数字小的排前面，一样大的按发布时间 | 数字越小越靠前，相同时按发布时间排序 | 书面；与 `findBy…OrderBySortOrderAscCreatedAtAsc` 一致 |
| `app/projects/demos/page.tsx:202` | 删除「{name}」（弹窗标题） | 删除「{name}」？ | 确认弹窗标题用问句 |
| `app/projects/demos/page.tsx:211`–`:215` | 这条内容和它那份素材副本（{n} 个）会一起删掉，<b>不可恢复</b>。<br/>已经拿它建过画布的用户不受影响 —— 那些是各自复制的一份。<br/>只是想让别人看不到的话，<b>下线</b>就够了，随时能再打开。 | 此内容及其 {n} 个素材副本将一并删除，<b>无法恢复</b>。<br/>已用它创建的用户画布不受影响。<br/>如只需对用户隐藏，可选择<b>下线</b>，之后可随时重新上线。 | 去「——」和口语 |
| `app/projects/demos/page.tsx:248` | （没写说明） | 暂无说明 | 空态统一 |
| `app/projects/demos/page.tsx:255` | 删除（连素材，不可恢复）（按钮 title / aria-label） | 删除 | 后果在确认弹窗里写，按钮只写动作 |

## 发现 / 官方资产 / 明星形象（桌面从账号菜单「发现」进入，沿用手机版布局）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `components/hub/discover.tsx:33` | 授权后可用于出片 | 授权后可用于生成视频 | 不用「出片」 |
| `components/hub/discover.tsx:35` | 官方资产加载中 | 正在加载官方资产… | 加载中统一 |
| `components/hub/discover.tsx:42` | 暂时还没有上架的官方角色 | 暂无上架的官方角色。 | 空态统一 |
| `components/hub/discover.tsx:63` | 去申请明星形象授权 | 申请明星形象授权 | 去「去」 |
| `components/hub/discover.tsx:65` | 明星本人与团队在带货端审批，通过后形象会出现在你的资产里 | 由明星本人及团队在 AI 明星带货审批，通过后形象将显示在你的资产中。 | 「带货端」是内部说法 |
| `app/market/[id]/page.tsx:43`、`app/stars/[id]/page.tsx:48` | 回资产货架 | 返回资产 | 返回类按钮统一；导航叫「资产」，「货架」是旧叫法（`app/assets/[id]/page.tsx:188` 同词，属资产批次） |
| `app/market/[id]/page.tsx:43` | 没有找到这个官方资产 | 未找到该官方资产。 | 书面 |
| `app/stars/[id]/page.tsx:48` | 没有找到这条明星授权 | 未找到该明星授权。 | 书面 |
| `app/market/[id]/page.tsx:111` | 适合用来做什么 | 适用场景 | 标题用名词 |
| `app/market/[id]/page.tsx:126` | 授权档位与在线付费正在建设。需要用这个角色出片，先联系客户经理线下开通。 | 在线授权与付费暂未开放。如需使用此角色生成视频，请联系客户经理开通。 | 去「出片」「先」 |
| `app/market/[id]/page.tsx:136` | 授权功能还在建设中，暂时无法在线下单。可以先联系客户经理开通。 | 在线授权暂未开放，请联系客户经理开通。 | 去口语、去「先」 |
| `app/market/[id]/page.tsx:143` | 明星形象的授权申请与审批在「明星工作台」完成，不在这里下单。 | 明星形象的授权申请与审批在 AI 明星带货与「明星工作台」中完成。 | 去口语；与发现页、明星形象页的说法一致 |
| `app/stars/[id]/page.tsx:123` | 去带货创作（AI 明星带货） | 前往 AI 明星带货 | 去「去」；括号补充改成直接写目的地 |
| `app/stars/[id]/page.tsx:130` | 申请已提交，等待明星团队在明星工作台审批。通过后这里会显示可用场景与有效期。 | 申请已提交，等待明星团队审批。审批通过后将显示可用场景与有效期。 | 去口语 |
| `app/stars/[id]/page.tsx:131` | 授权已到期。要继续使用，请到 AI 明星带货里重新发起授权申请。 | 授权已到期。如需继续使用，请在 AI 明星带货重新申请授权。 | 书面 |
| `app/stars/[id]/page.tsx:138`–`:140` | 明星授权的申请与审批在带货线和「明星工作台」完成，这里只展示结果。<br/>用它生成的视频记录，将随带货出片链路上线后在这里汇总。 | 明星授权的申请与审批在 AI 明星带货与「明星工作台」中完成，此处仅展示结果。（删第二行） | 「带货线 / 出片链路」是内部词；第二行承诺还没有的功能 |

---

## 叫法变动（全仓同步）

### 1. 项目页「新建创作」→「新建画布」（含空态「开始创作」→「新建画布」）

`git grep -n "新建创作"` 全部位置：

- 代码：`apps/web-aiavatar/src/ip/studio-projects.tsx:75`（按钮）、`:36`（注释）、`:76`（报错补充语，按上表一起改）；`apps/web-aiavatar/src/ip/studio-entry.ts:70`（注释，列举入口）；`apps/web-aiavatar/src/app/projects/demos/page.tsx:154`（hint「用于新建创作…」，这里的「新建创作」是泛指，可不改，见「需要核实」第 2 条）；`apps/web-aiavatar/src/shell/ui-version-switch.tsx:8`（注释）
- 测试：`apps/web-aiavatar/src/ip/studio-create-home.test.tsx:61, 262, 268, 272, 290, 293`；`apps/web-aiavatar/src/shell/ui-version-placement.test.tsx:12, 15, 17, 21`（这个测试自己渲染一个叫「新建创作」的按钮，和组件无关，可不改）
- 文档（现行真源需同步）：`AGENTS.md:1188`、`apps/web-aiavatar/PRODUCT.md:507`、`apps/web-aiavatar/README.md:1126`、`docs/ip-studio-new-canvas-and-threads.md:9, 18, 29, 332`
- 文档（发布 / 验收 / 版本历史记录，历史留底不改）：`docs/VERSION_HISTORY.md:41`、`docs/releases/studio-new-canvas-threads-release-20261021.md:54`、`docs/releases/studio-workspace-refactor-validation.md:61`、`docs/releases/studio-scene-backend-production-release-20261030.md:167`、`docs/studio-scene-creation.md:178`、`docs/audits/web-aiavatar-test-suite-audit-2026-10.md:426`、`apps/web-aiavatar/.impeccable/ip-create.md:7`

空态「开始创作」只在 `studio-projects.tsx:87`（按钮）；`studio-template-market.tsx:50` 的「开始创作」是链接到 /create，保留。测试：`studio-create-home.test.tsx:277, 281`。

### 2. 「回到 AI 视频继续 / 回到 AI 图片继续」→「在 AI 视频中编辑 / 在 AI 图片中编辑」

- 代码：`apps/web-aiavatar/src/ip/studio-projects.tsx:31`（只此一处生成文字，卡片和「⋯」菜单共用）
- 测试：`apps/web-aiavatar/src/ip/studio-create-home.test.tsx:177, 179, 180`（`/^回到 AI/` 正则）

### 3. 「资产货架」→「资产」

- `apps/web-aiavatar/src/app/market/[id]/page.tsx:43`、`apps/web-aiavatar/src/app/stars/[id]/page.tsx:48`（本批）、`apps/web-aiavatar/src/app/assets/[id]/page.tsx:188`（资产批次）、`apps/web-aiavatar/README.md:373`（文档，可一并改为「资产」）

### 4. 「保存画布模板 / 保存完整画布」→「保存为模板 / 保存模板」

- 代码：`apps/web-aiavatar/src/ip/studio-template-publish.tsx:32, 35, 36`
- 测试：`apps/web-aiavatar/src/ip/studio-template-publish.test.tsx:31, 33, 38, 47, 51`；`apps/web-aiavatar/src/ip/demo-admin-wiring.test.ts:73, 75`
- 旁注（不在本批）：画布「⋯」里两项一个叫「保存为模板」、一个叫「存为官方内容」（`canvas-host.tsx:142, 151`），「保存为 / 存为」不一致，画布批次可统一成「保存为官方内容」或都用「存为」。

---

## 测试会受影响的

| 测试 | 断言的文案 | 建议 |
|---|---|---|
| `ip/studio-create-home.test.tsx:239` | `aria-describedby` 指向的文字 === 「一张空白画布，打开就有助手，直接开始。」 | 改为断言 `aria-describedby` 存在且对应元素非空，或引用导出的常量 |
| `ip/studio-create-home.test.tsx:262–293` | `getByRole("button", { name: "新建创作" })` | 跟新叫法改名；或给按钮加 `data-action="new-canvas"` 后按它找 |
| `ip/studio-create-home.test.tsx:277–281` | 空态 `getByRole("button", { name: "开始创作" })` | 同上 |
| `ip/studio-create-home.test.tsx:177–180` | `name: "回到 AI 视频继续"` 等、`/^回到 AI/` | 改为断言链接的 `href`（`/video?scene=…&draft=…`），文案不进断言 |
| `ip/studio-create-home.test.tsx:291, 315` | `/新画布没有创建成功/` | 新文案「新画布没有创建成功，请重试。」仍命中，不用改 |
| `ip/studio-template-publish.test.tsx:31, 38, 47` | 按钮 `name: '保存完整画布'` | 改名或按 `type="primary"` 的提交按钮找 |
| `ip/studio-template-publish.test.tsx:33, 51` | `/已保存完整画布：4 个节点/` | 改为断言成功 `Alert` 出现（`role="alert"` / 类名）且含节点数 `4` |
| `ip/demo-admin-wiring.test.ts:75` | 源码 `toContain("保存完整画布")` | 改为钉住结构（如不再要求逐一重命名的那段逻辑），不钉按钮文字 |
| `ip/demo-admin.test.tsx:16` | `textbox` name `'名字'` | 跟着改「名称」，或按 `placeholder` / 字段顺序找 |
| `ip/demo-admin.test.tsx:18, 20` | 按钮 name `'删除（连素材，不可恢复）'` | 跟着改「删除」 |
| `ip/demo-admin.test.tsx:18` | `getByText('这一页只有平台运营能看。')` | 断言列表接口没被调用（已有）+ 有「返回项目」链接，不断言整句 |
| `ip/demo-admin.test.tsx:19` | `findByText('还没发过官方内容。')` | 断言空态容器出现、`alert` 消失（已有），文案可用 `/官方内容/` 宽松匹配 |
| `ip/demo-admin.test.tsx:20` | `getByText('不可恢复')`（弹窗里的 `<b>`） | 改为断言 `role="dialog"` 与危险按钮存在；若新文案保留 `<b>无法恢复</b>` 则改成该词 |

`ip/studio-errors.test.tsx:122–124` 点的是一个自建的「删除画布」按钮，和项目页无关，不受影响；项目页菜单项「删除画布」本批不改。

---

## 需要核实或连带改行为

1. **/create 页标题与新版导航不一致**：`studio-create-home.tsx:21` 的 `TITLE = "画布·自由创作"` 两版都用，而新版导航叫「画布」（`studio-navigation.ts`）。`StudioPage` 只有 `nextDescription`、没有新版标题参数，要改对得加一个 `nextTitle`（或在组件里按 `useUiVersion()` 选）。建议新版标题「画布」。
2. **官方内容管理里「工作流模板」的说明可能不实**：`app/projects/demos/page.tsx:154` hint「用于新建创作，只复制节点和提示词，不包含素材。」但现在「存为官方内容」走 `StudioTemplatePublish`，服务端整张快照（`StudioTemplateService.java:73` `snapshotForTemplate`），会带上已生成的图片和视频（菜单项 title 也写「完整保存画布和素材」）。只有老的配方式模板才不含素材。需确认后改成例如「用于新建画布，用户使用时复制一份到自己的画布。」
3. **官方资产页两个返回去处不同**：`app/market/[id]/page.tsx` 顶栏 `NavBar back="/discover"`，主视觉左上角的返回圆钮 `href="/assets"`（`:66`），同一页两个「返回」去不同地方。建议统一回 `/discover`。
4. **「立即授权」点了只弹一句「建设中」**：`app/market/[id]/page.tsx:128–137`。规则不鼓励做点了做不成的按钮；可考虑直接换成「联系客户经理」（若有联系方式）或去掉按钮，只保留说明和「建设中」标记。
5. **项目页删除弹窗里的报错**：删除失败时在弹窗内就地显示 `StudioErrorNotice`（`studio-projects.tsx:122`），符合「弹窗已就地写出错误就不叠弹窗」，无需改，记一笔以免误改成横幅。

---

## 仅手机端（不改，列出备查）

- `ip/studio-entry.ts:6–18` 各入口的 `description`：只在手机首页 `components/hub/studio-home.tsx:100` 显示（桌面 /create 用 `studio-create-tools.ts` 的描述）。其中口语的几条：「真人照片变成数字人形象，出多角度设定图」（「出」）、「跟助手聊镜头语言、节奏与分镜方案」（「跟…聊」）。
- `components/hub/create-center.tsx`：组件未被任何页面引用（死代码），里面有「合成出片」「用资产出片」「补素材」「出片时搭配使用」等旧说法；建议删除文件而不是改文案。
- `ip/studio-scene-workshop.tsx` / `ip/studio-scenes.ts`：`/scenes` 已跳 `/video`，组件未挂载（只剩 `studio-scene-workshop.test.tsx`）；文案如「新的创作，将从这里留下第一笔。」「从这里起步，按你的想法自由创作。」不会出现在界面上，建议连测试一起删。
- `components/landing/atlas.tsx`：全仓无引用，只有图片 alt。

---

## 存疑（拿不准的，写出两种写法让用户选）

1. 项目页卡片回场景草稿的入口（`studio-projects.tsx:31`）：
   - A「在 AI 视频中编辑 / 在 AI 图片中编辑」（说清去哪做什么，推荐）
   - B「返回 AI 视频 / 返回 AI 图片」（套返回类统一写法，但用户在项目页并不是从那里来的）
2. 项目页删除确认按钮（`studio-projects.tsx:122`）：
   - A「删除」（规则原文）
   - B 保留「确认删除」（标题改成问句后，「确认删除」略重复；但改了要动 `studio-create-home.test.tsx:147, 150, 151`）
3. 制作计划里的「冻结」（`studio-template-source.tsx:54`）：
   - A「冻结 {n} 积分」（与钱包、账本用词一致）
   - B「待结算 {n} 积分」（对普通用户更好懂，但全站其他地方若叫「冻结」会不一致，需先查钱包页叫法）

---

# 第三批：AI 视频（/video）、AI 图片（/image）

读过的文件（路径相对 `apps/web-aiavatar/src/`）：
- `app/video/page.tsx`、`app/image/page.tsx`、`app/scenes/page.tsx`（只做跳转和包 Suspense，没有界面文字）
- `ip/scenes/scene-video-studio.tsx`（1035 行，约 150 条界面文字，逐条看过）
- `ip/scenes/scene-image-studio.tsx`（572 行，约 80 条）
- `ip/scenes/scene-layout.tsx`（341 行，约 35 条）
- `ip/scenes/scene-prompt-editor.tsx`（2 条）、`scene-video-plan.ts`（3 条）、`scene-script-check.ts`（无界面文字）、`scene-drafts.ts` / `scene-draft-store.ts`（约 8 条，多为节点标题，只有 2 条会被用户看到）、`scene-catalog.ts` / `scene-query.ts` / `scene-prompt-refs.ts`（无界面文字）；`scene-test-picker.tsx` 是测试替身，跳过
- `canvas-bridge/studio-video-price.ts`（6 条）
- 服务端 `apps/server/src/main/resources/ipstudio/scenes.json`：界面显示的字段（组名、场景名、描述、参考图位 label/hint、`hint` 占位、视频 `placeholder`（只有爆款复刻用）、选项组 label/choices.label、`brief.facts[].label`（输入框下的小标签）、`structure`（示例页的做法几条）、`homeGoals`）都看过；只列显示在界面上、且不进模型提示词的字段
- 服务端 `apps/server/src/main/java/com/aistareco/aep/ipstudio/scene/StudioSceneCatalog.java` 的 compose 报错（会经 `sceneHintText` 原样显示在按钮旁）

总体：按钮旁写原因（`blocker` / `goBlocker` 灰字一行）、价格按服务端报价、编导按钮写「按实际用量」且没有显示冻结上限、视频状态没有编百分比，这几处都是对的。问题主要是说明和提示里的口语（「先放」「先收起来了」「说一声」「点一下」「读不出来」），以及「读取」「记录号」这类没跟上第一批统一写法的地方。

## AI 图片 · 输入区（`ip/scenes/scene-image-studio.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/scenes/scene-image-studio.tsx:109` | {labels}在这里用不上，先收起来了，回「{from.title}」还在 | 此场景不使用{labels}，返回「{from.title}」时会恢复 | 去掉聊天口吻和「先」「回」 |
| `ip/scenes/scene-image-studio.tsx:177` | 读取图片模型（`action`，报错弹窗标题会显示成「读取图片模型没有完成」） | 加载图片模型 | 统一用「加载」 |
| `ip/scenes/scene-image-studio.tsx:227` | 正在读取场景… / 正在读取模型… / 还没有可用的图片模型 | 正在加载场景… / 正在加载模型… / 暂无可用的图片模型 | 加载中统一写法；空态 |
| `ip/scenes/scene-image-studio.tsx:228` | 先放{label} / 写一句想要的画面 | 请添加{label} / 请描述想要的画面 | 去掉「先」，用书面语；服务端同句见下文「服务端」一节 |
| `ip/scenes/scene-image-studio.tsx:229` | 最多 {ownLimit} 字 | 超出 {ownLimit} 字上限，请删减 | 说清为什么不能点、该怎么做 |
| `ip/scenes/scene-image-studio.tsx:237` | 这个模型出不了 {ratio}，会按 {usedRatio} 出 | 当前模型不支持 {ratio}，将按 {usedRatio} 生成 | 不写「出」；书面语 |
| `ip/scenes/scene-image-studio.tsx:238` | 一次出不了 {count} 张，会出 {usedCount} 张 | 当前模型不支持一次生成 {count} 张，将生成 {usedCount} 张 | 同上 |
| `ip/scenes/scene-image-studio.tsx:255` | 描述没准备好，请再点一次 | 描述准备失败，请重试。 | 统一「请重试」，去「再点一次」 |
| `ip/scenes/scene-image-studio.tsx:284` | 这一行已经不在了，请重新生成 | 此生成记录已不存在，请重新生成。 | 「这一行」是界面结构的说法 |
| `ip/scenes/scene-image-studio.tsx:300` | 提交结果没有确认，点「确认原任务」查一下，不会重复扣费 | 提交结果待确认。点击「确认原任务」查询，不会重复扣费。 | 点击写法；去「一下」 |
| `ip/scenes/scene-image-studio.tsx:301` | 改一下再试；积分没有扣。 / 这次提交可能已经被受理，点「确认原任务」查一下，不要直接重新生成。 | 请调整后重试，本次未扣积分。 / 本次提交可能已被受理。请点击「确认原任务」查询，不要直接重新生成。 | 同上 |
| `ip/scenes/scene-image-studio.tsx:340` | 当时用的模型现在用不了，这次用「{name}」。 | 原模型已不可用，本次改用「{name}」。 | 书面语 |
| `ip/scenes/scene-image-studio.tsx:342` | 这次的设置放回来了，改好再生成。 | 已恢复此次的设置，修改后可重新生成。 | 去「放回来了」「再」 |
| `ip/scenes/scene-image-studio.tsx:360` | 放进「{label}」了{，换掉了原来那张}。 | 已放入「{label}」{，替换了原图}。 | 书面语 |
| `ip/scenes/scene-image-studio.tsx:383` | 场景目录没读出来（旁边按钮「重新加载」） | 场景加载失败。（按钮不变） | 加载失败统一写法；「目录」是开发词；旁边已有按钮，不再写「请刷新」 |
| `ip/scenes/scene-image-studio.tsx:384`、`:463` | 正在读取场景 / 正在打开草稿 | 正在加载场景… / 正在打开草稿… | 加载中统一写法 |
| `ip/scenes/scene-image-studio.tsx:394` | 出图设置（aria-label） | 图片生成设置 | 不用「出图」 |
| `ip/scenes/scene-image-studio.tsx:421` | 还有要补充的，写在这里（占位） | 补充要求（选填） | 选填标「选填」，口语改书面 |
| `ip/scenes/scene-image-studio.tsx:425` | 改完整描述 | 编辑完整描述 | 按钮用标准叫法 |
| `ip/scenes/scene-image-studio.tsx:426` | 用回场景描述 | 恢复场景描述 | 同上 |
| `ip/scenes/scene-image-studio.tsx:461` | 放参考图，说说想要的画面；不知道怎么写，点上面的场景名换一个场景。 | 添加参考图并描述想要的画面，也可点击上方场景名选择其他场景。 | 去聊天口吻；点击写法 |
| `ip/scenes/scene-image-studio.tsx:467` | 放好参考图，点「生成图片」，做好的图会出现在这里。 | 点击「生成图片」后，生成的图片将显示在这里。 | 自由出图不要求参考图，前半句不准；书面语 |
| `ip/scenes/scene-image-studio.tsx:471` | 选{label}（选择框标题） | 选择{label} | 标题用完整动词 |
| `ip/scenes/scene-image-studio.tsx:471` | 从资产库里选一张；新图点「上传到资产库」，传完会自动选中。原文件不会被改动。 | 从资产库选择一张图片。新图片可点击「上传到资产库」，上传后自动选中，原文件不会被修改。 | 点击写法；去口语 |

## AI 图片 · 结果区（`ip/scenes/scene-image-studio.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/scenes/scene-image-studio.tsx:378`、`:525`（aria-label 与 title 两处） | 当参考图 | 用作参考图 | 动词 + 对象；见「叫法变动」 |
| `ip/scenes/scene-image-studio.tsx:499` | 正在提交 / 提交结果没有确认 / 排队中，前面还有 {position - 1} 个 | 提交中 / 结果待确认 / 排队中 · 第 {position} 位 | 状态标准叫法；位次为 1 时原文会显示「前面还有 0 个」 |
| `ip/scenes/scene-image-studio.tsx:514` | （记录号 {errorLogId}）（悬停提示） | （追查号 {errorLogId}） | 全站叫「追查号」（`studio-errors.tsx`、`sceneHintText`） |

## AI 视频 · 输入区（`ip/scenes/scene-video-studio.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/scenes/scene-video-studio.tsx:125` | 读取视频模型（`action`） | 加载视频模型 | 统一用「加载」 |
| `ip/scenes/scene-video-studio.tsx:197` | {dropped}在「{next.title}」用不上，先收起来了，回「{from.title}」还在 | 「{next.title}」不使用{dropped}，返回「{from.title}」时会恢复 | 同图片页 109 行 |
| `ip/scenes/scene-video-studio.tsx:268` | 场景还没读出来，请稍等 | 场景尚未加载完成，请稍后重试。 | 去「读出来」 |
| `ip/scenes/scene-video-studio.tsx:354` | 请选一张图片 / 请选一段视频 / 请选一段声音 | 请选择一张图片 / 请选择一段视频 / 请选择一段声音 | 用完整动词 |
| `ip/scenes/scene-video-studio.tsx:375` | 放素材（`action`，弹窗标题「放素材没有完成」） | 添加素材 | 标准叫法 |
| `ip/scenes/scene-video-studio.tsx:388` | 这张图读不出来了，回 AI 图片重新点一次「做成视频」 | 图片加载失败，请返回 AI 图片重新点击「做成视频」。 | 加载失败、返回、点击统一写法 |
| `ip/scenes/scene-video-studio.tsx:394` | 图带过来了，放在「{label}」。说说想拍成什么样，编导会照着写。 | 图片已放入「{label}」。描述想要的视频后，AI 编导会据此撰写脚本。 | 去「说说」「拍」 |
| `ip/scenes/scene-video-studio.tsx:447`、`:451`、`:454` | 正在读取场景… / 正在读取模型… | 正在加载场景… / 正在加载模型… | 加载中统一写法 |
| `ip/scenes/scene-video-studio.tsx:448`、`:454`、`:455`、`:685` | 先放{label} | 请添加{label} | 去「先」 |
| `ip/scenes/scene-video-studio.tsx:449`、`:456` | 先写一句要求 | 请填写要求 | 去「先」 |
| `ip/scenes/scene-video-studio.tsx:450` | 说说想改哪里 | 请填写修改意见 | 去聊天口吻 |
| `ip/scenes/scene-video-studio.tsx:452` | AI 编导暂时用不了（文字模型没配置价格） | AI 编导暂时不可用，请联系平台处理。 | 不暴露内部配置原因（价格配置是平台侧的事） |
| `ip/scenes/scene-video-studio.tsx:509` | 这一版没发出去，请再点一次 | 提交失败，请重试。 | 统一「请重试」 |
| `ip/scenes/scene-video-studio.tsx:512`、`:718` | 提交结果没有确认，点「确认原任务」查一下，不会重复扣费 | 提交结果待确认。点击「确认原任务」查询，不会重复扣费。 | 同图片页 |
| `ip/scenes/scene-video-studio.tsx:513` | 让编导写脚本（`action`） | 生成脚本 | 弹窗标题「让编导写脚本没有完成」读着别扭 |
| `ip/scenes/scene-video-studio.tsx:513` | 改一下再试；积分没有扣。 / 这次可能已经被受理，点「确认原任务」查一下，不要直接重写。 | 请调整后重试，本次未扣积分。 / 本次提交可能已被受理。请点击「确认原任务」查询，不要直接重新生成。 | 同图片页 |
| `ip/scenes/scene-video-studio.tsx:719` | 改一下再试；积分没有扣。 / 这次可能已经被受理，点「确认原任务」查一下，不要直接重新生成。 | 请调整后重试，本次未扣积分。 / 本次提交可能已被受理。请点击「确认原任务」查询，不要直接重新生成。 | 同上 |
| `ip/scenes/scene-video-studio.tsx:524` | 这一条已经不在了 | 此记录已不存在。 | 书面语 |
| `ip/scenes/scene-video-studio.tsx:569` | 没交出去，请再点一次 | 提交失败，请重试。 | 统一「请重试」 |
| `ip/scenes/scene-video-studio.tsx:592` | 脚本放进编辑框了，原来写的那段换掉了 | 脚本已放入编辑框，替换了原有内容。 | 书面语 |
| `ip/scenes/scene-video-studio.tsx:616` | 当时用的模型现在用不了，这次用「{name}」。 | 原模型已不可用，本次改用「{name}」。 | 同图片页 |
| `ip/scenes/scene-video-studio.tsx:618` | 这条的脚本和设置放回来了，素材用的是现在放着的。 | 已恢复此视频的脚本和设置，素材使用当前已添加的。 | 书面语 |
| `ip/scenes/scene-video-studio.tsx:640` | 素材和模型对不上 | 素材与当前模型不匹配 | 书面语 |
| `ip/scenes/scene-video-studio.tsx:684` | 正在读取视频模型… / 还没有可用的视频模型 | 正在加载视频模型… / 暂无可用的视频模型 | 加载中、空态统一写法 |
| `ip/scenes/scene-video-studio.tsx:686` | 先写提示词，或点「AI 编导」写一版脚本 | 请填写提示词，或点击「AI 编导」生成脚本 | 去「先」；点击写法 |
| `ip/scenes/scene-video-studio.tsx:687` | 还有没填的：{blanks}。在上面换成实际内容，用不上的直接删掉。 | 脚本中还有待补充的内容：{blanks}。请替换为实际内容，不需要的请删除。 | 书面语，不写「上面」这种方位 |
| `ip/scenes/scene-video-studio.tsx:725` | 浏览器不让复制，请手动选中文字复制 | 浏览器不允许复制，请手动选中文字复制。 | 书面语 |
| `ip/scenes/scene-video-studio.tsx:729` | 场景目录没读出来（旁边按钮「重新加载」） | 场景加载失败。（按钮不变） | 同图片页 383 行 |
| `ip/scenes/scene-video-studio.tsx:730` | 正在读取场景 | 正在加载场景… | 加载中统一写法 |
| `ip/scenes/scene-video-studio.tsx:735` | 这个模型单段最长 {max} 秒，{duration} 秒会分 {n} 段，交给创作助手做 | 当前模型单段最长 {max} 秒，{duration} 秒将分 {n} 段，由创作助手制作 | 书面语 |
| `ip/scenes/scene-video-studio.tsx:737` | 这个模型只做 {n} 秒的片子 / 这个模型最短 {min} 秒，会按 {n} 秒出 | 当前模型仅支持 {n} 秒 / 当前模型最短 {min} 秒，将按 {n} 秒生成 | 不写「出」「片子」 |
| `ip/scenes/scene-video-studio.tsx:743`、`:772`（aria-label 与 title） | 从资产库选{label} | 从资产库选择{label} | 用完整动词 |
| `ip/scenes/scene-video-studio.tsx:774` | 再加一张 | 添加图片 | 去「再」 |
| `ip/scenes/scene-video-studio.tsx:794` | 写一条视频（区块 aria-label） | 视频创作 | 名词标题 |
| `ip/scenes/scene-video-studio.tsx:831` | 贴上写好的提示词直接生成；只有想法的话，写几句让 AI 编导帮你写成脚本 | 粘贴写好的提示词直接生成；只有想法时，可写几句交给 AI 编导撰写脚本 | 去口语 |
| `ip/scenes/scene-video-studio.tsx:835` | 有就写（小标签后缀） | 选填 | 选填标「选填」；见「测试会受影响的」 |
| `ip/scenes/scene-video-studio.tsx:839` | 回到 AI 编导接着改 / 按框里的想法写一版分镜脚本，按实际用量扣积分（按钮 title） | 返回 AI 编导继续修改 / 根据输入的想法撰写分镜脚本，按实际用量结算 | 返回类写法；去「接着」 |
| `ip/scenes/scene-video-studio.tsx:857` | 分 {n} 段 · 先报价 / 先出方案（按钮里的小字） | 分 {n} 段 · 确认方案时报价 / 确认方案时报价 | 去「先」；说清什么时候知道价格 |
| `ip/scenes/scene-video-studio.tsx:868` | 让编导照现在的改一版（按钮） | 按当前设置修改脚本 | 动词 + 对象 |
| `ip/scenes/scene-video-studio.tsx:893` | 选{label}（选择框标题） | 选择{label} | 用完整动词 |
| `ip/scenes/scene-video-studio.tsx:894` | 从资产库里选；新文件点「上传到资产库」，传完会自动选中。原文件不会被改动。 | 从资产库选择。新文件可点击「上传到资产库」，上传后自动选中，原文件不会被修改。 | 点击写法 |

## AI 视频 · AI 编导（`ip/scenes/scene-video-studio.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/scenes/scene-video-studio.tsx:803`、`:947` | 回到编辑 | 返回编辑 | 返回类统一写法 |
| `ip/scenes/scene-video-studio.tsx:810` | 停止（`action`，弹窗标题「停止没有完成」） | 停止生成 | 和 886 行一致 |
| `ip/scenes/scene-video-studio.tsx:814` | 想改哪里（aria-label） | 修改意见 | 名词标签；见测试 |
| `ip/scenes/scene-video-studio.tsx:814` | 设置改过了，直接发送就照现在的改一版 / 想改哪里，直接说（占位） | 设置已修改，直接发送将按当前设置修改脚本 / 例如：开头更抓人、台词口语一点 | 占位给例子，不重复标签；去「就」 |
| `ip/scenes/scene-video-studio.tsx:818` | 让编导改（aria-label） / 照现在的设置改一版（title） | 发送修改意见 / 按当前设置修改 | 标准叫法 |
| `ip/scenes/scene-video-studio.tsx:931` | 正在交给编导 / 提交结果没有确认 / 排队中，前面还有 {position - 1} 个 / 正在改脚本 / 正在看素材、写脚本 | 提交中 / 结果待确认 / 排队中 · 第 {position} 位 / 正在修改脚本 / 正在分析素材并撰写脚本 | 状态标准叫法；位次写法同图片页 |
| `ip/scenes/scene-video-studio.tsx:932` | 记录号 {errorLogId}（悬停提示） | 追查号 {errorLogId} | 全站叫「追查号」 |
| `ip/scenes/scene-video-studio.tsx:935` | 还缺{mustFill}。在下面写上发给编导，会补进脚本。{mayFill}没有就不用写。 | 还缺{mustFill}。请在下方输入框补充，AI 编导会写入脚本。{mayFill}为选填。 | 去口语、方位说法 |
| `ip/scenes/scene-video-studio.tsx:936` | {mayFill}没有就不用写，出片前把脚本里标着的那几处删掉就行。 | {mayFill}为选填。如不需要，生成视频前请删除脚本中标出的位置。 | 不写「出片」「就行」 |
| `ip/scenes/scene-video-studio.tsx:937` | 编导觉得可能还缺{missing}，写过了就不用管。 | AI 编导提示可能还缺{missing}，如已填写可忽略。 | 书面语 |
| `ip/scenes/scene-video-studio.tsx:938` | 你写的 {absent} 脚本里没用上，要加的话跟编导说一声。 | 你填写的 {absent} 未出现在脚本中，如需加入，请告诉 AI 编导。 | 去「说一声」 |
| `ip/scenes/scene-video-studio.tsx:942` | 重新写（失败后的重试按钮） | 重试 | 标准叫法 |
| `ip/scenes/scene-video-studio.tsx:944` | 重新回答（aria-label 与 title） | 重新生成 | 这里是重写一版脚本，不是对话 |

## AI 视频 · 规格面板与结果区（`ip/scenes/scene-video-studio.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/scenes/scene-video-studio.tsx:887` | 写好提示词点「生成视频」，做好的视频会出现在这里。 | 填写提示词后点击「生成视频」，生成的视频将显示在这里。 | 点击写法；书面语 |
| `ip/scenes/scene-video-studio.tsx:963` | 正在提交 / 提交结果没有确认 / 排队中，前面还有 {position - 1} 个 / 正在生成，一般要几分钟 | 提交中 / 结果待确认 / 排队中 · 第 {position} 位 / 生成中，通常需要几分钟 | 状态标准叫法（examples.md 认可「通常需要几分钟」） |
| `ip/scenes/scene-video-studio.tsx:968` | （记录号 {errorLogId}） | （追查号 {errorLogId}） | 全站叫「追查号」 |
| `ip/scenes/scene-video-studio.tsx:978` | 把这条的脚本和设置放回编辑器，改好再出；这条留着（title） | 将此视频的脚本和设置恢复到编辑器，修改后重新生成，原视频保留 | 不写「出」「再」 |
| `ip/scenes/scene-video-studio.tsx:1004` | 超过单段上限，分 {n} 段生成后拼成一条：{segments} 秒。交给创作助手做，先出方案和报价。 | 超过单段上限，将分 {n} 段生成后拼接：{segments} 秒。由创作助手制作，确认方案和报价后开始。 | 去「先」「做」 |
| `ip/scenes/scene-video-studio.tsx:1012` | 先优化再生成 | 优化后生成 | 去「先」「再」 |
| `ip/scenes/scene-video-studio.tsx:1015` | 先按这个模型更认的写法改写一遍，按实际用量另扣少量积分，不含在视频价里。 / 按你写的原文直接生成，只扣视频价。 | 生成前按此模型的写法优化提示词，按实际用量另行扣费，不含在视频价格中。 / 按原文生成，只扣视频费用。 | examples.md 原句改法 |

## AI 视频 · 交给创作助手之后（`ip/scenes/scene-video-studio.tsx` `HandoffStatus`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/scenes/scene-video-studio.tsx:1026` | 在画布里交给创作助手做了，正在读进度… | 已交给画布中的创作助手，正在加载进度… | 加载中统一写法 |
| `ip/scenes/scene-video-studio.tsx:1027` | 交给画布里的创作助手了，去那边确认方案和费用后才开始做。 | 已交给画布中的创作助手，确认方案和费用后开始制作。 | 去「去那边」 |
| `ip/scenes/scene-video-studio.tsx:1028` | 创作助手在做，第 {n} 步，共 {m} 步。 | 制作中，第 {n} 步，共 {m} 步。 | 状态标准叫法 |
| `ip/scenes/scene-video-studio.tsx:1029` | 创作助手做完了，成片在画布里。 | 制作已完成，结果在画布中。 | 执行完成不一定有成片，见「需要核实」第 5 条 |
| `ip/scenes/scene-video-studio.tsx:1030` | 创作助手停下来等你{：reason / ，去画布里看一眼}。 | 创作助手已暂停{：reason / ，请在画布中查看}。 | 去口语 |
| `ip/scenes/scene-video-studio.tsx:1031` | 这次制作停掉了，做好的部分还在画布里。 | 制作已停止，已完成的部分保留在画布中。 | 书面语 |
| `ip/scenes/scene-video-studio.tsx:1032` | 没全部做完，做好了 {done} 步，剩下的去画布里看看。 | 制作未全部完成，已完成 {done} 步，请在画布中查看。 | 去「看看」 |
| `ip/scenes/scene-video-studio.tsx:1034` | 去画布看（链接） | 在画布中查看 | 标准叫法 |

## 共用组件（`ip/scenes/scene-layout.tsx`、`scene-prompt-editor.tsx`、`scene-video-plan.ts`、`scene-draft-store.ts`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/scenes/scene-layout.tsx:82` | 换场景，当前：{title}（aria-label） / 换场景（title） | 切换场景，当前：{title} / 切换场景 | 标准叫法 |
| `ip/scenes/scene-layout.tsx:101` | 换场景（弹层 aria-label） | 切换场景 | 同上 |
| `ip/scenes/scene-layout.tsx:216` | 没读到最新的草稿 / 最近的草稿没读到（旁边按钮「重试」） | 最新草稿加载失败 / 草稿加载失败 | 加载失败统一写法；旁边已有「重试」，不再写「请刷新」 |
| `ip/scenes/scene-layout.tsx:218` | 正在读取 | 正在加载草稿… | 加载中统一写法 |
| `ip/scenes/scene-layout.tsx:224` | 做过的会出现在这里 | 暂无草稿。 | 空态统一写法 |
| `ip/scenes/scene-layout.tsx:273` | 后台还没有配置可用的{kind}模型，暂时不能生成。请联系管理员在「AI 模型」里开通。 | 暂无可用的{kind}模型，暂时无法生成。请联系平台开通。 | 用户进不了管理后台，「后台」「AI 模型」是平台侧的叫法 |
| `ip/scenes/scene-layout.tsx:286` | 模型那边请求太多，稍等一分钟再点「重新生成」；没出来的{thing}不扣积分 | 生成服务请求过多，请稍后点击「重新生成」。未生成的{thing}不扣积分。 | 去口语，不编「一分钟」 |
| `ip/scenes/scene-layout.tsx:287` | 模型那边正在排满，过几分钟再点「重新生成」；没出来的{thing}不扣积分 | 生成服务繁忙，请稍后点击「重新生成」。未生成的{thing}不扣积分。 | 同上 |
| `ip/scenes/scene-layout.tsx:288` | 生成失败，没出来的{thing}不扣积分 | 生成失败，未生成的{thing}不扣积分。 | 去「没出来」；同时把图片页调用时的默认 `thing = "图"` 改成「图片」 |
| `ip/scenes/scene-prompt-editor.tsx:66` | {title}，点一下看大图（title） | {title}，点击查看大图 | 点击写法 |
| `ip/scenes/scene-prompt-editor.tsx:67` | {label}：{title}，看大图（aria-label） | {label}：{title}，查看大图 | 同上；见测试 |
| `ip/scenes/scene-video-plan.ts:29` | 这个模型最多用 {n} 张图、{m} 段声音，多出来的不会用上 | 当前模型最多使用 {n} 张图片、{m} 段声音，超出部分不会使用 | 书面语 |
| `ip/scenes/scene-video-plan.ts:33` | 这个模型只用第一张图做开头画面{，声音不会用上} | 当前模型仅使用第一张图片作为首帧{，不使用声音} | 「首帧」是允许的术语 |
| `ip/scenes/scene-video-plan.ts:35` | 这个模型不看参考素材，只按脚本生成 | 当前模型不使用参考素材，仅按脚本生成 | 书面语 |
| `ip/scenes/scene-draft-store.ts:41`、`:44` | 草稿还没准备好 | 草稿尚未就绪，请稍后重试。 | 会进报错弹窗；补下一步 |

## 价格说明（`canvas-bridge/studio-video-price.ts`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `canvas-bridge/studio-video-price.ts:108` | 先优化另按实际用量扣少量积分。 | 提示词优化按实际用量另行扣费。 | examples.md 同类句改法 |
| `canvas-bridge/studio-video-price.ts:112` | 模型赠款抵 {x} 积分，再付 {y} 积分 / 不用再付积分。 | 模型赠款抵扣 {x} 积分，另需支付 {y} 积分 / 无需另付积分。 | 去「再」 |
| `canvas-bridge/studio-video-price.ts:113` | 可用积分不够，这条要付 {n} 积分。 / 现在还不能生成。 | 可用积分不足，需支付 {n} 积分。 / 暂时无法生成。 | 书面语；按钮可点问题见「需要核实」第 2 条 |
| `canvas-bridge/studio-video-price.ts:119` | 个人账户 {a} 积分，企业账户 {b} 积分，点生成时选账户。 | 个人账户 {a} 积分，企业账户 {b} 积分，生成时选择付款账户。 | 去「点」 |
| `canvas-bridge/studio-video-price.ts:122` | 付款账户点生成时选，模型赠款到时再抵。 | 生成时选择付款账户，模型赠款在付款时抵扣。 | 去口语 |

## 服务端：场景目录（`apps/server/src/main/resources/ipstudio/scenes.json`）

只改界面显示、不进模型提示词的字段（`description`、参考图位 `hint`、`hint` 占位、爆款复刻的 `placeholder`）。`apps/web-aiavatar/src/ip/mocks/scenes.ts` 里抄了同样的字，要一起改（§8.0.1 ⑦ mock 照服务端写）。

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `apps/server/src/main/resources/ipstudio/scenes.json:53`（自由出图 description） | 自己写描述，可以放几张参考图 | 自己写描述，可添加参考图 | 书面语；mock `ip/mocks/scenes.ts:10` 同步 |
| `apps/server/src/main/resources/ipstudio/scenes.json:77`（自由出图 hint，作输入框占位） | 说说想要什么画面。放了参考图的话，可以用「图1、图2」指它们 | 描述想要的画面。添加参考图后，可用「图1」「图2」指代 | 占位不写聊天口吻；mock `ip/mocks/scenes.ts:10` 的「说说想要什么画面」同步 |
| `apps/server/src/main/resources/ipstudio/scenes.json:116`（IP 表情包 description） | 一次出九种表情，聊天、封面都能用 | 一次生成九种表情，聊天、封面都能用 | 不用「出」 |
| `apps/server/src/main/resources/ipstudio/scenes.json:206`（服装上身 description） | 把衣服穿到模特身上，出模特图 | 把衣服穿到模特身上，生成模特图 | 同上 |
| `apps/server/src/main/resources/ipstudio/scenes.json:216`（参考图位悬停提示） | 平铺图或挂拍图都行 | 平铺图或挂拍图均可 | 书面语 |
| `apps/server/src/main/resources/ipstudio/scenes.json:237` | 不放就由 AI 安排人物 | 不添加时由 AI 生成人物 | 书面语 |
| `apps/server/src/main/resources/ipstudio/scenes.json:314` | 不放就按文字里写的改 | 不添加时按文字描述修改 | 同上 |
| `apps/server/src/main/resources/ipstudio/scenes.json:335`、`:356` | 不放就按文字里写的场景 | 不添加时按文字描述生成场景 | 同上 |
| `apps/server/src/main/resources/ipstudio/scenes.json:1598`（爆款复刻 placeholder） | 说说要换成什么，例如：把原片里的护手霜换成我的精华液，人物换成我的 IP | 要替换的内容，例如：把原片里的护手霜换成我的精华液，人物换成我的 IP | 占位不写「说说」；例子是用户口吻，保留；mock `ip/mocks/scenes.ts:22` 的「说说要换成什么」同步 |

改 scenes.json 前要确认：线上的场景目录可能已经被运营在 Studio 后台「场景模板」里保存过（平台配置 `studio.scene-catalog`，有就以它为准），只改随包文件线上看不到。要让线上生效，得在后台里同样改一遍，或确认那份配置没存过。

## 服务端：拼话报错（`apps/server/src/main/java/com/aistareco/aep/ipstudio/scene/StudioSceneCatalog.java`）

这些经 `sceneHintText` 原样显示在「生成图片 / 生成视频」按钮旁，和前端的 `blocker` 是同一句话，要一起改。

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `apps/server/src/main/java/com/aistareco/aep/ipstudio/scene/StudioSceneCatalog.java:348`、`:471`、`:492` | 这个场景不存在，请刷新后重选 | 该场景已下架，请刷新后重新选择 | 书面语 |
| `apps/server/src/main/java/com/aistareco/aep/ipstudio/scene/StudioSceneCatalog.java:351`、`:495`、`:498` | "先放" + label | "请添加" + label | 和前端同改 |
| `apps/server/src/main/java/com/aistareco/aep/ipstudio/scene/StudioSceneCatalog.java:354` | 写一句想要的画面 | 请描述想要的画面 | 和前端同改 |
| `apps/server/src/main/java/com/aistareco/aep/ipstudio/scene/StudioSceneCatalog.java:367`、`:371` | 这个选项已经下架，请刷新后重选 | 该选项已下架，请刷新后重新选择 | 书面语 |
| `apps/server/src/main/java/com/aistareco/aep/ipstudio/scene/StudioSceneCatalog.java:499` | label + "最多放 " + max + " 张" | label + "最多 " + max + " 张" | 去「放」 |
| `apps/server/src/main/java/com/aistareco/aep/ipstudio/scene/StudioSceneCatalog.java:500` | 先写一句要求 | 请填写要求 | 和前端同改 |

## 叫法变动（全仓同步）

1. **「当参考图」→「用作参考图」**（`git grep -n "当参考图"`，只算界面那一处叫法）
   - `apps/web-aiavatar/src/ip/scenes/scene-image-studio.tsx:378`（看大图里的按钮）、`:525`（每张图上的图标按钮 aria-label / title）
   - 测试 `apps/web-aiavatar/src/ip/scenes/scene-continue.test.tsx:92`、`:103`
   - 文档 `apps/web-aiavatar/README.md:187`、`:1208`
   - 其余命中（`IpDocs.java`、`IpProjectService.java`、`DramaCanvasOwnership.java`、admin `drama/prompts`、服务端测试注释）是代码注释或别的产品线，不动。
2. **「先放 X」→「请添加 X」**：前端 `scene-image-studio.tsx:228`、`scene-video-studio.tsx:448`、`:454`、`:455`、`:685`；服务端 `StudioSceneCatalog.java:351`、`:495`、`:498`；测试见下节。
3. **「记录号」→「追查号」**：`scene-image-studio.tsx:514`、`scene-video-studio.tsx:932`、`:968`（`git grep -n "记录号" -- apps/web-aiavatar/src` 只有这 3 处）。
4. **「回到编辑」→「返回编辑」**：`scene-video-studio.tsx:803`、`:947`；测试 `scene-director-spec.test.tsx:245`、`scene-draft-state.test.tsx:233`。
5. **「有就写」→「选填」**（facts 小标签后缀）：`scene-video-studio.tsx:835`；测试 `scene-director-spec.test.tsx:212`、`:247`。
6. **「去画布看」→「在画布中查看」**：`scene-video-studio.tsx:1034`；测试 `scene-continue.test.tsx:130`；`README.md` 里如有引用一起改。

## 测试会受影响的

| 文件:行号 | 断言的是 | 建议 |
|---|---|---|
| `apps/web-aiavatar/src/ip/scenes/scene-continue.test.tsx:92`、`:103` | 按钮名「当参考图」 | 跟改名为「用作参考图」（按 role 找按钮，名字就是被测的入口，可保留按名找） |
| `apps/web-aiavatar/src/ip/scenes/scene-continue.test.tsx:94` | 「放进「商品图」了，换掉了原来那张。」 | 断言第一格参考图换成了新 key（读 `img[alt=商品图]` 的 src），不断言整句 |
| `apps/web-aiavatar/src/ip/scenes/scene-continue.test.tsx:116` | /图带过来了，放在「商品图」/ | 断言素材格里出现了那张图（role img），不断言说明文字 |
| `apps/web-aiavatar/src/ip/scenes/scene-continue.test.tsx:130` | 链接名「去画布看」 | 跟改名；href 断言保留 |
| `apps/web-aiavatar/src/ip/scenes/scene-continue.test.tsx:136`、`:142` | 「创作助手在做，第 2 步，共 3 步」/「创作助手停下来等你：…」 | 断言「第 2 步，共 3 步」和 `needsUserReason` 原文出现、容器带 `is-waiting`，不断言前缀 |
| `apps/web-aiavatar/src/ip/scenes/scene-studios.test.tsx:60`、`:114`、`:204` | 「先放商品图」「先放参考视频」 | 断言按钮 disabled 且 `aria-describedby` 指向的提示存在、含场景的素材名，不断言动词 |
| `apps/web-aiavatar/src/ip/scenes/scene-studios.test.tsx:163` | /正在生成，一般要几分钟/ | 断言行上的 `role=status` 存在且行 class 为 `is-loading` |
| `apps/web-aiavatar/src/ip/scenes/scene-studios.test.tsx:180`、`apps/web-aiavatar/src/canvas-bridge/studio-video-price.test.ts:26`、`:28` | 价格说明整句（含「先优化另按实际用量扣少量积分」「再付 365 积分」） | 文案即被测行为（必须说清折扣、赠款、另扣优化费），保留断言但改成新句；或拆成断言含「省 465 积分」「365」两个数字 |
| `apps/web-aiavatar/src/ip/scenes/scene-studios.test.tsx:158` | 按钮名「先优化再生成」 | 跟改名「优化后生成」 |
| `apps/web-aiavatar/src/ip/scenes/scene-studios.test.tsx:262`、`:263`、`:266`、`:267` | 「最近的草稿没读到」「做过的会出现在这里」 | 断言失败态有 `role=alert` 和「重试」按钮、空态 `.scene-recent-empty` 不带 `is-error`；不断言整句 |
| `apps/web-aiavatar/src/ip/scenes/scene-draft-state.test.tsx:129` | /这次的设置放回来了，改好再生成/ | 断言出现「撤销」按钮、输入框值被放回（后面几行已在断言），去掉这句 |
| `apps/web-aiavatar/src/ip/scenes/scene-draft-state.test.tsx:192` | 「这个模型出不了 16:9，会按 1:1 出」 | 文案即被测行为（「不悄悄钳制」），改成新句，或断言提示含「16:9」「1:1」 |
| `apps/web-aiavatar/src/ip/scenes/scene-draft-state.test.tsx:258`、`:260` | 「商品图在「门店发现」用不上，先收起来了，…」「先放门店照片」 | 断言提示含「商品图」「促销转化」两个名字、按钮 disabled；不断言整句 |
| `apps/web-aiavatar/src/ip/scenes/scene-draft-state.test.tsx:298` | 「这个模型单段最长 10 秒，15 秒会分 2 段，交给创作助手做」 | 断言主按钮名变为「交给创作助手」且提示含「10 秒」「2 段」 |
| `apps/web-aiavatar/src/ip/scenes/scene-draft-state.test.tsx:233`、`apps/web-aiavatar/src/ip/scenes/scene-director-spec.test.tsx:245` | 按钮名「回到编辑」 | 跟改名「返回编辑」 |
| `apps/web-aiavatar/src/ip/scenes/scene-draft-state.test.tsx:237`、`:238`、`apps/web-aiavatar/src/ip/scenes/scene-director-spec.test.tsx:163`、`:168`、`:185` | 输入框名「想改哪里」、按钮名「让编导改」 | 跟改名（「修改意见」「发送修改意见」） |
| `apps/web-aiavatar/src/ip/scenes/scene-director-spec.test.tsx:212`、`:247` | 「原价有就写」 | 跟改名为「原价选填」 |
| `apps/web-aiavatar/src/ip/scenes/scene-director-spec.test.tsx:218`、`:222`、`:235`、`:242` | 编导核对的四句提示整句 | 断言 `.scene-script-missing` / `.scene-script-check` 存在且含缺项名（「购买入口」「158」「火锅店的名字」「原价」），不断言整句 |
| `apps/web-aiavatar/src/ip/scenes/scene-director-spec.test.tsx:130`、`:133` | 按钮名 /让编导照现在的改一版/ | 跟改名「按当前设置修改脚本」 |
| `apps/web-aiavatar/src/ip/scenes/scene-director-spec.test.tsx:132`、`:136`、`:176`、`:191` | 「这版脚本是照 15 秒写的，现在要出 10 秒」（也断言了交给服务端的 `settingsChanged`） | 见「存疑」第 4 条；若改，断言 `settingsChanged` 含「15」「10」 |
| `apps/web-aiavatar/src/ip/scenes/scene-video-plan.test.ts:19`、`:25`、`:28`、`apps/web-aiavatar/src/ip/scenes/scene-draft-races.test.tsx:222` | `plan.note` 整句 | 断言 `used` 的内容和 `note` 是否存在（`toBeDefined()`），只在一条用例里保留整句 |
| `apps/web-aiavatar/src/ip/scenes/scene-prompt-editor.test.tsx:40`、`:41`、`:51`、`:61`、`:66`、`:72` | aria-label「图1：马克杯，看大图」 | 跟改为「…，查看大图」，或用 `/^图1：马克杯/` |
| `apps/server/src/test/java/com/aistareco/aep/ipstudio/scene/StudioSceneCatalogTest.java:45`、`:47`、`:64`、`:65`、`:66`、`:101`、`:105`、`:125`、`:229`、`:231` | `hasMessage("先放…")` 等 | 改成断言错误码 `STUDIO_SCENE_INPUT_INVALID` + `hasMessageContaining(素材名)`（§8.0.1 ⑩） |

## 需要核实或连带改行为

1. **「交给创作助手」写「确认后才扣积分」不准。** `scene-video-studio.tsx:852` 的 title 是「交给画布里的创作助手：先出方案和报价，确认后才扣积分」。实际 `handoff()` 跳转画布后自动发出第一句（`studioEntryHref(..., { send: true })`），这一轮对话按 Token 实际用量计费（AGENTS「Studio 对话独立额度」「对话去掉继续」）；爆款复刻的拉片分析也是付费步骤。确认之前就已经在扣对话费用。建议改为：「交给画布中的创作助手。对话按实际用量结算，制作费用在确认方案后扣除。」同类：`:1004`、`:1027` 只说「确认方案和费用后开始制作」，没说对话本身计费，读着像全程不花钱，最好也带一句。
2. **积分不够时按钮仍可点。** `canvas-bridge/studio-video-price.ts:113` 在 `canAfford=false` 时说「可用积分不够」，但 `goBlocker`（`scene-video-studio.tsx:684-688`、`:739`）不看报价，「生成视频」照样能点，点了才在付款确认那一步失败。要么把「积分不足」并进 `videoBlocker` 并在按钮旁给充值入口，要么说明里写清「点击后可充值」。按规则不应留点了做不成的按钮。
3. **AI 图片按钮上的价是标准价。** `scene-image-studio.tsx:219-220`、`:444` 按本地价表 `unit × 张数` 显示，不含模型折扣和赠款（AI 视频已改成服务端报价）。有折扣时按钮写的价比实际扣的高，确认弹窗里又是另一个数。AGENTS 已记为 TODO（「AI 图片页与画布仍只显示标准价」），这里提醒：文案改不了这个，要接 `quote` 报价接口。
4. **「AI 编导」按钮不能点时，原因只在悬停提示里。** `scene-video-studio.tsx:838-839`：`disabled` 时原因 `scriptBlocker(text)` 只放在 `title`，按钮旁那行显示的是「生成视频」的 `goBlocker`，两者不一定一致（如「AI 编导暂时用不了」、需要先写要求的场景）。按规则应在按钮旁写原因。编导页的发送键 `:818-819` 同理（`title` 里放原因，旁边没有）。
5. **「创作助手做完了，成片在画布里。」不一定成立。** `:1029` 只看 `execution.status === "done"`。方案里不一定有合成成片那一步（例如只出了一段视频或几张图），这时画布里没有「成片」。主表已改为「制作已完成，结果在画布中」。
6. **「停止」的计费没有说明。** 编导卡片和视频行的「停止」（`:940`、`:974`）调 `cancelRun`。服务端对已提交给模型的文字任务按实际用量结算（`StudioWorkflowWorker` 取消分支写「已停止创作，已按模型实际用量结算」），并非全额退回。界面没有任何提示；建议按钮 title 写「停止后已产生的费用按实际用量结算」，或在停止后的状态里写明。图片、视频停止后的退款规则没有逐条核，留给用户确认。
7. 已核对、无需改：失败后「未生成的 X 不扣积分」成立（非导演台任务失败时 `credits.releaseHold` 全额释放，`run.setCost(0)`）；「改一下再试；积分没有扣」成立（`submissionRejected` 只在请求没发出或 4xx 时为真，此时没有冻结）；AI 编导按钮写「按实际用量」、没有显示 `scriptCost`（`tokenPricing.maxCost` 冻结上限只作为 `maxCost` 提交，不出现在界面上）。

## 仅手机端（不改，列出备查）

- `ip/scenes/scene-layout.tsx:212`：手机标题栏上「最近」只有图标，aria-label「最近」。
- `ip/scenes/scene-image-studio.tsx:397`、`ip/scenes/scene-video-studio.tsx:797`：手机端「最近」放在标题栏（`mobile` 分支），文字同桌面。
- `HubTabBar`（两页底部）只在手机形态显示，文字不在本批文件里。
- 本批没有只在手机端出现的其它文字；手机和桌面共用同一套组件和文案。

## 存疑（拿不准的，写出两种写法让用户选）

1. **「做成视频」**（`scene-image-studio.tsx:379`、`:524`，测试 `scene-continue.test.tsx:97-104`，README 两处）。它只是带着这张图跳到 AI 视频页，不会直接生成。
   - A：保留「做成视频」（口语，但意思准）。
   - B：「用于 AI 视频」（书面，和导航叫法对上）。
   - 不建议「生成视频」：点了并不生成，也不扣积分，按钮名会误导。
2. **「停止」→「取消生成」？**（`scene-image-studio.tsx:508`，`scene-video-studio.tsx:940`、`:974`）。规则举例「不拍了 → 取消生成」；但画布里同类按钮也叫「停止」，而且对文字任务来说停止后按实际用量结算，不完全是「取消」。
   - A：保留「停止」，title 写计费说明（见「需要核实」第 6 条）。
   - B：改「取消生成」，画布同步改。
3. **「自由出图」场景名**（`scenes.json:52`、`ip/mocks/scenes.ts:10`、测试 `scene-draft-races.test.tsx:264`、`:286-287`、`scene-continue.test.tsx:158`、`shell/rail-scene-flyout.test.tsx:18`、`:44`，PRODUCT.md / README）。规则不用「出图」，但这是场景名，不是按钮。
   - A：保留「自由出图」。
   - B：改「自由创作」（要全仓改，且服务端 `StudioPromptCallPoints.java:215` 给模型的说明也带这个词，那处不归本批）。
4. **脚本和当前设置不一致的那句话**（`scene-video-studio.tsx:661-666`，如「这版脚本是照 15 秒写的，现在要出 10 秒」「脚本里用了参考图，这个模型不看图」）。它显示在按钮旁（`:868`），同时作为 `settingsChanged` 交给服务端拼进 AI 编导的提示词（`:466`、`:679`、`:482-483`），改字会改变发给模型的内容。
   - A：不改，保留现状。
   - B：显示用一套书面句（「此脚本按 15 秒撰写，当前为 10 秒」「此脚本引用了参考图，当前模型不使用参考图」），交给服务端的另拼一份或沿用原句；需要拆开显示与提交两份字符串。
5. **素材位上的「可选」**（`scene-image-studio.tsx:411`、`scene-video-studio.tsx:747`、`:774`）。规则写「选填项标选填」，但这是上传位，不是填字。
   - A：保留「可选」。
   - B：改「选填」，和输入框下小标签（本批建议改「选填」）一致。
6. **场景「做法」几条**（`scenes.json` 各视频场景的 `structure`，在「示例」页按逗号拆成 01、02… 显示，`scene-layout.tsx:240`、`:267`）。它同时是服务端拼编导 / 交接提示词的场景正文（`StudioSceneCatalog.java:415`、`:466`），并会写进提示词库（`StudioSceneAdminService.java:110`），所以没有列进主表。个别句子读者看着别扭，如爆款复刻「再按同样的结构换成我的内容重新拍」用的是写给模型的第一人称。
   - A：不动（以模型提示为准）。
   - B：给场景加一个只供界面显示的字段（例如 `steps`），示例页改读它；需要改类型、后台场景编辑和目录校验。

---

# 第四批 A · 画布工作台（不含创作助手对话）

读过的文件（括号内为 inscope.txt 里该文件的条数，全部逐条过了一遍，有疑问的打开源码看上下文）：
ip/studio-workspace.tsx（224）、ip/studio-flow-canvas.tsx（135）、ip/studio-flow-area / image-tools / video-frames（8 / 8 / 14）、ip/studio-work-editor.tsx（78）、ip/studio-advanced-editor.tsx（69）、ip/studio-script-editor.tsx（61）、ip/studio-effect-library.tsx（60）、ip/studio-billing-dialog.tsx（54）、ip/studio-task-list.tsx（44）、ip/studio-batch-panel.tsx（39）、ip/studio-commerce.tsx（38）、ip/studio-motion-prompt.tsx（37）、ip/studio-recreation.tsx（36）、ip/studio-speech.tsx（33）、ip/studio-video-controls.tsx（32）、ip/studio-script-settings.tsx（31）、ip/studio-storyboard.tsx（30）、ip/studio-script-rich-editor.tsx（28）、ip/canvas-host.tsx（27）、ip/audio-recorder-dialog.tsx（27）、ip/studio-model-quote-dialog.tsx（23）、ip/publish/publish-dialog.tsx（23）、ip/studio-recharge-dialog.tsx（20）、ip/scoped-credits-panel.tsx（18）、ip/studio-lip-sync.tsx（16）、ip/studio-canvas-guide.tsx（15）、ip/last-run-panel.tsx（15）、ip/studio-composer-references.tsx（13）、ip/canvas-gate.tsx（13）、ip/canvas-conflict-dialog.tsx（12）、ip/studio-voice-adopt.tsx（12）、ip/studio-media-generation-state.tsx（12）、ip/studio-video-prompt-notes.tsx（10）、ip/studio-group-description.tsx（9）、ip/studio-billing-settings.tsx（9）、ip/image-lightbox.tsx（9）、ip/studio-text-composer.tsx（8）、ip/studio-node-content.tsx（8）、ip/studio-floating-panel.tsx（7）、ip/studio-duration-control.tsx（7）、ip/studio-billing-breakdown.tsx（7）、ip/saved-canvas-assets.tsx（7）、ip/studio-connection-create-menu.tsx（6）、ip/studio-material-library.tsx（5）、ip/studio-attachment-picker.tsx（5）、ip/studio-document-editor.tsx（4）、ip/common/*（8）、ip/studio-node-title.tsx（3）、ip/studio-generation-controls.tsx（3）、ip/studio-asset-mention-input.tsx（2）、ip/studio-analysis-document.tsx（2）、ip/studio-frame-crop-hint.tsx（1）；canvas-bridge/ 下除 studio-assistant-* 与 studio-video-price.ts 外全部（约 330 条：studio-video.ts 36、studio-task-title.ts 27、studio-task-status.ts 23、studio-script-markdown.ts 22、studio-video-prompt.ts 20、studio-work-clips.ts 17、video.ts 15、project-sync.ts 12、studio-nodes.ts 11、studio-ip-library.ts 11、studio-batch.ts 11、recording-audio.ts 10、studio-packaging.ts 9 等）。

说明：
- canvas-bridge 里 `studio-recreation.ts:6/18`、`studio-script.ts:13/23`、`studio-linked-inputs.ts:25`、`studio-commerce.tsx:37`、`studio-workspace.tsx:427/428/1065`、`studio-flow-image-tools.tsx:71`、`studio-motion-prompt.tsx` 的运镜描述、`studio-script-markdown.ts:9/14` 的剧本模板，都是发给模型的提示词或写进用户正文的默认内容，没列。
- `canvas-bridge/video.ts` 的请求路径（63/115/121/127/140/160）、`audio.ts`、`studio-frame-confirm.ts` 只被 vendored 画布页 `canvas/pages/canvas/project.tsx` 引用，而这个页面现在没有挂载，界面上看不到，没列。`video.ts` 的轮询/落库段与 `generation.ts` 的 `resumeRun` 仍被 `flow-legacy-tasks.ts`（恢复旧任务）用到，单列一节。
- `ip/saved-canvas-assets.tsx` 没有任何地方引用（死组件），没列；如果以后启用，「返回自由画布 ›」要改成导航里的叫法。

## 顶栏、保存与冲突

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/canvas-host.tsx:42` | 没保存上，改动还在本地 | 保存失败，改动仍在此页面 | 状态用标准叫法，去口语 |
| `ip/canvas-host.tsx:43` | 别处改过了，这里的改动没存上 | 保存冲突，此页面的改动未保存 | 同上 |
| `ip/canvas-host.tsx:58` | 这张画布在别的窗口改过了，已经换成最新内容 | 此画布已在其他窗口修改，已加载最新版本 | 书面语；与冲突弹窗新叫法一致 |
| `ip/canvas-host.tsx:88` | 画布尚未保存，已留在当前页面，请先处理保存问题 | 画布尚未保存，已留在当前页面。请重试保存后离开。 | 说清下一步；去「先」 |
| `ip/canvas-host.tsx:127` | 平台还没配可用的模型，现在生成不了。找管理员在后台加一个。 | 平台暂无可用模型，暂时无法生成。请联系管理员配置。 | 去口语 |
| `ip/canvas-host.tsx:128` | 模型列表没加载上，刷新页面再试 | 模型列表加载失败，请稍后刷新重试。 | 第一批统一写法（加载失败） |
| `ip/canvas-host.tsx:155` | 历史记录、上次发给模型、模板（title） | 历史记录、上次提交内容、模板 | 跟随 last-run-panel 改名（见存疑 1；不改名则保留） |
| `ip/canvas-host.tsx:173` | 选一种处理方式：另存一份 / 换成最新内容 / 以这里为准（title） | 选择处理方式：另存为新画布 / 加载最新版本 / 保留此页改动 | 跟随冲突弹窗改名 |
| `ip/canvas-host.tsx:186` | 再存一次。改动还在这个页面上，先别关（title） | 重新保存。改动仍在此页面，请勿关闭。 | 去口语、去「先」 |
| `ip/canvas-host.tsx:198` | 已发布为 {publishedAvatarId}，点开去资产库看（title） | 已发布到资产库，点击查看 | 不暴露内部编号；去口语 |
| `ip/canvas-host.tsx:201` | 已发布 · {publishedAvatarId} | 已发布 · 查看资产 | 顶栏直接显示数字人内部编号（见「需要核实」2） |
| `ip/canvas-host.tsx:230` | 画布暂时无法打开 | 画布加载失败 | 第一批统一写法；下方已有「重新加载」按钮和错误详情 |
| `ip/canvas-host.tsx:253` | 这里的改动已另存为新画布，{打开看看} | 此页面的改动已另存为新画布，{打开} | 去「看看」 |
| `ip/canvas-conflict-dialog.tsx:28` | 另存一份，再换成最新内容 | 另存为新画布并加载最新版本 | 按钮去「再」，说清结果 |
| `ip/canvas-conflict-dialog.tsx:28` | 这里的改动存成一张新画布，这张画布换成别处存好的那份。两边都不丢。 | 此页面的改动另存为新画布，当前画布加载其他窗口保存的版本，两份内容都会保留。 | 去口语 |
| `ip/canvas-conflict-dialog.tsx:29` | 换成最新内容 | 加载最新版本 | 标准叫法 |
| `ip/canvas-conflict-dialog.tsx:29` | 用别处存好的那份。这里没存上的改动会丢掉。 | 使用其他窗口保存的版本，此页面未保存的改动将丢失。 | 去口语 |
| `ip/canvas-conflict-dialog.tsx:30` | 以这里为准 | 保留此页改动 | 「以这里为准」看不出动作 |
| `ip/canvas-conflict-dialog.tsx:30` | 把这里的改动存上去，别处刚存的那份会被覆盖。 | 保存此页面的改动，其他窗口保存的版本将被覆盖。 | 去口语 |
| `ip/canvas-conflict-dialog.tsx:48` | 刚才别处又存了一版。再选一次。 | 其他窗口又保存了新版本，请重新选择。 | 去口语 |
| `ip/canvas-conflict-dialog.tsx:64` | 这张画布在别处被改过了（弹窗标题） | 此画布已在其他窗口修改 | 书面语 |
| `ip/canvas-conflict-dialog.tsx:66` | 你可能在另一个窗口或另一台设备上也打开了这张画布，那边的改动已经存好。这里还有没存上的改动，两份内容不能自动合并，选一种处理方式： | 此画布可能已在其他窗口或设备上修改并保存。此页面还有未保存的改动，两份内容无法自动合并，请选择处理方式： | 去口语 |
| `ip/canvas-conflict-dialog.tsx:87` | 先关掉去画布上看一眼也行，顶栏的「处理冲突」能再打开这里。关掉之前这里的改动不会自动保存。 | 关闭后可点击顶栏「处理冲突」重新打开。处理冲突前，此页面的改动不会自动保存。 | 去口语；原文「关掉之前」与行为不符，冲突状态下自动保存一直停着（project-sync 测试 288 行），不是只在关闭前 |
| `canvas-bridge/project-sync.ts:307` | 上一次的改动还在保存中。请等待原保存完成，再重新加载画布。 | 上一次的改动仍在保存中，请等待保存完成后重新加载画布。 | 去「再」 |
| `canvas-bridge/project-sync.ts:337` | 这个项目打不开 | 画布加载失败，请稍后刷新重试。 | 这里打开的是画布不是「项目」页；第一批统一写法 |
| `canvas-bridge/project-sync.ts:554` | 没拿到最新内容，稍后再试 | 最新版本加载失败，请重试。 | 去口语 |
| `canvas-bridge/project-sync.ts:561,563` | {snap.title} · 另一份 | {snap.title} · 副本 | 新画布名，标准叫法 |
| `canvas-bridge/project-sync.ts:564` | 另存没成功，这里的改动还在 | 另存失败，此页面的改动仍保留 | 去口语 |
| `canvas-bridge/project-sync.ts:567` | 已另存一份，但没拿到这张画布的最新内容，稍后再试 | 已另存为新画布，但当前画布的最新版本加载失败，请重试。 | 去口语 |
| `canvas-bridge/project-sync.ts:574` | 没拿到画布的当前版本，稍后再试 | 画布当前版本加载失败，请重试。 | 去口语 |
| `canvas-bridge/publish-gate.ts:24` | 这张画布在别处被改过了。先点顶栏的「处理冲突」选一种处理方式，再发布。 | 此画布已在其他窗口修改。请点击顶栏「处理冲突」完成处理后发布。 | 点击写法；去先/再 |
| `canvas-bridge/publish-gate.ts:27` | 画布还没保存上，发布会用到服务端上的旧内容。先点顶栏的「重试保存」，成功之后再发布。 | 画布尚未保存，此时发布将使用上一次保存的内容。请点击顶栏「重试保存」，保存成功后发布。 | 去口语；「服务端」是开发词 |
| `canvas-bridge/studio-save.ts:15` | 这张画布在别处被改过了，先处理顶栏里的保存冲突，再继续创作 | 此画布已在其他窗口修改，请处理顶栏的保存冲突后继续创作 | 去先/再 |
| `canvas-bridge/studio-save.ts:16` | 画布保存失败，请先重试保存 | 画布保存失败，请重试保存 | 去「先」 |
| `canvas-bridge/generation.ts:188` | 画布还没打开，稍等一下再试 | 画布尚未打开，请稍后重试 | 与 `studio-save.ts:10`、`canvas-recovery.ts:8` 同句统一 |
| `ip/last-run-panel.tsx:24` | 看这次实际发给模型的提示词和参考图（title） | 查看实际发送给模型的提示词和参考图 | 去口语 |
| `ip/last-run-panel.tsx:60` | · 已送给模型 / · 没用上{（原因）} | · 已发送 / · 未使用{（原因）} | 状态用书面语 |
| `ip/last-run-panel.tsx:75` | （这次运行没有留下提示词） | （本次运行未记录提示词） | 书面语 |
| `ip/last-run-panel.tsx:78-80` | 你写的那段在中间，前后是系统按模板补的构图与负面词。参考图决定「像谁」，提示词里对长相、发型、穿着的描述会覆盖参考图里的对应部分 —— 想保留参考图的样子，就别在提示词里把它重新描述一遍。 | 你写的内容在中间，前后是系统按模板补充的构图与负面词。参考图决定人物长相，提示词中对长相、发型、穿着的描述会覆盖参考图的对应部分。如需保留参考图的样子，请勿在提示词中重新描述。 | 去「——」，去口语 |

## 节点、左栏与空画布引导

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-flow-canvas.tsx:91` | AI 生成的（title） | AI 生成 | 标准标注 |
| `ip/studio-flow-canvas.tsx:105` | 上传处理中… | 上传中… | 同文件 91/95 已用「上传中…」，统一（测试见下） |
| `ip/studio-flow-canvas.tsx:109` | 优化稿有需要留意的地方，选好再出片 | 优化稿有需要确认的地方，请选择后生成视频 | 去「出片」「再」 |
| `ip/studio-flow-canvas.tsx:109` | 去确认 | 确认 | 去「去」 |
| `ip/studio-flow-canvas.tsx:338` | 生成中的节点保留，请先在任务中心处理原任务 | 生成中的节点已保留，请在「创作任务」中处理原任务 | 画布里的任务面板叫「创作任务」（`studio-workspace.tsx:1233/1322`），「任务中心」是账号页的另一个入口 |
| `ip/studio-flow-canvas.tsx:351,357` | 素材正在上传，请完成后再添加 | 素材正在上传，请上传完成后添加 | 去「再」 |
| `ip/studio-flow-canvas.tsx:353,359` 与 `canvas-bridge/studio-image-upload.ts:16`、`studio-video-upload.ts:20` | 当前节点正在生成，请等待任务完成后再替换视频 / 再替换图片 | 当前节点生成中，请等待任务完成后替换视频 / 替换图片 | 去「再」，状态用「生成中」 |
| `ip/studio-workspace.tsx:1119` | 把这个节点带进对话，让助手改它或接着做（title） | 将此节点加入对话，由助手修改或继续创作 | 去口语（扫描命中） |
| `ip/studio-workspace.tsx:1232` | 和助手说一句，它会把每一步放进画布（title） | 描述需求，助手会把每一步放进画布 | 去口语 |
| `ip/studio-canvas-guide.tsx:12` | 写一句描述出图，可以加参考图 | 输入描述生成图片，可添加参考图 | 去「出图」 |
| `ip/studio-canvas-guide.tsx:13` | 用描述或一张首帧出视频 | 根据描述或首帧图生成视频 | 去「出视频」 |
| `ip/studio-canvas-guide.tsx:14` | 选一个声音，把台词念出来 | 选择声音，为台词配音 | 去口语 |
| `ip/studio-canvas-guide.tsx:29` | 这张画布还是空的 | 画布还没有内容 | 空态写缺什么（测试见下） |
| `ip/studio-canvas-guide.tsx:30` | 在助手里说想做什么，它会把每一步放进画布。也可以自己选一个开始： | 向助手描述需求，助手会把每一步放进画布。也可以从下方选择： | 去口语 |
| `ip/studio-canvas-guide.tsx:31` | 和助手开始 | 与助手对话 | 动词 + 对象（测试见下） |
| `ip/studio-canvas-guide.tsx:32` | 自己选一个开始（aria-label） | 选择开始方式 | 去口语 |
| `ip/studio-canvas-guide.tsx:38` | 双击画布空白处也能添加 · | 双击画布空白处也可添加 · | 书面语 |
| `ip/studio-flow-area.tsx:56` | 把节点拖进来 | 将节点拖入此区域 | 书面语 |
| `ip/studio-flow-image-tools.tsx:77` | 正在读取图片（Modal 标题与 aria-label） | 正在加载图片… | 第一批统一写法 |
| `ip/studio-flow-image-tools.tsx:79` | 下一步：确认生成 | 下一步 | 按钮已在局部重绘弹窗里，下一步才是确认生成；或保留（见存疑 4） |
| `ip/studio-flow-video-frames.tsx:55` | 视频正在生成，完成后再抽帧 | 视频生成中，完成后可抽帧 | 状态用「生成中」，去「再」 |
| `ip/studio-flow-video-frames.tsx:90` 与 `canvas-bridge/studio-video-frame.ts:34` | 无法读取这条视频，请重试 / 这条视频无法在浏览器里读取，请换一条 MP4 再试 | 视频加载失败，请重试。 / 浏览器无法加载此视频，请更换 MP4 视频后重试。 | 统一写法 |
| `ip/studio-flow-video-frames.tsx:93` 与 `canvas-bridge/studio-video-frame.ts:80` | 没能截出画面，请重试 | 截取画面失败，请重试。 | 去口语 |
| `canvas-bridge/studio-video-frame.ts:35` | 读取视频超时，请重试 | 视频加载超时，请重试。 | 统一写法 |
| `canvas-bridge/studio-video-frame.ts:70` | 这条视频没有画面，无法截取 | 此视频没有画面，无法截取 | 书面语 |
| `canvas-bridge/studio-video-frame.ts:74` | 浏览器不支持截取画面，请换个浏览器再试 | 当前浏览器不支持截取画面，请更换浏览器后重试 | 去口语 |
| `ip/studio-flow-video-frames.tsx:103` | 提交 | 截取 | 按钮写具体动作，免费操作不是「提交」 |
| `ip/studio-flow-video-frames.tsx:105` | 截取一帧画面，生成一张连着这条视频的图片。 | 截取一帧画面，生成一张与此视频相连的图片。 | 去口语 |
| `ip/studio-flow-video-frames.tsx:110` | 当前帧是画布上这条视频播放到的位置，可以先拖动进度条再提交。 | 当前帧为画布上此视频的播放位置，可拖动进度条调整。 | 去先/再 |
| `ip/studio-flow-video-frames.tsx:111` | 演示模式不能抽帧，连上服务后可用。 | 演示模式不支持抽帧。 | 去口语（测试见下） |
| `ip/studio-composer-references.tsx:28` | 画布还没有素材，请先上传图片、视频或音频。 | 画布中暂无素材，请上传图片、视频或音频。 | 空态写法，去「先」 |
| `ip/studio-workspace.tsx:1207` | 点击画布素材添加参考，完成后点击“完成参考选择”。 | 点击画布素材添加参考，完成后点击「完成参考选择」。 | 全角直角引号，与全站一致 |
| `canvas-bridge/studio-node-failure.ts:34` | 这个模型已不可用，请换一个模型再生成 | 此模型已不可用，请更换模型后重新生成 | 去口语 |
| `canvas-bridge/studio-node-failure.ts:35` | 没有生成出来，可以修改后重试 | 生成失败，可修改后重试 | 状态用「失败」 |
| `canvas-bridge/signed-audio.tsx:31` | 读不到这段音频 | 音频加载失败 | 第一批统一写法，同文件 32 行已是「音频加载失败」 |
| `canvas-bridge/image-storage.ts:116` | 图片地址暂时无法读取 | 图片加载失败，请重试 | 统一写法（经 SignedImage/SignedVideo/SignedAudio 换签失败时显示） |

## 生成面板（图片 / 视频 / 剧本 / 配音 / 口型 / 复刻）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-workspace.tsx:607` | 已按描述改好设置，请确认费用后再生成。 | 已按描述更新设置，请确认费用后生成。 | 去口语、去「再」 |
| `ip/studio-workspace.tsx:693` | 上次用的模型已不可用，请换一个模型再生成。 | 上次使用的模型已不可用，请更换模型后生成。 | 去口语 |
| `ip/studio-workspace.tsx:884` | 上次用的模型已不可用，这次改用「{name}」，费用以下方为准。 | 上次使用的模型已不可用，已改用「{name}」，费用以下方为准。 | 去口语 |
| `ip/studio-workspace.tsx:940` | 这个模型只支持一张首帧图，请移除多余素材或切回支持首尾帧 / 全能参考的模型 | 当前模型只支持一张首帧图，请移除多余素材，或改用支持首尾帧 / 全能参考的模型 | 书面语 |
| `ip/studio-workspace.tsx:1010`、`canvas-bridge/studio-video.ts:146,173` | 这个模型不支持所选视频模式，请重新选择 | 当前模型不支持所选视频模式，请重新选择 | 书面语，三处统一 |
| `canvas-bridge/studio-video.ts:16` | 所选视频模式已不在当前模型的开放范围，请重新选择 | 当前模型不支持所选视频模式，请重新选择 | 「开放范围」是后台配置词 |
| `canvas-bridge/studio-video.ts:29` | 当前清晰度不在所选模型的开放范围，请在参数设置中重新选择 | 当前模型不支持所选清晰度，请在参数设置中重新选择 | 同上 |
| `canvas-bridge/studio-video.ts:37` | 当前画幅不在所选模型的开放范围，请在参数设置中重新选择 | 当前模型不支持所选画幅，请在参数设置中重新选择 | 同上 |
| `canvas-bridge/studio-video.ts:176` | 请先写提示词 | 请输入提示词 | 去「先」 |
| `canvas-bridge/studio-video.ts:177` | 这个模型最多接收 {n} 字，请缩短提示词 | 当前模型最多支持 {n} 字，请缩短提示词 | 书面语 |
| `ip/studio-workspace.tsx:1060,1194`、`ip/studio-speech.tsx:49`、`ip/studio-lip-sync.tsx:39`、`ip/studio-batch-panel.tsx:88,89`、`ip/studio-text-composer.tsx:30`、`ip/studio-script-editor.tsx:152` | AI 处理，会消耗积分（title） | AI 处理，将消耗积分 | 书面语，全部同步 |
| `ip/studio-workspace.tsx:1099` | 口型片段已提取，原始对照视频保留在版本中；未再次扣积分 | 口型片段已提取，原始对照视频保留在版本中，未额外扣除积分。 | 书面语 |
| `ip/studio-workspace.tsx:1302` | 已保存 {name} · v{version}；未再次扣积分 | 已保存 {name} · v{version}，未额外扣除积分 | 同上 |
| `ip/studio-workspace.tsx:1350` | 按描述改设置 | 按描述修改设置 | 书面语 |
| `ip/studio-workspace.tsx:1352` | 模型按设置出片，描述里的规格不会自动生效。改设置后费用可能变化，会先给你看新的费用。 | 模型按设置生成视频，描述中的规格不会自动生效。修改设置后费用可能变化，确认前会显示新费用。 | 去「出片」，去口语 |
| `ip/studio-video-controls.tsx:72` | 生成前先按 H3 官方写法优化提示词，台词保留原文，会额外消耗少量积分。点一下关闭 | 生成前按 H3 官方写法优化提示词，台词保留原文，按实际用量另行扣费。点击关闭 | 按 Token 结算写「按实际用量」；点击写法 |
| `ip/studio-video-controls.tsx:72` | 已关闭：按原文发给视频模型。点一下开启 | 已关闭：按原文发送给视频模型。点击开启 | 点击写法 |
| `ip/studio-video-controls.tsx:84` | 提示词优化没成功 | 提示词优化失败 | 状态用「失败」 |
| `ip/studio-video-controls.tsx:84` | 优化稿太长，视频模型收不下 | 优化稿超出视频模型的长度上限 | 去口语（测试见下；`director/director-output.tsx` 同句由导演台批次处理） |
| `ip/studio-video-controls.tsx:84` | 优化稿有需要留意的地方 | 优化稿有需要确认的地方 | 与节点上提示同步 |
| `ip/studio-video-prompt-notes.tsx:32` | 智能优化 · 没用上 | 智能优化 · 未使用 | 状态用书面语 |
| `ip/studio-video-prompt-notes.tsx:32` | 智能优化 · 发给模型的英文 | 智能优化 · 发送给模型的英文 | 书面语 |
| `canvas-bridge/studio-video-prompt.ts:149` | 描述里提到了图片，这次没有用上图片 | 描述中提到了图片，但本次未使用图片 | 弹窗标题，书面语（测试见下） |
| `canvas-bridge/studio-video-prompt.ts:150` | 描述里提到了尾帧，当前模式只用首帧 | 描述中提到了尾帧，当前模式只使用首帧 | 同上 |
| `canvas-bridge/studio-video-prompt.ts:150` | 描述里提到了 {needed} 张图，这次只用了 {bound} 张 | 描述中提到了 {needed} 张图片，本次只使用了 {bound} 张 | 同上 |
| `canvas-bridge/studio-video-prompt.ts:152` | 这个模型只能按文字生成，要用图片请换一个模型。 | 当前模型只支持文字生成，如需使用图片，请更换模型。 | 去口语 |
| `canvas-bridge/studio-video-prompt.ts:153` | 这个模型一次最多用 {most} 张图，放不下描述里的 {needed} 张。可以少用几张，或者换一个模型。 | 当前模型最多支持 {most} 张图片，少于描述中的 {needed} 张。请减少图片或更换模型。 | 去口语 |
| `canvas-bridge/studio-video-prompt.ts:154` | 这个模型没有能用尾帧的模式，可以换一个支持首尾帧的模型，或者去掉描述里的尾帧。 | 当前模型不支持尾帧，请更换支持首尾帧的模型，或删除描述中的尾帧。 | 去口语 |
| `canvas-bridge/studio-video-prompt.ts:155` | 这个模型没有能按描述使用这些图片的模式，可以换一个模型。 | 当前模型无法按描述使用这些图片，请更换模型。 | 去口语 |
| `canvas-bridge/studio-video-prompt.ts:156` | 要照着图片出片，改用{name}，再选好要用的图片。 | 如需按图片生成视频，请改用{name}并选择图片。 | 去「出片」「再」 |
| `canvas-bridge/studio-video-prompt.ts:157` | 要用上尾帧，改用{name}；这个模式还需要再选一张首帧图。 | 如需使用尾帧，请改用{name}，此模式还需要选择一张首帧图。 | 去口语 |
| `canvas-bridge/studio-video-prompt.ts:158` | 要照着图片出片，改用{name}，再选好这 {needed} 张图片。 | 如需按图片生成视频，请改用{name}并选择这 {needed} 张图片。 | 去「出片」「再」 |
| `canvas-bridge/studio-video-prompt.ts:159` | 这个模型没有能放下 {needed} 张图、又锁定首帧尾帧的模式。改用{name}能用上这些图，但它们只作参考，不会锁定首帧或尾帧。 | 当前模型无法在使用 {needed} 张图片的同时锁定首帧和尾帧。改用{name}可使用这些图片，但仅作参考，不会锁定首帧或尾帧。 | 去口语 |
| `canvas-bridge/studio-video-prompt.ts:160` | 这个模型只能把图片当作{首帧和尾帧/首帧}用。改用{name}后，图片会成为视频的{开头和结尾/第一帧}。 | 当前模型只能将图片用作{首帧和尾帧/首帧}。改用{name}后，图片将作为视频的{开头和结尾/第一帧}。 | 书面语 |
| `canvas-bridge/studio-video-prompt.ts:163` | {「图1」…}写在描述里只是文字，模型看不到画布上的图片。 | {「图1」…}在描述中只是文字，模型无法看到画布上的图片。 | 书面语 |
| `canvas-bridge/studio-video-prompt.ts:164` | 画布上还没有图片，可以先上传，或从人物库里选。 | 画布中暂无图片，可上传或从人物库选择。 | 去「先」 |
| `canvas-bridge/studio-video-prompt.ts:164` | 只想按文字出片，可以直接生成。 | 如只按文字生成视频，可直接生成。 | 去「出片」 |
| `canvas-bridge/studio-video-prompt.ts:165` | 去选择视频模式 | 选择视频模式 | 去「去」（测试见下） |
| `ip/studio-script-settings.tsx:15` | 可选，最多 3 种（placeholder） | 选填，最多 3 种 | 选填项写「选填」 |
| `ip/studio-text-composer.tsx:35` | 告诉 AI 你想怎么改，例如：起一个标题、缩短这段、让语气更自然。（placeholder） | 描述修改要求，例如：起一个标题、缩短这段、让语气更自然。 | 占位去口语 |
| `ip/studio-speech.tsx:47` | 临时音色不会改变人物默认声音。生成满意后，选中音频并点击“设为人物声音”，保存音色、风格和真实试听。 | 临时音色不会改变人物默认声音。生成满意后，选中音频并点击「设为人物声音」，保存音色、风格和真实试听。 | 全角直角引号 |
| `ip/studio-speech.tsx:47` | 官方预设音色无需训练；专属声音克隆仍需接入。 | 官方预设音色无需训练；暂不支持专属声音克隆。 | 「仍需接入」是开发进度，不进界面 |
| `ip/studio-speech.tsx:57` | 尚未配置配音模型，请在后台绑定「Studio 配音」。 | 配音暂不可用，请联系管理员配置配音模型。 | 用户没有后台，不让用户做不该他做的事 |
| `ip/studio-lip-sync.tsx:44` | 尚未配置口型模型，请在后台绑定「Studio 口型同步」。 | 口型同步暂不可用，请联系管理员配置口型模型。 | 同上 |
| `ip/studio-lip-sync.tsx:39` | 先选择视频和配音（按钮文字） | 请选择视频和配音 | 去「先」 |
| `ip/studio-lip-sync.tsx:48` | 先在画布生成 WAV 配音（placeholder） | 请在画布中生成 WAV 配音 | 去「先」 |
| `ip/studio-lip-sync.tsx:50` | 视频需有清晰、少遮挡的单人正脸，15–60fps。 | 视频需有清晰、少遮挡的单人正脸，帧率 15–60 fps。 | 数字与单位留空格 |
| `ip/studio-voice-adopt.tsx:23` | 先将人物图片加入 IP，再为人物保存声音。 | 保存声音前，需将人物图片加入 IP。 | 去先/再 |
| `ip/studio-commerce.tsx:24` | 确认角色、商品与卖点，先生成可修改的脚本，再进入同一故事板制作。 | 确认角色、商品与卖点后生成可修改的脚本，并在故事板中继续制作。 | 去先/再 |
| `ip/studio-commerce.tsx:27` | 先在画布引用或定稿 IP（placeholder） | 请在画布中引用或定稿 IP | 去「先」 |
| `ip/studio-commerce.tsx:30` | 可在画布“口型同步”入口选择人物视频与配音。 / 专属音色尚未配置，可在“配音”入口查看官方固定音色。 | 可在画布「口型同步」入口选择人物视频与配音。 / 暂无专属音色，可在「配音」入口查看官方固定音色。 | 全角直角引号；「尚未配置」是后台词 |
| `ip/studio-recreation.tsx:106` | 尚无可用的视频画面分析模型，请检查模型能力及积分售价配置。 | 暂无可用的视频分析模型，请联系管理员配置。 | 「模型能力、积分售价配置」是后台词 |
| `ip/studio-recreation.tsx:120` | 原参考视频已删除或替换。请从新的视频重新进入解析。 | 原参考视频已删除或替换，请选择新的视频重新解析。 | 书面语 |
| `ip/studio-effect-library.tsx:76` | 通用描述，可用于所有已配置视频模型 | 通用描述，适用于所有视频模型 | 「已配置」是后台词 |
| `ip/studio-effect-library.tsx:107` | 所有已配置视频模型 | 所有视频模型 | 同上 |
| `ip/studio-effect-library.tsx:78` | 当前画布没有可用图片，可不填（placeholder） | 当前画布暂无可用图片，此项选填 | 选填写法 |
| `ip/studio-effect-library.tsx:98` | 还没有匹配的收藏 / 还没有匹配的使用记录 / 还没有匹配的个人特效 / 没有匹配的特效 | 暂无匹配的收藏 / 暂无匹配的使用记录 / 暂无匹配的个人特效 / 暂无匹配的特效 | 空态写法统一 |
| `ip/studio-effect-library.tsx:99` | 在特效条目上点击收藏，便可在这里再次找到。 | 收藏的特效会显示在这里。 | 去冗余 |
| `ip/studio-effect-library.tsx:99` | 换个关键词，或取消“仅适用当前模型”查看其他特效。 | 请更换关键词，或取消「仅适用当前模型」查看其他特效。 | 去口语，直角引号 |
| `ip/studio-effect-library.tsx:109` | 当前模型不适用。关闭特效库后选择适用模型，再应用此特效。 | 此特效不适用于当前模型。请关闭特效库，更换为适用模型后应用。 | 去「再」 |
| `ip/audio-recorder-dialog.tsx:123` | 读完后可以结束录音 | 朗读完成后可结束录音 | 书面语 |
| `ip/audio-recorder-dialog.tsx:123` | 跟着高亮往下读 | 请跟随高亮朗读 | 去口语 |
| `ip/audio-recorder-dialog.tsx:123,139` | 准备开口 | 准备开始 | 去口语 |
| `ip/audio-recorder-dialog.tsx:123` | 录好了，先听一听 | 录音完成，请试听 | 去「先」「一听」 |
| `ip/audio-recorder-dialog.tsx:129` | 找个安静的地方，用平时说话的声音读一遍。只录你自己或已获授权的声音，不放背景音乐。 | 请在安静的环境中，用平时说话的声音朗读一遍。仅录制本人或已获授权的声音，不要播放背景音乐。 | 去口语 |
| `ip/audio-recorder-dialog.tsx:131` | 跟着读，约 15 秒 | 朗读以下文字，约 15 秒 | 去口语 |
| `ip/audio-recorder-dialog.tsx:157` | 再读 | 重新录制 | 标准叫法（同文件 74/80 已用「重新录制」） |
| `canvas-bridge/recording-audio.ts:68` | 录音不足 10 秒，请跟着文字完整读一遍再保存。 | 录音不足 10 秒，请完整朗读示例文字后保存。 | 去口语 |
| `canvas-bridge/recording-audio.ts:78` | 麦克风权限未开启，请在浏览器的网站设置中允许使用麦克风，再试一次。 | 麦克风权限未开启，请在浏览器的网站设置中允许使用麦克风后重试。 | 去「再试一次」 |
| `ip/studio-script-editor.tsx:95` | 请先采纳或放弃当前 AI 版本，再继续改稿 | 请采纳或放弃当前 AI 版本后继续改稿 | 去先/再 |
| `ip/studio-script-editor.tsx:140` | 说说你的想法，AI 会基于当前剧本给出修改稿，由你决定是否采纳。 | 输入修改想法，AI 将基于当前剧本给出修改稿，由你决定是否采纳。 | 去口语 |
| `ip/studio-script-editor.tsx:145` | 正文在等待回复时有了新修改，请先比较两个版本。 | 等待回复期间正文有新的修改，请比较两个版本。 | 去「先」 |
| `canvas-bridge/studio-script-markdown.ts:44` | 分集请使用“分集 / 人物标题”样式，名称如“第 1 集 · 标题”，集号需唯一且在 1–50 之间 | 分集请使用「分集 / 人物标题」样式，名称如「第 1 集 · 标题」，集号需唯一且在 1–50 之间 | 直角引号 |
| `canvas-bridge/studio-script-markdown.ts:68` | AI 回复期间正文已修改。请先比较差异，再明确采用 AI 版本。 | AI 回复期间正文已修改，请比较差异后确认是否采用 AI 版本。 | 去先/再 |
| `canvas-bridge/studio-packaging.ts:31` | 第 {n} 条字幕请使用“开始秒-结束秒: 文字” | 第 {n} 条字幕请使用「开始秒-结束秒: 文字」格式 | 直角引号 |

## 任务与进度

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-task-list.tsx:28` | 完成（筛选标签） | 已完成 | 状态标准叫法，与同文件 44 行状态一致 |
| `ip/studio-task-list.tsx:37` | 提交结果尚未确认，先查询原任务 | 提交结果尚未确认，请确认原任务 | 去「先」，与按钮「确认原任务」一致 |
| `ip/studio-task-list.tsx:65` | 已读取最新状态，未重新生成或扣费。 | 已更新为最新状态，未重新生成或扣费。 | 书面语 |
| `ip/studio-task-list.tsx:68` | 当前没有进行中的任务 / 没有失败的任务 / 还没有完成的任务 | 暂无进行中的任务 / 暂无失败的任务 / 暂无已完成的任务 | 空态统一写法（「还没有创作任务」保留） |
| `ip/studio-batch-panel.tsx:51` | 有镜头生成失败。检查错误后，可只重试失败步骤。 | 部分镜头生成失败。查看错误后，可仅重试失败步骤。 | 书面语 |
| `ip/studio-batch-panel.tsx:89` | 只重试失败步骤并继续 | 重试失败步骤并继续 | 按钮去「只」 |
| `canvas-bridge/studio-batch.ts:12` | 请选择 1 到 12 个镜头 | 请选择 1–12 个镜头 | 与全站区间写法一致（选改） |

## 成片与剪辑

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-work-editor.tsx:68` | 先勾选要放进成片的片段 | 请勾选要加入成片的片段 | 去「先」「放进」 |
| `ip/studio-work-editor.tsx:69,157` | 选的配音已经不在画布上了，重新选一条或改回片段原声 | 所选配音已移出画布，请重新选择配音或保留片段原声 | 去口语；与 `studio-workspace.tsx:778` 同义句统一 |
| `ip/studio-work-editor.tsx:70` | 配音比成片长，合成不了 | 配音长于成片，无法合成 | 去口语（测试见下） |
| `ip/studio-work-editor.tsx:71` | 品牌、标题、结尾提示和字幕都没填，填一项或关掉文字 | 品牌、标题、结尾提示和字幕均未填写，请至少填写一项或取消添加文字 | 去口语 |
| `ip/studio-work-editor.tsx:97` | 在画布上传视频，或者先生成几段视频，再回来排顺序、配声音、合成。 | 在画布中上传或生成视频后，可在此排列顺序、添加声音并合成。 | 去先/再 |
| `ip/studio-work-editor.tsx:98` | 去画布添加片段 / 生成一段视频 / 去故事板 | 添加片段 / 生成视频 / 打开故事板 | 按钮去「去」「一段」 |
| `ip/studio-work-editor.tsx:110` | 勾选的片段按这个顺序拼成成片，{拖动或}用箭头调整顺序。 | 勾选的片段按此顺序合成，可{拖动或}用箭头调整顺序。 | 书面语 |
| `ip/studio-work-editor.tsx:127` | 在左边预览里从这一段开始看 / 在左边单独看这一段（title） | 从此片段开始预览 / 单独预览此片段 | 去口语、去方位词 |
| `ip/studio-work-editor.tsx:135` | 其他片段是照着它做的，默认不放进成片。 | 其他片段据此生成，默认不加入成片。 | 书面语（测试见下） |
| `ip/studio-work-editor.tsx:139` | 把「{label}」放进成片（aria-label） / 放进成片 | 将「{label}」加入成片 / 加入成片 | 书面语（测试见下） |
| `ip/studio-work-editor.tsx:151` | 成片用哪条声音 | 成片音轨 | 字段标签用名词 |
| `ip/studio-work-editor.tsx:156` | 画布上还没有配音，成片会保留片段原声。 | 画布中暂无配音，成片将保留片段原声。 | 空态写法 |
| `ip/studio-work-editor.tsx:156` | 去做一条配音 | 生成配音 | 按钮动词 + 对象 |
| `ip/studio-work-editor.tsx:161` | 配音 {x}，比成片长 {y}，合成不了。换一条短一点的配音，或者多放几段片段。 | 配音 {x}，长于成片 {y}，无法合成。请更换较短的配音，或加入更多片段。 | 去口语 |
| `ip/studio-work-editor.tsx:162` | 配音比成片短 {x}，最后这一段没有声音。 | 配音短于成片 {x}，结尾部分将没有声音。 | 去口语 |
| `ip/studio-work-editor.tsx:163` | 换成配音后，片段原来的声音不再保留；人物口型不会跟着配音改。 | 使用配音后，片段原声将不再保留，人物口型不会随配音变化。 | 去口语 |
| `ip/studio-work-editor.tsx:175` | 比如：点击下方链接了解更多（placeholder） | 例如：点击下方链接了解更多 | 占位例子统一用「例如」 |
| `ip/studio-work-editor.tsx:178` | 清空字幕后可以按片段重新填时间 / 片段时长还没读到（title） | 清空字幕后可按片段重新填写时间 / 正在读取片段时长 | 去口语 |
| `ip/studio-work-editor.tsx:179` | 按片段填好时间 | 按片段填写时间 | 去「好」（测试见下） |
| `ip/studio-work-editor.tsx:181` | 每行一条，写成「开始秒-结束秒: 字幕」（placeholder 第一行） | 每行一条，格式为「开始秒-结束秒: 字幕」 | 书面语 |
| `ip/studio-work-editor.tsx:183` | 成片共 {x}，字幕不要超过这个时间。字幕按你写的时间出现，不会自动识别台词。 | 成片共 {x}，字幕时间不能超过成片时长。字幕按填写的时间显示，不会自动识别台词。 | 书面语 |
| `ip/studio-work-editor.tsx:185` | 品牌和标题在画面左上角，结尾提示在底部，整条成片都显示。左边预览能看到大概位置，合成后以成片为准。 | 品牌和标题显示在画面左上角，结尾提示显示在底部，全片持续显示。预览中的位置仅供参考，以合成后的成片为准。 | 去口语、去方位词 |
| `ip/studio-work-editor.tsx:193` | 这份成片在高级编辑里改过 | 此成片已在高级编辑中修改 | 书面语 |
| `ip/studio-work-editor.tsx:194` | 上次保存 {time}，在高级编辑里导出成片。上面的设置不再生效。 | 上次保存于 {time}，请在高级编辑中导出成片，以上设置不再生效。 | 书面语 |
| `ip/studio-work-editor.tsx:194,198` | 高级编辑要在电脑上打开 | 高级编辑仅支持电脑版 | 书面语 |
| `ip/studio-work-editor.tsx:198` | 掐头去尾、切开、加文字和字幕，再导出（title） | 裁剪、分割、添加文字和字幕后导出 | 去口语 |
| `ip/studio-work-editor.tsx:200` | 还没选片段 | 未选择片段 | 书面语 |
| `ip/studio-work-editor.tsx:201` | 合成不收模型积分 | 合成不消耗积分 | 与成片合成免费的真实行为一致，书面语 |
| `ip/studio-work-editor.tsx:212` | 合成好的作品（标题与 aria-label） | 已合成的作品 | 书面语；`studio-advanced-editor.tsx:330` 引用此标题，同步改 |
| `ip/studio-work-editor.tsx:214` | 正在合成，可以先回画布继续做。 | 合成中，可返回画布继续创作。 | 状态用「…中」，去先/回 |
| `ip/studio-work-editor.tsx:271` | 勾选片段后，在这里连续看一遍 | 勾选片段后可在此连续预览 | 去口语 |
| `ip/studio-work-editor.tsx:280` | 正在单独看「{name}」，它不在成片里。 | 正在单独预览「{name}」，此片段未加入成片。 | 书面语 |
| `ip/studio-work-editor.tsx:280` | 回到成片预览 | 返回成片预览 | 第一批「返回 X」 |
| `ip/studio-work-editor.tsx:286` | 从第 {n} 段开始看（aria-label） | 从第 {n} 段开始预览 | 书面语 |
| `ip/studio-work-editor.tsx:290` | 这里播的是一键成片的顺序。高级编辑里剪过的版本，请在高级编辑里播放。 | 此处按一键成片的顺序播放。高级编辑中剪辑的版本，请在高级编辑中播放。 | 书面语 |
| `ip/studio-work-editor.tsx:291` | 预览把勾选的片段按顺序连着放{，配音跟着一起放}。合成后的画面和文字以成片为准。 | 预览按顺序连续播放勾选的片段{，并同步播放配音}。画面和文字以合成后的成片为准。 | 去口语 |
| `ip/studio-workspace.tsx:814` | 还有一项操作在提交，稍等一下再导出 | 有操作正在提交，请稍后导出 | 去「一下」「再」 |
| `ip/studio-workspace.tsx:817` | 高级编辑里的剪辑（裁剪、文字、音轨等）会丢掉，已经导出的作品不受影响。 | 高级编辑中的剪辑（裁剪、文字、音轨等）将被清除，已导出的作品不受影响。 | 确认弹窗说清后果，书面语 |
| `ip/studio-advanced-editor.tsx:47` | 画布里的配音和音乐 | 画布中的配音和音乐 | 书面语（48/49 同理） |
| `ip/studio-advanced-editor.tsx:48` | 加一段文字 | 添加文字 | 去「一段」 |
| `ip/studio-advanced-editor.tsx:49` | 加一条字幕 | 添加字幕 | 去「一条」 |
| `ip/studio-advanced-editor.tsx:172` | 画布里的视频 / 画布里的音频 | 画布中的视频 / 画布中的音频 | 书面语 |
| `ip/studio-advanced-editor.tsx:173` | 画布上还没有视频 | 画布中暂无视频 | 空态写法 |
| `ip/studio-advanced-editor.tsx:173` | 画布上还没有配音或音乐，先在画布上做一条配音 | 画布中暂无配音或音乐，请在画布中生成配音 | 去「先」「做一条」 |
| `ip/studio-advanced-editor.tsx:174` | 从播放头位置加到时间线（title） | 从播放头位置添加到时间线 | 书面语 |
| `ip/studio-advanced-editor.tsx:177` | 点一下从播放头位置加到时间线，再拖动位置、拖两边调长短。 | 点击添加到播放头位置，可拖动调整位置，拖动两端调整时长。 | 去「点一下」「再」 |
| `ip/studio-advanced-editor.tsx:186` | 加文字 | 添加文字 | 书面语 |
| `ip/studio-advanced-editor.tsx:187` | 要加的文字（aria-label） / 比如：限时优惠 | 文字内容 / 例如：限时优惠 | 书面语，占位用「例如」 |
| `ip/studio-advanced-editor.tsx:188` | 加到画面 | 添加到画面 | 书面语 |
| `ip/studio-advanced-editor.tsx:189` | 从播放头位置开始显示 3 秒。在画面上拖动文字换位置，在右边改字号和颜色。 | 从播放头位置开始显示 3 秒。可在画面中拖动文字调整位置，在属性栏修改字号和颜色。 | 去口语、去方位词 |
| `ip/studio-advanced-editor.tsx:197` | 加字幕 | 添加字幕 | 书面语 |
| `ip/studio-advanced-editor.tsx:198` | 要加的字幕（aria-label） / 这一句要说的话 | 字幕内容 / 例如：今天给大家介绍一款新品 | 占位给例子 |
| `ip/studio-advanced-editor.tsx:199` | 加一条字幕（按钮） | 添加字幕 | 去「一条」 |
| `ip/studio-advanced-editor.tsx:200` | 从播放头位置开始显示 3 秒，拖两边调时长。字幕都放在同一条字幕轨上。 | 从播放头位置开始显示 3 秒，拖动两端调整时长。所有字幕位于同一字幕轨。 | 去口语 |
| `ip/studio-advanced-editor.tsx:225` | 怎么剪 | 剪辑说明 | 标题用名词 |
| `ip/studio-advanced-editor.tsx:227` | 拖动时间线上的片段换位置。 | 拖动时间线上的片段调整位置。 | 书面语 |
| `ip/studio-advanced-editor.tsx:228` | 拖片段的两边掐头去尾。 | 拖动片段两端裁剪首尾。 | 书面语 |
| `ip/studio-advanced-editor.tsx:229` | 把播放头放到要切的地方，点时间线上方的剪刀切开。 | 将播放头移到分割位置，点击时间线上方的剪刀分割。 | 书面语，点击写法 |
| `ip/studio-advanced-editor.tsx:230` | 选中后点这里的「删除」，后面的片段会自动补上来。 | 选中后点击「删除」，后续片段将自动前移。 | 点击写法 |
| `ip/studio-advanced-editor.tsx:231` | 左边加配音、文字和字幕，选中后在这里改。 | 在工具栏添加配音、文字和字幕，选中后可在此修改。 | 去方位词 |
| `ip/studio-advanced-editor.tsx:235` | 在成片里 {start} – {end}，共 {len} | 成片中 {start}–{end}，共 {len} | 书面语 |
| `ip/studio-advanced-editor.tsx:238` | 这段的原声关掉了（选了配音时默认关掉）。 | 此片段原声已关闭（使用配音时默认关闭）。 | 书面语 |
| `ip/studio-advanced-editor.tsx:261` | 素材没有存储位置，加不进来 | 素材无法添加 | 「存储位置」是内部词，去口语 |
| `ip/studio-advanced-editor.tsx:299` | 有 {n} 个素材没取到，已从时间线去掉 | {n} 个素材加载失败，已从时间线移除 | 统一写法 |
| `ip/studio-advanced-editor.tsx:300` | 「{names}」读不出来，没有放进时间线 | 「{names}」加载失败，未加入时间线 | 统一写法 |
| `ip/studio-advanced-editor.tsx:327` | 时间线上至少要有一段视频 | 时间线中至少需要一段视频 | 书面语 |
| `ip/studio-advanced-editor.tsx:330` | 已开始合成，完成后出现在「合成好的作品」里 | 已开始合成，完成后显示在「已合成的作品」中 | 跟随 212 行改名 |
| `ip/studio-advanced-editor.tsx:334` | 正在载入素材… | 正在加载素材… | 第一批统一写法 |
| `canvas-bridge/studio-work-clips.ts:104` | 第 {n} 条字幕还没写内容 | 第 {n} 条字幕未填写内容 | 书面语 |

## 计费弹窗与积分

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-billing-dialog.tsx:65` | 下一步确认折扣、模型赠款抵扣和要付的积分。 | 下一步确认折扣、模型赠款抵扣和应付积分。 | 书面语 |
| `ip/studio-billing-dialog.tsx:65` | 本次最多冻结 {n} 积分，按实际用量结算，未用部分退回。 | 按实际用量结算，完成后显示实际消耗积分。 | 按 Token 结算不显示冻结上限（skill 明确规则；测试见下） |
| `ip/studio-billing-dialog.tsx:49` | 企业余额或生成设置尚未读取 | 企业余额或生成设置加载失败，请稍后重试 | 统一写法（见「需要核实」1） |
| `ip/studio-billing-dialog.tsx:67` | 出图、视频、数字人、配音等所有生成都按这个账户付款，换电脑或手机也一样。想改回每次询问，去{设置}。余额不足时不会自动换账户。 | 图片、视频、数字人、配音等所有生成均使用此账户付款，在其他设备上同样生效。如需改为每次询问，请前往{设置}。余额不足时不会自动切换账户。 | 去「出图」、去口语 |
| `ip/studio-billing-dialog.tsx:68` | {错误} 可以取消勾选，只用这一次。 | {错误} 可取消勾选，仅本次使用此账户。 | 去口语 |
| `ip/studio-billing-dialog.tsx:69` | 企业积分仍归企业，受企业允许模型与每人 {n} 项在途任务限制。作品仍归个人。 | 企业积分归企业所有，使用时受企业允许的模型及每人 {n} 项进行中任务的限制。作品归个人所有。 | 「在途」是内部词 |
| `ip/studio-billing-dialog.tsx:70` | 请先充值或联系企业分配积分，也可以明确选择另一付款账户。系统不会自动切换或混合扣款。 | 请充值或联系企业分配积分，也可选择其他付款账户。系统不会自动切换或混合扣款。 | 去「先」 |
| `ip/studio-billing-settings.tsx:19` | 暂时无法读取付款设置，请刷新后重试。 | 付款设置加载失败，请稍后刷新重试。 | 统一写法 |
| `ip/studio-billing-settings.tsx:31` | {错误}，没有保存。 / 没有保存，请重试。 | {错误}，未保存。 / 保存失败，请重试。 | 状态书面语 |
| `ip/studio-billing-settings.tsx:38` | 改了就保存，出图、视频、数字人、配音等所有生成都按它付款，换电脑或手机也一样。余额不足时不会自动换账户；退出企业后会重新询问。 | 修改后自动保存。图片、视频、数字人、配音等所有生成均使用此账户付款，在其他设备上同样生效。余额不足时不会自动切换账户；退出企业后将重新询问。 | 去口语、去「出图」 |
| `ip/studio-model-quote-dialog.tsx:39` | 选中后，额度不足就停止生成，不扣普通积分。提交时会再次核对价格与额度。 | 勾选后，模型赠款不足时将停止生成，不扣除普通积分。提交时将再次核对价格与额度。 | 说清是哪种额度 |
| `ip/scoped-credits-panel.tsx:30` | 暂时读不到模型赠款，请重试。 | 模型赠款加载失败，请稍后刷新重试。 | 第一批统一写法 |
| `ip/scoped-credits-panel.tsx:42` | 正在读取额度… | 正在加载额度… | 第一批统一写法 |
| `ip/studio-recharge-dialog.tsx:44` | 订单状态暂时无法读取，请稍后刷新 | 订单状态加载失败，请稍后刷新重试。 | 统一写法 |

## 发布到数字资产库

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/publish/publish-dialog.tsx:84` | 名片已建好（{regNo}），浏览器拦了新窗口，去「名片」页里补上公司 · 职务和联系方式 | 名片已创建（{regNo}），但浏览器拦截了新窗口。请前往「名片」页补充公司、职务和联系方式。 | 去口语 |
| `ip/publish/publish-dialog.tsx:86` | 建卡没成功，稍后再试 | 名片创建失败，请重试。 | 去口语 |
| `ip/publish/publish-dialog.tsx:110` | 给这个形象起个名字，发布后在资产库里就用它。 | 请输入形象名称，发布后资产库将使用此名称。 | 去口语 |
| `ip/publish/publish-dialog.tsx:114` | 先在画布上给主形象选一张定稿图，才能发布。 | 请在画布中为主形象选择一张定稿图后发布。 | 去「先」 |
| `ip/publish/publish-dialog.tsx:152` | 去数字资产平台查看 | 前往资产库查看 | 「数字资产平台」与本弹窗「数字资产库」不一致，去「去」 |
| `ip/publish/publish-dialog.tsx:201` | 形象与造型已经登记进数字资产库，可以在各条业务线里引用了。 | 形象与造型已存入数字资产库，可在各业务中引用。 | 「业务线」是内部词 |
| `ip/publish/publish-dialog.tsx:215-218` | 可以直接做成一张 数字名片 —— 名字和这 {n} 套造型自动带过去，访客能点着换装看，你只要再填联系方式。 | 可生成一张数字名片：名字和 {n} 套造型将自动带入，访客可切换造型查看，你只需填写联系方式。 | 去「——」（扫描命中）、去口语 |
| `ip/publish/publish-dialog.tsx:227` | 建卡中 / 做成数字名片 | 创建中 / 生成数字名片 | 标准叫法 |
| `ip/publish/publish-dialog.tsx:239` | 只有已经选好定稿图的形象才能发布。发布本身不花积分。 | 需为形象选择定稿图后才能发布。发布不消耗积分。 | 书面语 |
| `ip/publish/publish-dialog.tsx:244` | 还没有定稿的形象。先运行生成节点，在候选里点一张定稿，再回来发布。 | 还没有定稿的形象。请生成图片并在候选中选择一张定稿后发布。 | 去先/再/回来 |
| `ip/publish/publish-dialog.tsx:301` | 一起带上的造型 | 同时发布的造型 | 去口语 |
| `ip/common/toast.tsx:41` | 没成功（警告卡片标签） | 失败 | 状态标准叫法 |

## 旧任务恢复（只有打开旧画布、接续旧版任务时才会出现）

`canvas-bridge/flow-legacy-tasks.ts` 仍调用 `generation.ts` 的 `resumeRun` 和 `video.ts` 的 `waitForVideoGenerationTask` / `storeGeneratedVideo`，以下报错会经通知层显示。

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `canvas-bridge/generation.ts:107` | 等太久了（运行号 {runId}）。这次运行可能还在服务端跑，把运行号报给运维可以查到它的结果；真卡住时冻结的积分由服务端释放 | 等待超时（运行号 {runId}）。任务可能仍在处理中，请稍后刷新查看；任务异常时冻结的积分将自动释放。 | 去口语；不让用户找「运维」 |
| `canvas-bridge/generation.ts:166` | 这次运行没有返回图片（运行号 {id}）—— 把这个号报给运维可以查到原因 | 本次运行未返回图片（运行号 {id}）。请重试。多次失败时，可复制「错误详情」反馈给我们。 | 去「——」（扫描命中）；第一批统一报错下一步 |
| `canvas-bridge/video.ts:191` | 任务说成了，但没有成片地址 | 任务已完成，但未返回视频地址 | 去口语 |
| `canvas-bridge/video.ts:225` | 等太久了（任务号 {id}）。这条任务在服务端还在跑 —— 刷新页面会接着等它；真卡住时冻结的积分由服务端释放 | 等待超时（任务号 {id}）。任务仍在处理中，刷新页面后将继续等待结果；任务异常时冻结的积分将自动释放。 | 去「——」（扫描命中）、去口语 |
| `canvas-bridge/video.ts:289` | 成片没有落到我方存储，请联系运维检查视频链的镜像配置 | 视频保存失败，请重试。多次失败时，可复制「错误详情」反馈给我们。 | 「我方存储、视频链、镜像配置」是内部词 |

## 叫法变动（全仓同步）

1. **冲突三选项**：「另存一份，再换成最新内容 / 换成最新内容 / 以这里为准」→「另存为新画布并加载最新版本 / 加载最新版本 / 保留此页改动」。`git grep` 位置：
   - `apps/web-aiavatar/src/ip/canvas-conflict-dialog.tsx:28-30,48,64,66,87`
   - `apps/web-aiavatar/src/ip/canvas-host.tsx:58,173`（另有 54 行注释提到「处理冲突」，不用改）
   - `apps/web-aiavatar/src/canvas-bridge/project-sync.ts`（554/564/567/574 报错句；其余为注释）
   - `apps/web-aiavatar/src/canvas-bridge/project-channel.ts`（注释提到「换成最新内容」）
   - `apps/web-aiavatar/src/canvas-bridge/README.md`（描述三条出路）
   - 测试：`ip/canvas-conflict-dialog.test.tsx:18,20,24,27,29,34,36,42,44,45,49,54,55`；`ip/canvas-conflict-wiring.test.ts:35`；`canvas-bridge/project-sync.test.ts` 的用例名（505/576/591/603/612，只是描述，可不改）
   - `ip/scenes/scene-image-studio.tsx` 也出现「另存一份」，属于场景页批次，请对应批次决定是否跟随。
2. **另存画布名后缀**「· 另一份」→「· 副本」：`canvas-bridge/project-sync.ts:561,563`；测试 `canvas-bridge/project-sync.test.ts:618`（断言 `{ name: "A · 另一份" }`）。`ip/scenes/scene-draft-store.ts` 也有「另一份」，请场景批次核对。
3. **「合成好的作品」→「已合成的作品」**：`ip/studio-work-editor.tsx:212`（两处）、`ip/studio-advanced-editor.tsx:4`（注释）、`:330`。
4. **「放进成片」→「加入成片」**：`ip/studio-work-editor.tsx:68,135,139`；测试 `ip/studio-work-editor.test.tsx:48,50,51`、`ip/studio-workspace.test.tsx:559`。
5. **「上传处理中…」→「上传中…」**：`ip/studio-flow-canvas.tsx:105`；测试 `ip/studio-flow-card.test.tsx:63`、`ip/studio-flow-video-upload.test.tsx:38`。
6. **「AI 处理，会消耗积分」→「AI 处理，将消耗积分」**：见上表列出的 8 个文件；`git grep -n "会消耗积分" -- apps/web-aiavatar/src` 另有 `studio-recreation.tsx:109`「AI 分析，会消耗积分」，一并改为「AI 分析，将消耗积分」。

## 测试会受影响的

| 测试 | 断言的文字 | 建议 |
|---|---|---|
| `ip/canvas-conflict-dialog.test.tsx:18,20,24,27-55` | 弹窗标题、三个按钮名、「别处刚存的那份会被覆盖」「别处又存了一版」 | 按钮顺序改断言 `getAllByRole("button")` 的数量和第 n 个按钮点击后传给 `resolve` 的 choice（save-copy / take-theirs / keep-mine）；冲突重选断言 `role="status"` 存在 |
| `ip/canvas-conflict-wiring.test.ts:35` | 源码含「已经换成最新内容」 | 改断言 `remoteRefreshes` 触发 `message.info` 这一接线，或断新句 |
| `canvas-bridge/project-sync.test.ts:618` | `createProject({ name: "A · 另一份" })` | 改为断言 name 以 `A · ` 开头，或断新后缀 |
| `ip/studio-errors.test.tsx:80,173` | 用「这张画布在别处被改过了」「这个项目打不开」作为入参 | 只是输入样例，断言的是错误码去重与标题，可不改 |
| `ip/studio-canvas-guide.test.tsx:77,82,84,87,105`、`ip/studio-workspace.test.tsx:103,106` | heading「这张画布还是空的」、button「和助手开始」 | 改断言 `aria-labelledby="studio-canvas-guide-title"` 的 region 存在 / 不存在，按钮用 class `studio-canvas-guide-primary` 或新名字 |
| `ip/studio-flow-video-frames.test.tsx:90,91,113,116` | 「无法读取这条视频，请重试」「没能截出画面…」「视频正在生成，完成后再抽帧」「演示模式不能抽帧…」 | 改断言新句；或断言 `reportStudioError` / `message.info` 被调用且主按钮 disabled |
| `ip/studio-flow-card.test.tsx:63`、`ip/studio-flow-video-upload.test.tsx:38` | button「上传处理中…」 | 改断言新名或 `disabled` + `aria-busy` |
| `ip/studio-work-editor.test.tsx:48,50,51,63,83,92,168`、`ip/studio-workspace.test.tsx:559` | 「把「原片」放进成片」「其他片段是照着它做的…」「配音比成片长，合成不了」「按片段填好时间」「改回一键成片」 | checkbox 可改按 role + 顺序取；阻断原因断言 `.studio-work-actions .is-error` 存在、「合成作品」按钮 disabled |
| `ip/studio-billing-dialog.test.tsx:57` | `/本次最多冻结 300 积分/`、`/未用部分退回/` | 改断言出现「按实际用量结算」且不出现冻结数字（这正是新规则的被测行为） |
| `ip/studio-video-prompt-notes.test.tsx:69,113`、`ip/studio-workspace.test.tsx:1013`、`canvas-bridge/studio-video-prompt.test.ts:121` | 「优化稿太长，视频模型收不下」、对话框名「描述里提到了图片，这次没有用上图片」、`bindLabel` 为「去选择视频模式」 | 对话框按 role 取；`bindLabel` 可断言 `target` 为空时与有值时不同，或断新文字 |
| `ip/studio-video-prompt-wiring.test.ts:20` | 源码含「优化稿有需要留意的地方，选好再出片」 | 改断言节点上存在 `edit` 按钮的接线，或断新句 |
| `ip/studio-task-list.test.tsx:48` | 「当前没有进行中的任务」 | 改断言 `.studio-task-empty` 存在 |
| `ip/audio-recorder-dialog.test.tsx:114` | 「再读 3 秒」 | 这不是 157 行的「再读」按钮，是倒计时提示，不受影响；核对 157 行改名后无其他断言 |

`ip/studio-video-prompt-notes.test.tsx:62,79-80` 和 `canvas-bridge/studio-nodes.test.ts:182` 里的「视频提示词优化没成功…」「提示词优化没成功，已按原文生成」是服务端返回的 message，不受本批前端改动影响；服务端原文属于后端批次。

## 需要核实或连带改行为

1. **付款弹窗拼出半截句子**：`ip/studio-billing-dialog.tsx:66` 个人积分未加载时显示「可用 暂未读取 积分」；`:69` 策略未加载时显示「每人 待读取 项在途任务限制」。要改对，需改成整句分支：未加载时整行写「正在加载可用积分…」/ 不显示「每人 N 项」那半句。`:49`「企业余额或生成设置尚未读取」也同时用于加载中与加载失败两种状态（`!balance || !policy`），加载中时写「失败」不对，需要区分 loading 与 error 才能写准。
2. **顶栏显示数字人内部编号**：`ip/canvas-host.tsx:201` 发布后顶栏胶囊直接显示 `publishedAvatarId`（内部 id），title 也写「已发布为 {id}」。改文字只需去掉 id；若想显示形象名称，需要 `useProjectSync` 额外带出名字。
3. **配音按钮显示冻结上限**：`ip/studio-speech.tsx:50` 按秒计费时按钮写「生成配音 · 预冻结 {cost} 积分」，状态行（:54）写「预冻结 {cost} 积分，完成后退回差额」。代码实际按生成音频秒数向上取整收费、冻结的是上限。按规则不应把冻结数当价格，但按秒计费没有确定价，见存疑 2。
4. **「关掉之前这里的改动不会自动保存」与行为不符**：冲突状态下 `useProjectSync` 停掉自动保存，直到冲突处理完成（`project-sync.test.ts:288`），不是只在关掉弹窗之前。已在主表改写成「处理冲突前…」，改文字即可，行为不用动。
5. **配音 / 口型 / 复刻「未配置」提示让用户去后台**：`studio-speech.tsx:57`、`studio-lip-sync.tsx:44`、`studio-recreation.tsx:106`，普通用户没有后台权限。主表已改成「请联系管理员」。若希望超管看到具体的配置项，需要按角色分支显示（`isSuperAdminRole` 已在 canvas-host 用过）。
6. **死分支**：`ip/studio-workspace.tsx:1219` 在 `!nativeVideo` 条件里又判断 `nativeVideo?`，「按所选模式使用画布素材。」永远不会显示。不影响文案，顺手可清。
7. **旧任务恢复的「积分已退回」**：`canvas-bridge/video.ts:200` 失败时写「视频生成失败，积分已退回」。退款由服务端结算，前端拿到 failed 时不一定已退完（可能仍在释放）。建议改为「视频生成失败，冻结的积分将退回」或照服务端返回的 message 显示。

## 仅手机端（不改，列出备查）

`ip/canvas-gate.tsx` 的 `MobileNotice` / `MobileCanvasBar` 只在手机形态渲染：
- `:98` 返回链接「自由画布」（指向 `/projects`，那是「项目」页），`:199`「画布」
- `:107`「画布在电脑上更好用」、`:110`「要拖节点、连线、框选参考图，还得同时看得见整条流程，手机屏幕上会挤。」、`:113`「只是想看看效果、改一句提示词重跑一次的话，手机上也能做。」
- `:127`「仍然在手机上打开」、`:133`「或者发到电脑上接着做」（扫描命中）、`:153`「复制没成功，手动选中这段地址：」、`:168`「用电脑版界面打开」、`:172`「形象发布之后，资产、造型和名片在手机上都能看能改。」、`:201`「电脑上更好用」
- 口语较重，若手机端也要统一，建议另开一批：「自由画布」→「项目」，「或者发到电脑上接着做」→「复制链接到电脑打开」，「复制没成功，手动选中这段地址：」→「复制失败，请手动复制以下地址：」。

## 存疑（拿不准的，写出两种写法让用户选）

1. **`ip/last-run-panel.tsx:25,28`「上次发给模型」**（菜单项名，title 见 38「上次实际发给模型的内容」）
   - A：保留「上次发给模型」（短，用户能看懂；只把 38 改为「上次实际发送给模型的内容」）
   - B：改为「上次提交内容」，弹窗标题「上次提交给模型的内容」
2. **按秒计费的配音按钮**（`ip/studio-speech.tsx:50,54`）
   - A：按钮「生成配音 · {rate} 积分/秒」，状态行「按生成音频的实际时长计费，本次最多 {cost} 积分，未用部分退回。」
   - B：按钮「生成配音 · 按时长计费」，状态行保持数字说明，只把「预冻结」改为「最多」。
3. **H3 价格后缀**（`ip/studio-workspace.tsx:1194`「{quote} 积分 · 优化另需少量积分」）：AGENTS.md 明确写过「价格后面写『优化另需少量积分』」，但 skill 规则是按 Token 结算写「按实际用量结算」。
   - A：保持现状（AGENTS 已定）
   - B：「{quote} 积分 · 优化按实际用量另计」，并同步 AGENTS.md 那句
4. **局部重绘弹窗按钮**（`ip/studio-flow-image-tools.tsx:79`「下一步：确认生成」）：点了打开生成面板确认费用，并不直接生成。
   - A：「下一步」
   - B：保留「下一步：确认生成」（说明下一步要做什么）
5. **「改回一键成片」**（`ip/studio-workspace.tsx:817` 标题与按钮、`ip/studio-work-editor.tsx:191`）：「一键」是本仓真实的模式名（与「高级编辑」相对）。
   - A：保留「改回一键成片？」/「改回一键成片」
   - B：标题「放弃高级编辑？」，按钮「放弃高级编辑」，说明里写「将恢复为按片段顺序合成」
6. **发布弹窗里的库名**：标题「发布到数字资产库」，导航叫「资产」。
   - A：统一叫「数字资产库」（只把 152 行「数字资产平台」改掉）
   - B：全部改成导航叫法「资产」：「发布到资产」「前往资产查看」

---

# 第四批 B · 画布里的创作助手（对话面板）

读过的文件（括号内是 inscope.txt 里的条数；都打开源码看了上下文）：
`ip/studio-assistant.tsx`（99）、`ip/studio-assistant-starters.tsx`（102）、`ip/studio-assistant-plan.tsx`（64）、`ip/studio-dialogue-activity.tsx`（4）、`ip/studio-dialogue-approval.tsx`（22）、`ip/studio-dialogue-check.tsx`（15）、`ip/studio-dialogue-composer.tsx`（18）、`ip/studio-dialogue-execution.tsx`（57）、`ip/studio-dialogue-legacy.tsx`（9）、`ip/studio-dialogue-message.tsx`（44）、`ip/studio-dialogue-question.tsx`（4）、`ip/studio-dialogue-session.tsx`（6）、`ip/studio-dialogue-skill-draft.tsx`（17，仅运营账号可见）、`ip/studio-dialogue-threads.tsx`（20）、`ip/studio-dialogue-timeline.tsx`（11）、`ip/studio-dialogue-tool.tsx`（36）、`ip/studio-conversation-share.tsx`（16）、`ip/studio-conversation-public.tsx`（14）、`ip/studio-conversation-transcript.tsx`（3）、`ip/studio-social-bind.tsx`（26，属于「发行」的账号绑定弹窗，和对话无关，也看过了）、`app/shared/conversations/[token]/page.tsx`（1）、`canvas-bridge/studio-assistant-context.ts`（7）、`canvas-bridge/studio-assistant-plan.ts`（3）、`canvas-bridge/studio-plan-execution.ts`（5）、`canvas-bridge/studio-skills.ts`（4）、`canvas-bridge/studio-reply-actions.ts`（0）。`canvas-bridge/studio-assistant-memory.ts` 没有界面文字。

没有改的（照规则保留）：点了会作为用户消息发出的话：`studio-assistant.tsx:747-755` 的 `startWith(...)` 句子、`studio-dialogue-message.tsx:99`「改用「{title}」这个做法，重新报价」、`:112`「重新报价」，以及填空卡 `compose` 拼出来写进输入框的句子（`studio-assistant-starters.tsx:79-99`）。助手回复正文、问题选项、建议、`needsUserReason` 这类服务端写的话也没改。

## 输入框与发送

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-assistant.tsx:303` | 先写下你想做的 | 请输入要做的内容 | 去掉「先」；发送按钮的悬停提示 |
| `ip/studio-assistant.tsx:303`、`:732` | 对话还在加载，请稍等 | 正在加载对话… | 统一写法「正在加载 X…」 |
| `ip/studio-assistant.tsx:303`、`:732`；`ip/studio-dialogue-session.tsx:79` | 正在切换对话，请稍等 | 正在切换对话… | 同上，去掉「请稍等」 |
| `ip/studio-assistant.tsx:303` | 附件还在导入 | 附件导入中… | 状态用「X 中」 |
| `ip/studio-assistant.tsx:304` | 附件还没保存好，保存后才能发送 | 附件未保存，保存后可发送 | 口语，改成书面语 |
| `ip/studio-assistant.tsx:304` | 有引用已从画布删除，请先移除 | 部分引用已从画布删除，请移除后发送 | 去掉「先」；和 `:800` 那句说法一致 |
| `ip/studio-assistant.tsx:800`（两处） | 部分引用已从画布删除，请移除后重新选择 | 部分引用已从画布删除，请移除后发送 | 实际操作是移除引用后发送，不一定要重新选；和 `:304` 统一 |
| `ip/studio-assistant.tsx:297` | 附件已保存，可以发送了 | 附件已保存 | 去掉语气词「了」，按钮已经可点 |
| `ip/studio-assistant.tsx:320` | 对话计费配置已更新，原消息已保留，再点一次发送。 | 对话计费已更新，原消息已保留，请重新发送。 | 去掉「再点一次」 |
| `ip/studio-assistant.tsx:99` | {names}都能做，选一个就按它发送 | {names}都适用，请选择一种做法后发送 | 去掉「就」，口语改书面 |
| `ip/studio-assistant.tsx:99` | 选一种做法，就按它发送 | 请选择一种做法后发送 | 同上 |
| `ip/studio-assistant.tsx:106` | 积分超出上限，还差 {n} 积分，提高上限后再发 | 积分超出上限，还差 {n} 积分，提高上限后可发送 | 去掉「再」 |
| `ip/studio-assistant.tsx:106` | 积分超出上限，提高上限后再发 | 积分超出上限，提高上限后可发送 | 同上 |
| `ip/studio-assistant.tsx:799` | 想改哪里，直接说 | 输入修改意见或新的需求 | 占位文字太口语；对话进行中的输入框 |
| `ip/studio-dialogue-composer.tsx:80` | 说说要做什么，输入 @ 引用画布内容 | 描述要做的内容，输入 @ 引用画布内容 | 「说说」口语 |
| `ip/studio-assistant.tsx:738` | 实时更新暂时不可用，每隔几秒刷新一次 | 实时更新暂不可用，将每隔几秒自动刷新 | 说明写清是自动刷新 |
| `ip/studio-assistant.tsx:738` | 连接中断，正在重连 | 连接已断开，正在重新连接… | 状态写法 |
| `ip/studio-assistant.tsx:443` | 画布已变化，稍后重试 | 画布已更新，请稍后重试 | 补全成句 |

## 面板头部、开场与使用说明

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-assistant.tsx:805` | 正在读取这张画布的对话 | 正在加载对话… | 统一写法 |
| `ip/studio-assistant.tsx:806` | 对话没有读取成功。 | 对话加载失败。 | 统一写法（后面紧跟重试按钮，不再写「请稍后刷新重试」） |
| `ip/studio-assistant.tsx:806` | 重新读取 | 重试 | 标准叫法；不用「读取」 |
| `ip/studio-assistant.tsx:86` | 按你说的话自动选择做法。 | 根据你的描述自动选择做法。 | 「按你说的话」口语 |
| `ip/studio-assistant.tsx:764` | 全能创作：按你说的话和素材自动选择做法。 | 全能创作：根据你的描述和素材自动选择做法。 | 同上 |
| `ip/studio-assistant.tsx:761` | 我列出要生成的内容和要花的积分，等你确认。 | 助手列出要生成的内容和所需积分，由你确认。 | 使用说明是界面文字，不用第一人称「我」 |
| `ip/studio-assistant.tsx:762` | 结果一步步放进画布，中途随时可以插话或停下。 | 结果会逐步放进画布，制作中可随时补充要求或停止。 | 口语改书面 |
| `ip/studio-assistant.tsx:748` | 按所选素材出一张新图 | 按所选素材生成一张新图 | 说明里用「生成」，不用「出图」 |
| `ip/studio-assistant.tsx:750` | 从这些节点往下搭 | 规划后续的文字、图片和视频 | 「往下搭」口语，说清具体做什么 |
| `ip/studio-assistant.tsx:754` | 照参考视频的节奏，换成你的商品 | 按参考视频的节奏，换成你的商品 | 「照」口语 |
| `ip/studio-assistant.tsx:755` | 从设定图一路做到视频 | 从人物设定到场景视频 | 「一路做到」口语 |
| `ip/studio-assistant.tsx:755`（卡片标题） | 搭一套创作流程 | 搭建创作流程 | 去掉「一套」；与 `:750`「串成创作流程」区分开 |

## 填空卡（`studio-assistant-starters.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-assistant-starters.tsx:47` | 还差照片 | 请添加照片 | 发送按钮旁的原因，口语「还差」改成要做的动作 |
| `ip/studio-assistant-starters.tsx:68` | 还差参考视频 | 请添加参考视频 | 同上 |
| `ip/studio-assistant-starters.tsx:69` | 还差商品或人物图 | 请添加商品或人物图 | 同上 |
| `ip/studio-assistant-starters.tsx:55` | 先写一句梗概 | 请填写梗概 | 去掉「先」 |
| `ip/studio-assistant-starters.tsx:61` | 先写画面描述 | 请填写画面描述 | 同上 |
| `ip/studio-assistant-starters.tsx:125` | 先写{label} | 请填写{label} | 同上（兜底文案） |
| `ip/studio-assistant-starters.tsx:183`、`:208` | 还缺 | 待补充 | 统一状态叫法 |
| `ip/studio-assistant-starters.tsx:182` | 已选好 | 已选择 | aria-label，书面 |
| `ip/studio-assistant-starters.tsx:187` | 去掉 {title}（aria-label）/ 去掉（title） | 移除 {title} / 移除 | 标准叫法，和输入框引用的「移除引用」一致 |
| `ip/studio-assistant-starters.tsx:172` | 换一个 | 返回 | 返回四张卡的按钮，标准叫法（见「叫法变动」） |
| `ip/studio-assistant-starters.tsx:55` | 比如：外卖员送错一单，意外救了老板的女儿 | 例如：外卖员送错一单，意外救了老板的女儿 | 占位给例子用「例如：」 |
| `ip/studio-assistant-starters.tsx:61` | 比如：女孩在海边回头微笑，风吹起围巾 | 例如：女孩在海边回头微笑，风吹起围巾 | 同上 |
| `ip/studio-assistant-starters.tsx:74` | 比如：保温 12 小时，一键开盖 | 例如：保温 12 小时，一键开盖 | 同上 |
| `ip/studio-assistant-starters.tsx:50` | 要出的图 | 图片类型 | 标签用名词，不用「出图」 |
| `ip/studio-assistant-starters.tsx:69` | 换进去的商品或人物 | 替换的商品或人物 | 口语 |
| `ip/studio-assistant-starters.tsx:74` | 要讲的卖点 | 卖点 | 标签短；字段本身已标「选填」 |
| `ip/studio-assistant-starters.tsx:48` | 正脸清晰、光线均匀、只有一个人，效果最好。只用本人或已获授权的照片。 | 建议使用正脸清晰、光线均匀的单人照片。仅限本人或已获授权的照片。 | 口语改书面 |
| `ip/studio-assistant-starters.tsx:78` | 真人照片变成数字形象，出多角度设定图 | 用真人照片生成数字形象和多角度设定图 | 不用「出图」 |
| `ip/studio-assistant-starters.tsx:83` | 一句梗概写成能拍的分场剧本 | 根据一句梗概写出可拍摄的分场剧本 | 书面 |
| `ip/studio-assistant-starters.tsx:89` | 一句描述出视频，也可以从一张图动起来 | 根据描述生成视频，也可以用一张图作首帧 | 不用「出视频」；「动起来」口语 |
| `ip/studio-assistant-starters.tsx:96` | 照爆款的节奏和镜头，换成你的商品或人物 | 按爆款视频的节奏和镜头，换成你的商品或人物 | 「照」口语 |
| `ip/studio-assistant-starters.tsx:217` | 你已手动修改提示词，切换选项不会覆盖。点“按选项重写”可使用当前选择。 | 你已手动修改提示词，切换选项不会覆盖。点击「按选项重写」可使用当前选择。 | 统一写「点击「X」」，用直角引号 |
| `ip/studio-assistant-starters.tsx:223` | 用上面的选项重新写输入框里的话 | 按当前选项重写输入框中的内容 | title 书面 |

## 方案确认卡与方案（`studio-dialogue-approval.tsx` / `studio-assistant-plan.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-dialogue-approval.tsx:88` | 先改改 | 修改方案 | 去掉「先」，标准叫法（点了只聚焦输入框，见「叫法变动」） |
| `ip/studio-dialogue-approval.tsx:85` | 方案还没到，稍等一下 | 正在加载方案… | 口语；统一加载写法 |
| `ip/studio-dialogue-approval.tsx:91` | 现在再查一次 | 立即核对 | 去掉「再」「一次」；对应「正在核对确认结果」 |
| `ip/studio-dialogue-approval.tsx:57` | 新的上限至少要 {n} 积分 | 新上限不能低于 {n} 积分 | 书面 |
| `ip/studio-dialogue-approval.tsx:77` | 已有新的报价，见下方 | 已有新报价，请查看下方 | 补全成句 |
| `ip/studio-dialogue-message.tsx:107` | 没有确认 | 未确认 | 状态书面 |
| `ip/studio-assistant.tsx:577` | 方案已更新，请看最新的报价 | 方案已更新，请查看最新报价 | 「看」改「查看」 |
| `ip/studio-dialogue-session.tsx:81` | 正在核对确认结果，请稍等 | 正在核对确认结果… | 去掉「请稍等」 |
| `ip/studio-dialogue-session.tsx:264` | 对话还没准备好，请稍后再发 | 正在加载对话，请稍后发送 | 去掉「再」 |
| `ip/studio-dialogue-session.tsx:414` | 已离开这段对话，确认结果没有核对完 | 已离开此对话，确认结果尚未核对完成 | 书面 |
| `ip/studio-assistant-plan.tsx:64` | 为你准备好了 | 创作结果 | 聊天口吻；旧对话结果卡的标题 |
| `ip/studio-assistant-plan.tsx:73` | 先完成「{names}」，再继续这一步。 | 请完成「{names}」后继续此步骤。 | 去掉「先」「再」 |
| `ip/studio-assistant-plan.tsx:74` | 这一步需要补选参考素材，打开后请选择实际节点。 | 此步骤缺少参考素材，打开后请选择对应节点。 | 书面 |
| `ip/studio-assistant-plan.tsx:79` | 打开节点继续创作 | 打开节点 | 按钮只写动作 |
| `ip/studio-assistant-plan.tsx:81` | 节点生成未完成，请打开查看原因。 | 节点生成失败，请打开查看原因。 | 这一支是 `status==='error'`，状态写「失败」 |
| `ip/studio-assistant-plan.tsx:82` | 先创建节点并确认参数，生成时再扣积分。 | 创建节点后确认参数，生成时扣积分。 | 去掉「先」「再」 |
| `ip/studio-assistant.tsx:628` | 请先完成前置内容，再继续这一步 | 请完成前置步骤后继续 | 去掉「再」 |
| `ip/studio-assistant.tsx:653` | 文字已放入画布 | 已放进画布 | 同一个动作全站叫「放进画布」（`:601`、`studio-dialogue-message.tsx:227`） |
| `ip/studio-assistant-plan.tsx:79`（两处） | 已放入画布 / 放入画布 | 已放进画布 / 放进画布 | 同上 |

## 制作进度条与逐步清单（`studio-dialogue-execution.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-dialogue-execution.tsx:14`、`:15`、`:99` | 等你确认 | 待确认 | 统一状态 |
| `ip/studio-dialogue-execution.tsx:14`、`:15`、`:99` | 没有完成 | 失败 | 统一状态 |
| `ip/studio-dialogue-execution.tsx:15`、`:99` | 等前面做完 | 等待中 | 口语 |
| `ip/studio-dialogue-execution.tsx:19` | 没通过 {n} 项 | 未通过 {n} 项 | 书面 |
| `ip/studio-dialogue-execution.tsx:20` | 没有检查项 | 无检查项 | 书面 |
| `ip/studio-dialogue-execution.tsx:50` | 停止这次制作？ | 停止制作？ | 确认标题短 |
| `ip/studio-dialogue-execution.tsx:50` | 还没开始的会取消，已经在生成的会做完。 | 未开始的步骤将取消，生成中的任务会继续完成。 | 口语改书面 |
| `ip/studio-dialogue-execution.tsx:50` | 再想想 | 取消 | 确认弹窗按钮标准叫法 |
| `ip/studio-dialogue-execution.tsx:69` | 已暂停，已经提交的任务会做完 | 已暂停，已提交的任务将继续完成 | 书面 |
| `ip/studio-dialogue-execution.tsx:80` | 已经提交的任务会做完，之后不再提交新的 | 已提交的任务将继续完成，之后不再提交新任务 | 书面（暂停按钮 title） |
| `ip/studio-dialogue-execution.tsx:82` | 加入这次制作，重新编排 | 加入并重新编排 | 按钮短（见「叫法变动」） |
| `ip/studio-dialogue-execution.tsx:83` | 不用它，重新编排 | 不使用并重新编排 | 口语（见「叫法变动」） |
| `ip/studio-dialogue-execution.tsx:84` | 重新提交没完成的那一步 | 重新提交失败的步骤 | title 书面 |
| `ip/studio-dialogue-execution.tsx:84` | 重试这一步 | 重试 | 按钮只写动作，上下文已是这一步 |
| `ip/studio-dialogue-execution.tsx:68` | {title}，排在队列第 {n} 位 | {title} · 排队第 {n} 位 | 和逐步清单 `:115`「排队第 {n} 位」一个说法 |
| `ip/studio-dialogue-execution.tsx:89` | 未命名的对象 | 未命名 | 「对象」是开发词 |
| `ip/studio-dialogue-execution.tsx:90`、`:119` | 在画布上看 | 在画布上查看 | 「看」口语；回复下同一动作已叫「在画布上查看」（见「叫法变动」） |

## 检查节点（`studio-dialogue-check.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-dialogue-check.tsx:11` | 没通过 | 未通过 | 书面 |
| `ip/studio-dialogue-check.tsx:18` | 正在检查，结果出来后显示在这里。 | 检查中，结果将显示在这里。 | 书面 |
| `ip/studio-dialogue-check.tsx:22` | 看了 {times} 的画面 | 已检查 {times} 处的画面 | 口语 |
| `ip/studio-dialogue-check.tsx:32` | 就用这版 | 采用此版本 | 去掉「就」（见「叫法变动」） |
| `ip/studio-dialogue-check.tsx:32` | 采用这一版（title） | 采用此版本 | 和按钮一致 |
| `ip/studio-dialogue-check.tsx:33` | 重做这一段 | 重新生成 | 标准叫法（点了打开该段的生成设置，仍要确认价格） |
| `ip/studio-dialogue-check.tsx:33` | 打开这一段的生成设置（title） | 打开此片段的生成设置 | 书面 |
| `ip/studio-assistant.tsx:541` | 找不到这一段的视频，请在画布上选中它再重新生成 | 找不到此片段的视频，请在画布上选中后重新生成 | 去掉「再」 |
| `ip/studio-assistant.tsx:547` | 这一段不属于正在进行的制作，无法记下采用 | 此片段不属于当前制作，无法采用 | 「记下采用」不通 |
| `ip/studio-assistant.tsx:550` | 找不到这一段对应的制作步骤，请刷新后重试 | 找不到此片段对应的制作步骤，请刷新后重试 | 书面 |
| `ip/studio-assistant.tsx:552` | 已采用这一版 | 已采用此版本 | 和按钮一致 |
| `canvas-bridge/studio-plan-execution.ts:276` | 这一段没有完成 | 生成失败 | 失败节点的兜底原因，统一状态 |

## 对话消息与修改建议（`studio-dialogue-message.tsx` 等）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-dialogue-message.tsx:214` | 没有完成，换个说法再试试 | 回复失败，请重试或调整描述 | 口语，去掉「再试试」 |
| `ip/studio-dialogue-message.tsx:208` | 去申请企业充值 | 申请企业充值 | 按钮不加「去」 |
| `ip/studio-dialogue-message.tsx:208` | 去充值 | 充值 | 同上 |
| `ip/studio-dialogue-message.tsx:79` | 你改过这段内容，这份修改稿不再适用 | 此内容已被修改，修改稿不再适用 | 书面 |
| `ip/studio-assistant.tsx:566` | 你改过这段内容，没有覆盖 | 此内容已被修改，未覆盖 | 书面，和上一条一致 |
| `ip/studio-assistant.tsx:563` | 这个节点正在生成或不能编辑，请稍后再采用 | 此节点正在生成或不可编辑，请稍后采用 | 去掉「再」 |
| `ip/studio-assistant.tsx:601` | 画布上已经有这段文字 | 画布上已有这段文字 | 和 `studio-dialogue-message.tsx:228` 同一句写法 |
| `ip/studio-dialogue-message.tsx:228` | 把这段回复放进画布，成为一个文字节点 | 将此回复作为文字节点放进画布 | title 书面 |
| `ip/studio-dialogue-message.tsx:232` | 从这条消息另开一段对话，原来的对话保留 | 从此消息新建一段对话，原对话保留 | title 书面 |
| `ip/studio-dialogue-message.tsx:127` | 这一轮没有执行的操作原文 | 本轮未执行的操作原文 | 书面 |
| `ip/studio-dialogue-question.tsx:9` | 直接发出这句 | 发送此回复 | 快捷答复的 title，说明点了会发送 |
| `ip/studio-dialogue-timeline.tsx:77` | 没有确认送达 | 未确认送达 | 书面 |
| `ip/studio-dialogue-timeline.tsx:78` | 重新发送这条消息，不会重复（title） | 重新发送此消息，不会重复发送 | 书面 |
| `ip/studio-dialogue-timeline.tsx:21` | 这是从一条消息新开的对话，原来的对话保持不变。查看原来的对话 | 此对话从一条消息分支而来，原对话保持不变。查看原对话 | 书面 |
| `ip/studio-dialogue-timeline.tsx:22`、`:66` | 正在读取 | 正在加载… | 统一写法 |

## 工作记录（`studio-dialogue-tool.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-dialogue-tool.tsx:54` | 完成 | 已完成 | 统一状态 |
| `ip/studio-dialogue-tool.tsx:54`（两处） | 没有完成 | 失败 | 统一状态 |
| `ip/studio-dialogue-tool.tsx:65`、`:72` | 这一步没有完成，可以稍后重试 | 此步骤失败，请稍后重试 | 统一状态，书面 |
| `ip/studio-dialogue-tool.tsx:73` | 这一步没有完成 | 此步骤失败 | 同上 |
| `ip/studio-dialogue-tool.tsx:16` | 制作视频 | 生成视频 | 统一叫法；活动行会显示成「正在生成视频」 |
| `ip/studio-dialogue-tool.tsx:16` | 制作图片 | 生成图片 | 同上 |
| `ip/studio-dialogue-tool.tsx:18` | 处理一项任务 | 处理任务 | 去掉「一项」 |

## 新对话 / 历史对话（`studio-dialogue-threads.tsx` / `studio-dialogue-session.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-dialogue-threads.tsx:18` | 现在就是新对话 | 当前已是新对话 | 去掉「就」 |
| `ip/studio-dialogue-threads.tsx:81` | 开始一段新的对话，这一段留在历史里 | 新建对话，当前对话保留在历史对话中 | 书面 |
| `ip/studio-dialogue-threads.tsx:85` | 正在读取对话列表 | 正在加载对话列表… | 统一写法 |
| `ip/studio-dialogue-threads.tsx:86` | 对话列表没有读取成功。 | 对话列表加载失败。 | 统一写法（后面有「重试」按钮） |
| `ip/studio-dialogue-threads.tsx:94` | 正在看的这段对话 | 当前对话 | title 口语 |
| `ip/studio-dialogue-threads.tsx:94` | 打开这段对话 | 打开此对话 | 书面 |
| `ip/studio-dialogue-threads.tsx:106` | 还没有别的对话 | 暂无其他对话。 | 统一空态写法 |
| `ip/studio-dialogue-session.tsx:70` | 这段对话还在进行，等它做完或先停止 | 当前对话进行中，完成或停止后可切换 | 口语，去掉「先」 |

## 之前的对话（`studio-dialogue-legacy.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-dialogue-legacy.tsx:36` | 填进输入框，可以改完再发 | 填入输入框，修改后发送 | 去掉「再」 |
| `ip/studio-dialogue-legacy.tsx:38` | 正在确认原来的任务 | 正在确认原任务… | 书面 |
| `ip/studio-dialogue-legacy.tsx:38` | 这段对话的任务还没确认结果 | 此对话的任务结果待确认 | 书面 |
| `ip/studio-dialogue-legacy.tsx:39` | 确认原对话任务 | 确认原任务 | 全站这个按钮叫「确认原任务」（`canvas/components/canvas/canvas-node-prompt-panel.tsx:176`、AGENTS.md） |
| `ip/studio-assistant.tsx:665` | 对话未完成 | 对话失败 | 这一支是 `run.status === "failed"` |

## 运营：整理成技能草稿（`studio-dialogue-skill-draft.tsx`，仅运营账号可见）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-dialogue-skill-draft.tsx:89` | 把这次制作整理成技能草稿 | 整理成技能草稿 | 按钮短；aria-label 已经是这几个字 |
| `ip/studio-dialogue-skill-draft.tsx:73` | 把这次制作整理成技能草稿？ | 将本次制作整理成技能草稿？ | 书面 |
| `ip/studio-dialogue-skill-draft.tsx:74` | 会读这次制作的方案、步骤和检查结果，整理成一份做法草稿，素材和画布内容不会带进去。…草稿要管理员在后台审阅、发布后才会生效。 | 将读取本次制作的方案、步骤和检查结果，整理成做法草稿，不包含素材和画布内容。…草稿需管理员在后台审阅并发布后生效。 | 书面（中间的积分说明见「需要核实」） |
| `ip/studio-dialogue-skill-draft.tsx:75` | 再想想 | 取消 | 确认弹窗标准叫法 |
| `ip/studio-dialogue-skill-draft.tsx:71` | 整理要用的模型还没有定价，请联系运营在后台配置后再试 | 整理所用的模型未定价，请在后台配置后重试 | 看到它的就是运营本人，「联系运营」不对；去掉「再试」 |
| `ip/studio-dialogue-skill-draft.tsx:79` | 只有运营账号可以把制作整理成技能草稿。 | 仅运营账号可整理技能草稿。 | 书面 |
| `ip/studio-dialogue-skill-draft.tsx:84` | 已存成技能草稿 v{n}{，去掉了 N 处素材引用}。 | 已保存为技能草稿 v{n}{，已移除 N 处素材引用}。 | 「存成」「去掉」口语 |
| `ip/studio-dialogue-skill-draft.tsx:84` | 技能草稿已经整理好。 | 技能草稿已生成。 | 书面 |
| `ip/studio-dialogue-skill-draft.tsx:85` | 要管理员在后台审阅、发布后才会生效，现在的对话不受影响。 | 需管理员在后台审阅并发布后生效，不影响当前对话。 | 书面 |
| `ip/studio-dialogue-skill-draft.tsx:85` | 本次用了 {n} 积分。 | 本次消耗 {n} 积分。 | 书面 |
| `ip/studio-dialogue-skill-draft.tsx:87` | 没有整理成功 | 整理失败 | 统一状态 |

## 对话分享（`studio-conversation-share.tsx` / `studio-conversation-public.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-conversation-share.tsx:25` | 已撤销，原链接无法再查看 | 已撤销分享，原链接已失效 | 书面 |
| `ip/studio-conversation-share.tsx:26` | 分享链接已创建，可复制后发送 | 分享链接已创建 | 下方就是「复制链接」，后半句多余 |
| `ip/studio-conversation-share.tsx:32` | 预览并分享这次对话 | 预览并分享此对话 | 书面 |
| `ip/studio-conversation-public.tsx:31` | 暂时无法打开对话 | 对话加载失败 | 统一写法（后面有「重新加载」按钮） |
| `ip/studio-conversation-public.tsx:35` | 正在复制对话 | 正在复制对话… | 状态加省略号，和其他加载状态一致 |

## 附件与发行账号绑定

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `canvas-bridge/studio-assistant-context.ts:26` | 暂时无法读取 PDF / Word，请稍后重试 | PDF / Word 文件读取失败，请稍后重试 | 统一失败写法 |
| `ip/studio-social-bind.tsx:66` | 绑定未完成 | 绑定失败 | 这一支是 `status === 'failed'` |
| `ip/studio-social-bind.tsx:71` | 继续查询本次绑定 | 重新查询绑定状态 | 按钮写清动作 |

## 叫法变动（全仓同步）

1. **「在画布上看」→「在画布上查看」**（回复下的同一动作已叫「在画布上查看」，现在两种叫法并存）
   - 前端：`apps/web-aiavatar/src/ip/studio-dialogue-execution.tsx:90`、`:119`（可视文字）；注释 `:102`、`:107`；`apps/web-aiavatar/src/ip/studio-flow-canvas.tsx:128`、`:283`（注释）；`apps/web-aiavatar/src/styles/ip-studio-workflow.css:989`、`:1036`（注释）
   - 测试：`apps/web-aiavatar/src/ip/studio-dialogue-execution.test.tsx:73`
   - 服务端（注释）：`apps/server/src/main/java/com/aistareco/aep/ipstudio/execution/StudioExecutionSummary.java:13`、`apps/server/src/test/java/com/aistareco/aep/ipstudio/execution/StudioPlanExecutorTest.java:535`
   - 现行文档：`AGENTS.md:745`、`:1151`；`docs/ip-studio-new-canvas-and-threads.md:204`；`docs/runbooks/studio-e2e-cases.md:81`。发布记录、审计（`docs/audits/studio-local-full-e2e-20261019.md:131`、`docs/VERSION_HISTORY.md`）是历史，不改。
2. **「先改改」→「修改方案」**
   - `apps/web-aiavatar/src/ip/studio-dialogue-approval.tsx:88`；`apps/web-aiavatar/src/styles/ip-studio-workflow.css:1048`（注释）
   - 测试：`apps/web-aiavatar/src/ip/studio-assistant.test.tsx:219-220`、`:1372`
   - 文档：`apps/web-aiavatar/PRODUCT.md:510`、`docs/ip-studio-new-canvas-and-threads.md:145`
3. **「就用这版」→「采用此版本」、「重做这一段」→「重新生成」**
   - `apps/web-aiavatar/src/ip/studio-dialogue-check.tsx:32-33`（可视），注释 `:3-4`；`apps/web-aiavatar/src/ip/studio-assistant.tsx:533`；`apps/web-aiavatar/src/canvas-bridge/studio-plan-execution.ts:283`、`:288`；`apps/web-aiavatar/src/ip/studio-dialogue-session.tsx:472`（注释）
   - 测试：`apps/web-aiavatar/src/ip/studio-dialogue-check.test.tsx:27`、`:31`、`:42`；`apps/web-aiavatar/src/ip/studio-assistant.test.tsx:457`
   - 文档：`apps/web-aiavatar/PRODUCT.md:566`。`docs/VERSION_HISTORY.md:455/463` 的「就用这版」说的是短剧（web-drama），不相干，不改。
4. **填空卡「换一个」→「返回」**
   - `apps/web-aiavatar/src/ip/studio-assistant-starters.tsx:172`；注释 `apps/web-aiavatar/src/ip/studio-assistant.tsx:125`、`:690`
   - 测试：`apps/web-aiavatar/src/ip/studio-assistant.test.tsx:1072`、`:1079`、`:1099`
   - 文档：`apps/web-aiavatar/PRODUCT.md:516`、`docs/ip-studio-new-canvas-and-threads.md:222`、`:279`
5. **「加入这次制作，重新编排 / 不用它，重新编排」→「加入并重新编排 / 不使用并重新编排」**
   - `apps/web-aiavatar/src/ip/studio-dialogue-execution.tsx:82-83`；服务端注释 `apps/server/src/main/java/com/aistareco/aep/ipstudio/execution/StudioPlanExecutionService.java:515`、`StudioPlanExecutor.java:530`
   - 测试：`apps/web-aiavatar/src/ip/studio-dialogue-execution.test.tsx:75`、`:77`
   - 文档：`AGENTS.md:1317`、`docs/ip-studio-dialogue-intents.md:147`（发布记录 `docs/releases/studio-plan-material-scope-release-20261024.md` 是历史，不改）
6. **「确认原对话任务」→「确认原任务」**：`apps/web-aiavatar/src/ip/studio-dialogue-legacy.tsx:39`；`apps/web-aiavatar/PRODUCT.md:560`。
7. **「放入画布」→「放进画布」**：`apps/web-aiavatar/src/ip/studio-assistant.tsx:653`、`apps/web-aiavatar/src/ip/studio-assistant-plan.tsx:79`（三处）。没有测试断言。
8. **「把这次制作整理成技能草稿」→「整理成技能草稿」**：`apps/web-aiavatar/src/ip/studio-dialogue-skill-draft.tsx:89`（注释 `:2`）；`apps/web-aiavatar/PRODUCT.md:570`。

## 测试会受影响的

都是断言可视文案的，建议按 §8.0.1 ⑩ 改成断言结构 / role / 错误码；按钮名测试可以改成新文字（按钮名就是被测的可访问名称时保留按名称查，但随改动更新）。

| 测试 | 断言的句子 | 建议 |
|---|---|---|
| `ip/studio-assistant.test.tsx:780` | 「短视频复刻」和「口播种草」都能做，选一个就按它发送 | 断言 `role="group" name="选一种做法"` 里有两个按钮、名称为两个技能名，不断言提示句 |
| `ip/studio-assistant.test.tsx:220`、`:1372` | 按钮「先改改」；按钮顺序 `['收起','开始制作','先改改']` | 改成新名「修改方案」 |
| `ip/studio-assistant.test.tsx:1394` | 方案还没到，稍等一下 | 断言主按钮 disabled + 有 `role="status"` |
| `ip/studio-dialogue-message.test.tsx:53`、`:55` | 正在核对确认结果，请稍等 | 引用导出的常量 `DIALOGUE_VERIFYING`，不写死文字 |
| `ip/studio-dialogue-message.test.tsx:56` | 按钮「现在再查一次」 | 改成新名「立即核对」 |
| `ip/studio-dialogue-check.test.tsx:31`、`:42`；`ip/studio-assistant.test.tsx:457` 附近 | 按钮「就用这版」「重做这一段」 | 改成新名 |
| `ip/studio-assistant.test.tsx:430` | 没有完成 | 断言 `data-status="failed"` |
| `ip/studio-dialogue-execution.test.tsx:37`、`:71` | 按钮「重试这一步」 | 改成「重试」 |
| `ip/studio-dialogue-execution.test.tsx:73`、`:75`、`:77` | 「在画布上看」「加入这次制作，重新编排」「不用它，重新编排」 | 改成新名 |
| `ip/studio-assistant.test.tsx:367` | 你改过这段内容，这份修改稿不再适用 | 断言「采用」按钮 disabled + 有 `role="status"` 的提示 |
| `ip/studio-dialogue-message.test.tsx:105`、`:107` | 链接「去充值」「去申请企业充值」 | 断言 href（已在断言），链接名改新文字 |
| `ip/studio-dialogue-threads.test.tsx:126`、`:145` | 还没有别的对话 | 改成新句，或断言列表里除当前外没有项 |
| `ip/studio-assistant.test.tsx:453` | /这是从一条消息新开的对话/ | 断言 `details.studio-dialogue-branch` 存在 |
| `ip/studio-assistant-starters.test.ts:22`、`:39`、`:44`、`:48`、`:61` | missing 的 reason：还差照片 / 先写一句梗概 / 先写画面描述 / 还差参考视频 / 还差商品或人物图 | `composeStarter` 的 `missing` 就是被测行为，按新文字更新；或只断言 `kind` 和条数 |
| `ip/studio-assistant.test.tsx:987`、`:1010`、`:1283` | 还差照片 / 先写一句梗概 / 还差参考视频 | 同上，按新文字更新 |
| `ip/studio-assistant.test.tsx:984`、`:1012`、`:1014` | 还缺 | 改成「待补充」，或断言 slot 的 `data-state="missing"` |
| `ip/studio-assistant.test.tsx:994` | 按钮「去掉 角色 B」 | 改成「移除 角色 B」 |
| `ip/studio-assistant.test.tsx:1064` | label「要讲的卖点」 | 改成「卖点」 |
| `ip/studio-assistant.test.tsx:1079`、`:1099` | 按钮「换一个」 | 改成「返回」 |
| `ip/studio-assistant.test.tsx:811`、`:820`、`:833`、`:839`、`:845` | 按钮「把这次制作整理成技能草稿」 | 改成「整理成技能草稿」 |
| `ip/studio-assistant.test.tsx:812` | 确认弹窗 content 含「最多 21 积分」 | 若按下节改为「按实际用量结算」，这条要一起改（断言不含数字上限） |
| `ip/studio-assistant.test.tsx:818` | /已存成技能草稿 v3，去掉了 2 处素材引用/ | 按新文字更新，或只断言 `v3` 和 `2` |
| `ip/studio-assistant.test.tsx:1261` | `api.success` 被调用为「画布上已经有这段文字」 | 按新文字更新 |

## 需要核实或连带改行为

1. **技能悬停说明和真实行为不符**（`ip/studio-assistant.tsx:85`）：原文「现在按「{name}」做。按你说的话自动选择；有制作在进行时保持不变，想换做法可以开一段新对话。」。2026-10-23 起「不锁方法」：每条消息都按意图选做法，有制作进行中也会切换（`StudioDialogueService.switchMethod`，`:471` 注释写明 "also while an execution is bound"），旧制作按停止或暂停解绑。「有制作在进行时保持不变」「想换做法可以开一段新对话」都不对了。建议改为：「当前做法：「{name}」。会根据你的描述自动选择做法。」
2. **技能草稿确认弹窗显示冻结上限**（`ip/studio-dialogue-skill-draft.tsx:74`）：「最多 {maxCost} 积分。」里的数字来自 `draftModel.tokenPricing.maxCost`（`ip/studio-assistant.tsx:225`），这是按 Token 结算的冻结上限。规则要求按 Token 结算的写「按实际用量结算」，不显示上限。建议改为「按实际用量结算。」（同时改 `studio-assistant.test.tsx:812`）。只有运营看得到，影响小。
3. **公开分享页时间格式**（`ip/studio-conversation-public.tsx:32`）：`new Date(view.createdAt).toLocaleString('zh-CN')` 显示成「2026/11/3 15:02:00」，违反 §4.8，应改用 `formatDateTime(view.createdAt)`（`@/lib/datetime`）。要改代码，不只是改字。
4. **发送按钮旁的原因在空输入时不显示**（`ip/studio-dialogue-composer.tsx:104`）：`sendDisabledReason && text.trim()` 才显示原因，所以「先写下你想做的」只在按钮悬停提示里出现；这条可以接受（空输入框不需要提示），只是说明改它的文字影响面很小。
5. **发行账号绑定**（`ip/studio-social-bind.tsx:66`）：「获取登录二维码」在「账号备注」为空时不可点，但旁边没写原因，「账号备注」也没标必填。建议标签写「账号备注」并在按钮旁写「请填写账号备注」，或把备注改成选填。要改行为或补提示。

## 仅手机端（不改，列出备查）

这一批没有只在手机端出现的文字。助手面板在手机上是全屏，文字和桌面相同；填空卡字段旁的「还缺」注释说是为手机加的，但桌面同样显示，已放进主表。

## 存疑（拿不准的，写出两种写法让用户选）

1. **使用说明三步的小标题**（`ip/studio-assistant.tsx:760-762`）：「说想法 / 看方案 / 开始做」。
   - A：保留（短、口语但不算错，是设计稿定的三步）。
   - B：「描述需求 / 确认方案 / 开始制作」（更书面，和「开始制作」按钮一致）。
2. **填空卡标题「做个短视频」**（`ip/studio-assistant-starters.tsx:89`）：其余三张是「制作个人 IP / 写剧本 / 复刻视频」。
   - A：「生成短视频」（和全站「生成视频」一致）。
   - B：「做短视频」（去掉「个」，保留卡片口吻）。
   改名要同步 `AGENTS.md:1193`、`apps/web-aiavatar/PRODUCT.md:516`、`docs/ip-studio-new-canvas-and-threads.md:237`、`:255`、`docs/INDEX.md:131`、注释 `studio-assistant-starters.tsx:209`。
3. **方案标题的悬停提示「按技能：{name} v{n}」**（`canvas-bridge/studio-skills.ts:46`）：界面其他地方把技能叫「做法」（「选一种做法」「改用这个做法」），这里叫「技能」并带内部版本号。
   - A：保留（只在悬停里，方便排查是哪一版）。
   - B：「做法：{name}」（去掉版本号，和界面叫法一致）。
4. **旧对话里的作者标签「你 / Studio」**（`ip/studio-dialogue-legacy.tsx:30`、`ip/studio-conversation-transcript.tsx:5` 的「创作者 / Studio」）：新对话已不显示作者（CSS 隐藏），旧对话和公开分享页仍显示，两处叫法还不一样（「你」和「创作者」）。
   - A：保留（分享页给别人看，用「创作者」是对的；旧对话只读）。
   - B：统一为「创作者 / 助手」。

---

# 第五批 · 短剧导演台（/director）

读过的文件（路径相对 `apps/web-aiavatar/src/`；条数为带中文的界面片段数，按自写脚本逐段抽取，比 inscope.txt 多出 JSX 图标后的文字）：

- `ip/director/director-workbench.tsx`（约 190 段，全读）
- `ip/director/director-works.tsx`（约 45 段）、`director-trash.tsx`（约 16 段）
- `ip/director/director-brief.tsx`（约 40 段）
- `ip/director/director-script.tsx`（约 150 段）、`director-script-file.tsx`（约 25 段）、`director-script-reference.tsx`（约 20 段）、`director-long-editor.tsx`（约 12 段）
- `ip/director/director-split.tsx`（约 45 段）、`director-extract.tsx`（约 20 段）
- `ip/director/director-assets.tsx`（约 190 段）、`director-voice.tsx`（约 40 段）
- `ip/director/director-storyboard.tsx`（约 270 段）、`director-rewrite.tsx`（约 35 段）、`director-output.tsx`（约 75 段）
- `ip/director/director-settings.tsx`（约 50 段）
- `ip/director/director-assistant.tsx`（约 230 段）
- `ip/director/director-shared.tsx`（约 30 段）、`director-text.ts`（6 段，镜头字段名，无问题）、`director-pending.ts`（2 段）、`director-antd.tsx`（无中文）
- `ip/api/director.ts`（1 段，无问题）；`app/director/**`（只有注释里的中文）

另外核对了：`AGENTS.md`「AI 导演台」「AI 导演台全能创作助手」两节、`DirectorService.java` 的 `clip.delete` / `uploadAudio` / `restore` / 视频进度、`StudioMediaImportService.uploadReferenceAudio`、`@ai-star-eco/api-client/image-upload-policy`、`styles/director.css` 的桌面/手机分支。

---

## 1. 必改：显示了文字任务的冻结上限

AGENTS.md「AI 导演台」写明：文字任务入口只写「按实际用量结算」，不显示 `pricing.textMax` 冻结上限，且门禁 `git grep -n 'pricing.textMax.toLocaleString' -- apps/web-aiavatar/src` 应 0 命中。当前有 2 处直接命中、2 处经 `cost` 变量间接显示。

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-assistant.tsx:789` | 按实际用量结算，每轮最多 ${work.pricing.textMax.toLocaleString("zh-CN")} 积分 | 按实际用量结算 | 不显示冻结上限（门禁命中） |
| `ip/director/director-assistant.tsx:980` | 按实际用量结算，每轮最多 ${work.pricing.textMax.toLocaleString("zh-CN")} 积分 | 按实际用量结算 | 同上（后面的「 · Enter 发送，Shift+Enter 换行」保留） |
| `ip/director/director-brief.tsx:149` | 最多 ${cost.toLocaleString("zh-CN")} 积分，按用量结算 | 按实际用量结算 | `cost = work.pricing.textMax`，同一条规则 |
| `ip/director/director-brief.tsx:167` | 每轮最多 ${cost.toLocaleString("zh-CN")} 积分，按用量结算 | 每轮按实际用量结算 | 同上 |

---

## 2. 作品列表 / 回收站 / 已删除页

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-trash.tsx:41` | 删除的作品在这里，可以恢复 | 已删除的作品，可在此恢复 | 页面说明用书面语 |
| `ip/director/director-trash.tsx:44` | 」已恢复到作品列表，制作保持停止，需要时再开始。 | 」已恢复到作品列表。一键制作已停止，如需继续请重新开始。 | 说清停的是「一键制作」（服务端 `restore` 把 running/paused/waiting 的一键制作改 stopped）；去掉「再」 |
| `ip/director/director-trash.tsx:50` | 回收站是空的 | 回收站暂无作品。 | 空态统一「暂无 X。」（测试受影响，见下） |
| `ip/director/director-trash.tsx:51` | 删除的作品会放在这里，可以随时恢复。 | 删除的作品会保留在这里，可随时恢复。 | 书面语；「随时恢复」属实（服务端不做自动清理） |
| `ip/director/director-workbench.tsx:169` | 还是找不到这部作品。请先在回收站恢复，再重新加载。 | 仍未找到此作品。请在回收站恢复后重新加载。 | 去「再」，书面语 |
| `ip/director/director-workbench.tsx:220` | 可能已在其他页面删除。删除的作品在回收站里，恢复后点「重新加载」。 | 可能已在其他页面删除。删除的作品可在回收站恢复，恢复后点击「重新加载」。 | 提示里写「点击「X」」 |
| `ip/director/director-workbench.tsx:224` | 加载中… | 正在加载作品… | 加载中统一「正在加载 X…」 |

---

## 3. 剧本页（创意对话 / 粘贴导入 / 剧本编辑 / 长正文）

### 3.1 写剧本前的创意对话（`director-brief.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-brief.tsx:101` | 上一条还没确认是否送达，请先点「按原请求重新发送」或「不发了」。 | 上一条消息的送达状态尚未确认，请点击「按原请求重新发送」或「放弃发送」。 | 书面语；按钮改名同步（见叫法变动） |
| `ip/director/director-brief.tsx:130` | 不再回答问题：按你的想法和已经回答的内容，没说的由 AI 补齐，直接写剧本 | 跳过剩余问题：根据你的想法和已回答的内容写剧本，未提及的部分由 AI 补充 | title 说明书面化 |
| `ip/director/director-brief.tsx:130` | 不聊了，直接生成剧本 | 结束问答，生成剧本 | 按钮去口语（测试受影响） |
| `ip/director/director-brief.tsx:136` | 点「开始聊」，我先看看你的想法，问一两个关键问题。 | 点击「开始对话」，AI 将根据你的想法提出一两个关键问题。 | 这是静态提示不是助手回复；去「先」「看看」 |
| `ip/director/director-brief.tsx:137`、`:206` | 开始聊 | 开始对话 | 按钮标准叫法（测试受影响，见叫法变动） |
| `ip/director/director-brief.tsx:151` | 还想补充，直接在下面说；会按你补充的重新整理，不会再问很多。 | 如需补充，可在下方输入，AI 将据此重新整理。 | 去口语；「不会再问很多」含糊，删 |
| `ip/director/director-brief.tsx:156` | 不发了 | 放弃发送 | 按钮标准叫法 |
| `ip/director/director-brief.tsx:161` | 点上面的选项，或者直接写你的想法。说「你决定」就直接开始写 | 选择上方选项，或输入你的想法。输入「你决定」将直接开始写剧本 | 占位书面化 |
| `ip/director/director-brief.tsx:161` | 补充你的想法，或者说「直接写」 | 补充你的想法，或输入「直接写」 | 同上 |
| `ip/director/director-brief.tsx:176`；`ip/director/director-workbench.tsx:60` | AI 正在看你的想法 | AI 正在分析你的想法 | 去口语「看」 |
| `ip/director/director-brief.tsx:177` | 这一轮没有回复成功 | 本轮回复失败 | 状态用「失败」 |
| `ip/director/director-brief.tsx:177` | 可以再发一次，或者直接生成剧本。 | 可重新发送，或直接生成剧本。 | 去「再」 |
| `ip/director/director-brief.tsx:202` | 先说说你想拍什么 | 你想拍什么故事 | 标题去「先」「说说」 |
| `ip/director/director-brief.tsx:202` | 一句话就行，AI 会问一两个关键问题，再写剧本。 | 用一句话描述你的想法，AI 会提出一两个关键问题，然后写剧本。 | 扫描命中（口语）；去「就行」「再」 |

### 3.2 粘贴 / 上传剧本、长正文

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-script.tsx:71` | 粘贴的剧本还在输入框里，按原因调整后再点保存。 | 粘贴的剧本已保留在输入框中，请按原因调整后点击「保存剧本」。 | 去「再点」，按钮名写全并加引号 |
| `ip/director/director-script.tsx:83` | 返回，用创意生成 | 改用创意生成 | 按钮动词 + 对象 |
| `ip/director/director-script-file.tsx:91` | 文件超过 50 MB，请按章节拆分后上传。没有读取任何内容 | 文件超过 50 MB，请按章节拆分后上传。 | 后半句多余且无句号，删 |
| `ip/director/director-script-file.tsx:97` | 文件没有可读取的文字，请检查正文或先识别扫描件 | 文件中没有可读取的文字。扫描件请先进行文字识别。 | 书面语 |
| `ip/director/director-script-file.tsx:115` | 免费提取文字，可预览后导入正文；网页只取正文，不运行里面的脚本；扫描 PDF 请先识别文字。 | 免费提取文字，预览后导入正文。网页文件仅提取正文，不运行其中的脚本；扫描版 PDF 请先识别文字。 | 书面语 |
| `ip/director/director-script-file.tsx:117` | 」（{sizeText(reading.size)}），已用 {秒数} 秒。完成后可预览，取消不会改动正文。 | 」（{sizeText(reading.size)}），已用时 {秒数} 秒。完成后可预览，取消不会改动正文。 | 已用时统一写「已用时」 |
| `ip/director/director-script-file.tsx:126` | 插到你刚才粘贴的位置，原有正文保留；点击保存才会存入作品。 | 插入到刚才粘贴的位置，原有正文保留；点击「保存」后存入作品。 | 书面语，按钮名加引号 |
| `ip/director/director-script-file.tsx:126` | 导入后仍可编辑，点击保存才会存入作品。 | 导入后仍可编辑，点击「保存」后存入作品。 | 同上 |
| `ip/director/director-long-editor.tsx:66` | 正文共 {n} 字，放进一个编辑框会卡，分成 {k} 段显示。点一段展开编辑，改完收起。 | 正文共 {n} 字，已分为 {k} 段显示。点击某一段展开编辑。 | 「会卡」是开发视角的口语；去冗余 |
| `ip/director/director-long-editor.tsx:87` | 太长，不在这里逐字编辑，{what}。整份都会保存，不截断。 | 篇幅较长，此处不逐字编辑，{what}。全文将完整保存，不截断。 | 书面语 |
| `ip/director/director-long-editor.tsx:88` | 清空，重新输入 | 清空 | 按钮只写动作 |

### 3.3 剧本编辑、下一步卡片、重新生成剧本

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-script.tsx:131`（两处同句） | 一键制作进行中，进度在上方 | 一键制作进行中，进度见页面上方 | 书面语 |
| `ip/director/director-script.tsx:144`；`director-split.tsx:66` | 改动还在编辑框里，按原因调整后再保存。 | 修改内容已保留，请按原因调整后点击「保存」。 | 同一类「下一步」全站一句话；去「再」 |
| `ip/director/director-script.tsx:253`；`director-assets.tsx:273`；`director-storyboard.tsx:500` | 改动还在编辑框里，按原因调整后再点「保存」。 / 改过的内容还在编辑框里，按原因调整后再点「保存」。 / 改过的内容还在输入框里，按原因调整后再点「保存」。 | 修改内容已保留，请按原因调整后点击「保存」。 | 同上，三种说法合一 |
| `ip/director/director-script.tsx:175` | 从拆分集一路自动做到成片，也可以只做到分镜脚本或分镜图。系统先算好推荐预算，你确认后开始。 | 从拆分集自动制作到成片，也可只做到分镜脚本或分镜图。系统会先给出推荐预算，确认后开始。 | 书面语 |
| `ip/director/director-script.tsx:226` | 把后面的步骤连着自动做完，一直到成片，也可以只做到分镜脚本或分镜图。系统先算好推荐预算，你确认后开始。 | 自动完成后续步骤直至成片，也可只做到分镜脚本或分镜图。系统会先给出推荐预算，确认后开始。 | 同上 |
| `ip/director/director-script.tsx:176` | 集，按标题直接分，不花积分。开头不属于任何一集的内容会单独放进设定资料，确认后生效。 | 集，将按标题分集，不消耗积分。开头不属于任何一集的内容会单独放入设定资料，确认后生效。 | 「不花积分」→「不消耗积分」 |
| `ip/director/director-script.tsx:177` | AI 按剧情把剧本拆成分集，只划定每集范围、不改正文。剧本开头的设定资料会单独保留。分好后先给你看，确认后生效。 | AI 按剧情将剧本拆分为多集，只划定每集范围，不改动正文。剧本开头的设定资料会单独保留。拆分结果确认后生效。 | 去口语 |
| `ip/director/director-script.tsx:178` | 先保存剧本 | 请先保存剧本 | 提示补主语动词 |
| `ip/director/director-script.tsx:227` | 项资产。到「资产」给角色、场景和道具生成资产图，分镜图和视频都照着它们画。改了正文可以重新提取，同一人物不会重复新建。 | 项资产。请在「资产」为角色、场景和道具生成资产图，分镜图和视频将以此为参考。修改正文后可重新提取，同一人物不会重复创建。 | 「照着画」口语 |
| `ip/director/director-script.tsx:228` | AI 从全部集里识别角色、场景和道具，先给你确认清单再入库。之后生成资产图、写分镜脚本，每一步都能先看再改。 | AI 从全部集中识别角色、场景和道具，清单经你确认后保存。之后生成资产图、写分镜脚本，每一步都可检查后再修改。 | 去「先…再」 |
| `ip/director/director-script.tsx:313` | 写明时长、集数、人物或「不要对白」等要求，会照做。 | 可写明时长、集数、人物或「不要对白」等要求。 | 「会照做」是对模型效果的承诺，删 |
| `ip/director/director-script.tsx:362` | AI 正在处理这份正文，暂时不能编辑。回复完成或失败后即可继续修改。 | AI 正在处理此正文，暂时不能编辑。回复结束后可继续修改。 | 扫描命中「即可」 |
| `ip/director/director-script.tsx:372`（两个分支） | 只改某一段：先选中它，再点上方的「问 AI」 | 如需修改某一段，请选中后点击上方的「问 AI」 | 去「先…再」，提示写「点击」 |
| `ip/director/director-script.tsx:417` | 原文已经改动，找不到这条建议要替换的段落。可以让助手按现在的正文重新给建议。 | 原文已修改，未找到此建议要替换的段落。可让助手按当前正文重新给出建议。 | 书面语 |
| `ip/director/director-script.tsx:423`；`director-assistant.tsx:565` | （删掉这段） | （删除此段） | 书面语 |

---

## 4. 拆分集与资产提取

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-split.tsx:29` | 按剧本里标好的分集标题分，没有花积分。 | 按剧本中的分集标题拆分，未消耗积分。 | 书面语 |
| `ip/director/director-split.tsx:29` | AI 只划定每集范围，正文一个字都没改。 | AI 仅划定每集范围，未改动正文。 | 去口语 |
| `ip/director/director-split.tsx:35` | 是设定资料，不拍 | 设定资料（不生成画面） | 「拍」改「生成」 |
| `ip/director/director-split.tsx:36` | 是正片，并入第 1 集 | 正片内容（并入第 1 集） | 与上一项同一句式 |
| `ip/director/director-split.tsx:38` | 放在第 1 集正文最前面，会被拍成画面。 | 放在第 1 集正文开头，将生成画面。 | 「拍成」改「生成」 |
| `ip/director/director-split.tsx:53` | 不用这个结果 | 放弃分集 | 按钮标准叫法（与操作名「放弃这次分集」一致） |
| `ip/director/director-split.tsx:71` | 字 · 不拍成画面，提取资产和写分镜脚本时作为参考 | 字 · 不生成画面，提取资产和写分镜脚本时作为参考 | 同上 |
| `ip/director/director-split.tsx:83` | 先保存修改 | 请先保存修改 | 提示补全 |
| `ip/director/director-split.tsx:83` | 这部分其实是正片：整段放到第 1 集最前面 | 将整段内容并入第 1 集正文开头 | title 去口语 |
| `ip/director/director-split.tsx:94` | 回到拆分前的整份剧本，可以重新拆分 | 恢复为拆分前的完整剧本，可重新拆分 | 书面语 |
| `ip/director/director-split.tsx:113` | 集合回一整份，可以重新拆分或作为一集。 | 集合并为完整剧本，可重新拆分或作为一集。 | 书面语 |
| `ip/director/director-split.tsx:114` | 会一起清掉。 | 将一并清除。 | 书面语 |
| `ip/director/director-extract.tsx:31` | 项。保存后在「资产」里点「继续提取」读剩下的集。 | 项。保存后请在「资产」中点击「继续提取剩下 N 集」读取其余集。 | 写「点击」；资产页按钮真实文案是「继续提取剩下 N 集」（`director-assets.tsx:39`），这里引的按钮名不存在 |
| `ip/director/director-extract.tsx:32` | 勾选要保存的，名字可以直接改；已有的同一项会合并，不重复新建。 | 勾选要保存的资产，名称可直接修改；与已有资产相同的会合并，不重复创建。 | 书面语 |
| `ip/director/director-extract.tsx:45` | 本作品里还没有，保存时新建 | 本作品中暂无此项，保存时新建 | 书面语 |

---

## 5. 资产页（列表、添加、详情、参考图、音色）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-assets.tsx:54` | 。生成后逐张确认，分镜图会照着确认过的资产图画。 | 。生成后逐张确认，分镜图将以确认后的资产图为参考。 | 「照着画」口语 |
| `ip/director/director-assets.tsx:64` | 其余的已经开始生成。没提交成功的，按上面的原因处理后在那项资产上单独点「生成」。 | 其余资产图已开始生成。未提交成功的，请按上述原因处理后，在对应资产上点击「生成」。 | 书面语 |
| `ip/director/director-assets.tsx:80` | 补上提取漏掉的角色、场景或道具，可以直接用自己的图 | 补充提取时遗漏的角色、场景或道具，可使用自己的图片 | title 书面化 |
| `ip/director/director-assets.tsx:85` | 张资产图待确认。分镜图将以此为参考，请确认后再继续。 | 张资产图待确认。分镜图将以此为参考，请确认后继续。 | 去「再」 |
| `ip/director/director-assets.tsx:88` | 暂无资产。点「提取全剧资产」，从正文识别角色、场景和道具。 | 暂无资产。点击「提取全剧资产」，从正文识别角色、场景和道具。 | 提示写「点击」 |
| `ip/director/director-assets.tsx:201` | 图片（可选） | 图片（选填） | 选填项统一标「选填」（同页「作品名（选填）」「参考音频（选填）」） |
| `ip/director/director-assets.tsx:206` | 支持手机照片。上传后选这张图怎么用。 | 支持手机照片，上传后选择用途。 | 书面语 |
| `ip/director/director-assets.tsx:215` | 这张图怎么用 | 图片用途 | aria-label 用名词 |
| `ip/director/director-assets.tsx:225`、`:317` | 至少选一集 | 至少选择一集 | 书面语 |
| `ip/director/director-assets.tsx:196` | 填好的内容和图片还在，按原因修改后再点「添加」。 | 已填写的内容和图片已保留，请按原因修改后点击「添加」。 | 去「再点」 |
| `ip/director/director-assets.tsx:259`、`:375` | 资产图没有变。换一张 PNG 或 JPG 图片再试。 / 参考图没有变。换一张 PNG 或 JPG 图片再试。 | 资产图未更改，请换一张 PNG 或 JPG 图片重试。 / 参考图未更改，请换一张 PNG 或 JPG 图片重试。 | 书面语 |
| `ip/director/director-assets.tsx:255`、`:371` | 资产图没有变。 / 参考图没有变。 | 资产图未更改。 / 参考图未更改。 | 同上 |
| `ip/director/director-assets.tsx:262` | 原来的资产图留在历史版本里，随时可以点回去。 | 原资产图保留在历史版本中，可随时切换回来。 | 去口语 |
| `ip/director/director-assets.tsx:263` | 已经生成的分镜图和视频不会自动重做，会标为「需更新」。 | 已生成的分镜图和视频不会自动重新生成，将标记为「需更新」。 | 书面语 |
| `ip/director/director-assets.tsx:283` | 都处理完后回到这里再删除。 | 处理完成后，返回此处删除。 | 去「回到…再」 |
| `ip/director/director-assets.tsx:317` | 还没指定出现的集，不改也能保存 | 尚未指定出现的集，可直接保存 | 书面语 |
| `ip/director/director-assets.tsx:325` | 完善外观设定、出图提示词或音色，也能说说资产图哪里要改；生成新版本前会说清费用，原图保留 | 可完善外观设定、出图提示词或音色，也可说明资产图需要修改的地方；生成新版本前会显示费用，原图保留 | 「说说」「说清」口语 |
| `ip/director/director-assets.tsx:325` | 完善外观设定、出图提示词或音色，比如「更疲惫但别显老」 | 可完善外观设定、出图提示词或音色，例如「更疲惫但别显老」 | 占位举例用「例如」（引号里的示例是用户口吻，保留） |
| `ip/director/director-assets.tsx:331` | 要删除这项资产，先在这些片段里解除关联（「前往」后在「关联资产」里操作）。 | 如需删除此资产，请先在这些片段中解除关联（点击「前往」，在「关联资产」中操作）。 | 书面语 |
| `ip/director/director-assets.tsx:342` | 这项资产就是资产库里已有的那一项，直接用它的图 | 使用资产库中同一项资产的图片作为资产图 | title 书面化 |
| `ip/director/director-assets.tsx:379` | 可选 | 选填 | 同「图片（选填）」 |
| `ip/director/director-assets.tsx:383` | 生成资产图时照着它画{takes} | 生成资产图时参照它的{takes} | 「照着画」口语 |
| `ip/director/director-assets.tsx:384` | 不会替换当前资产图。要按它出新图，点上面的「重新生成」。 | 不会替换当前资产图。如需按参考图生成新版本，请点击上方「重新生成」。 | 「出新图」→「生成」，写「点击」 |
| `ip/director/director-assets.tsx:384` | 现在不生成。点上面的「生成资产图」时会照着它画。 | 上传后不会立即生成。点击上方「生成资产图」时将参照此图。 | 同上 |
| `ip/director/director-assets.tsx:400` | ，它选中版本的图直接作为资产图，分镜图和视频照着它画。名字保留剧本里的叫法。 | ，所选版本的图片将直接作为资产图，用于生成分镜图和视频。名称保留剧本中的叫法。 | 去口语（前半「选资产库里的同一个」→「从资产库选择同一个」） |
| `ip/director/director-voice.tsx:20` | 还没设置。不设置时按人物身份自然配音，各片段的声音可能不一样。 | 未设置。不设置时将按人物身份自然配音，各片段的声音可能不一致。 | 书面语 |
| `ip/director/director-voice.tsx:77` | MP3、WAV 或 M4A，至少 2 秒、最多 25 MB；建议单人说话、没有背景音乐 | MP3、WAV 或 M4A，至少 2 秒，最大 25 MB；建议使用单人说话、无背景音乐的音频 | 书面语（数值与服务端一致：`StudioMediaImportService` 音频 25 MB、`AUDIO_MIN_SECONDS`） |
| `ip/director/director-voice.tsx:109` | 加载中… | 正在加载声音… | 加载中统一写法 |

---

## 6. 分镜页（工具栏、批量、片段卡、分镜图弹窗、关联资产与视频抽屉、镜头编辑、重写）

### 6.1 工具栏、空态、批量

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-storyboard.tsx:68` | 正在重写，完成后再重写整集 | 正在重写，完成后可重写整集 | 去「再」 |
| `ip/director/director-storyboard.tsx:92` | AI 重写本集的镜头，分镜图和视频提示词跟着更新；不出图、不生成视频 | AI 重写本集的镜头，分镜图提示词和视频提示词随之更新，不生成图片和视频 | 「出图」改「生成」 |
| `ip/director/director-storyboard.tsx:95` | 片段时长要按视频模型来定，目前没有可用的视频模型。可以先去「资产」准备资产图，有可用模型后再写分镜脚本。 | 片段时长需按视频模型确定，当前没有可用的视频模型。可先在「资产」准备资产图，待有可用模型后写分镜脚本。 | 书面语 |
| `ip/director/director-storyboard.tsx:101` | 片段划分不变，逐段换一套新镜头，分镜图提示词和视频提示词跟着更新。不会出图，也不会生成视频。 | 片段划分不变，逐段重写镜头，分镜图提示词和视频提示词随之更新，不生成图片和视频。 | 「出图」改「生成」 |
| `ip/director/director-storyboard.tsx:104` | 写分镜脚本期间你改过片段，新写的版本（ / 个片段）没有覆盖现有内容。要换成新版本吗？ | 写分镜脚本期间你修改过片段，新版本（ / 个片段）未覆盖现有内容。是否换成新版本？ | 书面语 |
| `ip/director/director-storyboard.tsx:105` | 请先删除已有分镜图的片段 | 请先删除已有分镜图或视频的片段 | 「信」：`hasMedia` 同时检查分镜图和视频候选 |
| `ip/director/director-storyboard.tsx:109` | 分镜脚本把本集切成几个片段，每段写好镜头、分镜图提示词和视频提示词，一段对应一条视频。写之前先在「资产」准备好角色、场景和道具。 | 分镜脚本会将本集切分为若干片段，每段包含镜头、分镜图提示词和视频提示词，一段对应一条视频。写分镜脚本前，请在「资产」准备角色、场景和道具。 | 空态书面化 |
| `ip/director/director-storyboard.tsx:162` | 其余的已经开始生成。没提交成功的，按上面的原因处理后在那个片段上单独生成。 | 其余片段已开始生成。未提交成功的，请按上述原因处理后，在对应片段上单独生成。 | 书面语 |

### 6.2 片段卡

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-storyboard.tsx:223`、`:305`、`:376` | 还没有分镜图 | 暂无分镜图 | 空态统一「暂无 X」 |
| `ip/director/director-storyboard.tsx:471` | 还没有视频 | 暂无视频 | 同上 |
| `ip/director/director-storyboard.tsx:308` | 分镜图 · 还没有视频 | 分镜图 · 暂无视频 | 同上 |
| `ip/director/director-storyboard.tsx:248` | 片段内的镜头和分镜图将一并移除。 | 片段内的镜头、分镜图和视频将一并删除，且无法恢复。 | 「信」：服务端 `clip.delete` 直接删整条片段（含视频候选），没有撤销 |
| `ip/director/director-storyboard.tsx:257`；`ip/director/director-rewrite.tsx:63` | AI 重写这一段的镜头和提示词，不出图、不生成视频 / 只改这一段的文字，不会出图、不会生成视频，其他片段不变。 | AI 重写此片段的镜头和提示词，不生成图片和视频 / 只修改此片段的文字，不生成图片和视频，其他片段不变。 | 「出图」改「生成」 |
| `ip/director/director-storyboard.tsx:283` | 缺 {n} 张资产图 | 缺少 {n} 张资产图 | 与状态线「缺少 N 张资产图」一致 |
| `ip/director/director-storyboard.tsx:293` | 写好后这一段的镜头、分镜图提示词和视频提示词自动更新。不会出图，也不会生成视频。 | 完成后此片段的镜头、分镜图提示词和视频提示词将自动更新，不生成图片和视频。 | 同上 |
| `ip/director/director-storyboard.tsx:294` | 重写期间你改过这一段，新写的版本（ / 个镜头）没有覆盖现有内容。要换成新版本吗？ | 重写期间你修改过此片段，新版本（ / 个镜头）未覆盖现有内容。是否换成新版本？ | 书面语 |
| `ip/director/director-storyboard.tsx:312` | 点一下换成第 {n} 版 | 点击切换到第 {n} 版 | 写「点击」 |
| `ip/director/director-storyboard.tsx:315` | 角色、场景、道具的标准照，用来锁定长相和环境 | 关联的角色、场景、道具资产图，用于保持长相和环境一致 | 叫法统一「资产图」（AGENTS 已定），不用「标准照」 |
| `ip/director/director-storyboard.tsx:318` | 视频按这张分镜图逐格生成，保证前后镜头一致 | 视频按此分镜图逐格生成，用于保持前后镜头一致 | 「保证」是对模型效果的承诺 |
| `ip/director/director-storyboard.tsx:329` | 不影响生成。要调整就点「编辑镜头」，或重写本集分镜脚本。 | 不影响生成。如需调整，请点击「编辑镜头」或重写本集分镜脚本。 | 去「就点」 |
| `ip/director/director-storyboard.tsx:331` | ，图1 是分镜图，图2 起是关联资产 | ，图 1 为分镜图，图 2 起为关联资产的资产图 | 中文与数字留空格；叫法 |

### 6.3 分镜图弹窗

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-storyboard.tsx:373` | 镜。生成视频时按格逐镜参考，保证前后镜头的人物和环境一致。 | 镜。生成视频时按格逐镜参考，用于保持前后镜头的人物和环境一致。 | 「保证」过度承诺 |
| `ip/director/director-storyboard.tsx:382` | 生成后出现在这里。 | 生成后显示在这里。 | 书面语 |
| `ip/director/director-storyboard.tsx:389` | 正在换成这一张… | 切换中… | 状态简洁 |
| `ip/director/director-storyboard.tsx:389` | 点哪一张，这个片段就用哪一张。 | 点击某一版，即设为此片段的分镜图。 | 去口语 |
| `ip/director/director-storyboard.tsx:393` | 不要改宫格数量、景别和镜头顺序；要改镜头请关掉后点「编辑镜头」 | 请勿修改宫格数量、景别和镜头顺序；如需修改镜头，请关闭此窗口后点击「编辑镜头」 | 书面语 |
| `ip/director/director-storyboard.tsx:397` | 说说哪里要改，比如「第三格改近景」，助手改提示词；生成新版本另外确认费用 | 说明需要修改的地方，例如「第三格改近景」，助手将修改提示词；生成新版本前会单独确认费用 | 去口语 |
| `ip/director/director-storyboard.tsx:411` | 提交重新生成 | 重新生成 | 按钮只写动作 |

### 6.4 关联资产 / 视频抽屉、解除关联

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-storyboard.tsx:429` | 之后这一段出分镜图和视频不再参考「 | 解除后，此片段生成分镜图和视频时不再参考「 | 「出」改「生成」 |
| `ip/director/director-storyboard.tsx:430` | 不会删除；和新的关联对不上的会标成「需更新」，要不要重新生成由你决定。 | 不会删除；与新关联不一致的将标记为「需更新」，是否重新生成由你决定。 | 书面语 |
| `ip/director/director-storyboard.tsx:432` | 」的地方需要自己改。 | 」的地方需手动修改。 | 书面语 |
| `ip/director/director-storyboard.tsx:450` | 角色、场景、道具的标准照，只用来锁定长相、服装和环境；镜头构图看分镜图。 | 资产图仅用于保持人物长相、服装和环境一致，镜头构图以分镜图为准。 | 叫法统一「资产图」 |
| `ip/director/director-storyboard.tsx:452` | 其他片段还在用它，回到资产页可以看是哪些。 | 其他片段仍在使用此资产，可在资产页查看。 | 书面语 |
| `ip/director/director-storyboard.tsx:452` | 没有片段在用它了，回到资产页就可以删除。 | 已没有片段使用此资产，可在资产页删除。 | 书面语 |
| `ip/director/director-storyboard.tsx:453` | 回到资产页 | 返回资产页 | 返回类按钮统一「返回 X」 |
| `ip/director/director-storyboard.tsx:454` | 这个片段还没有关联资产，可在卡片上点「编辑镜头」调整。 | 此片段暂无关联资产，可在片段卡上点击「编辑镜头」添加。 | 空态 + 「点击」 |
| `ip/director/director-storyboard.tsx:465` | 正在解除… | 解除中… | 状态简洁 |
| `ip/director/director-storyboard.tsx:468` | 去资产页修改 | 前往资产页 | 与「前往资产」「前往分镜」一致 |
| `ip/director/director-storyboard.tsx:478` | 正在换成这一版… | 切换中… | 同 6.3 |
| `ip/director/director-storyboard.tsx:478` | 点哪一版，这个片段就用哪一版。 | 点击某一版，即设为此片段的视频。 | 去口语 |

### 6.5 提示词编辑、H3 优化说明

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-storyboard.tsx:522` | 这一段选了按原文生成，中文提示词直接发给视频模型。 | 此片段已选择按原文生成，中文提示词将直接发送给视频模型。 | 书面语 |
| `ip/director/director-storyboard.tsx:524` | 生成视频时，会先把这段提示词改写成 H3 官方要求的英文格式（台词保留中文原文），改写会额外消耗少量积分。 | 生成视频前，将先把提示词改写为 H3 要求的英文格式（台词保留中文原文），改写按实际用量另行扣费。 | 按 Token 计费统一写「按实际用量」，不写「少量」 |
| `ip/director/director-storyboard.tsx:525` | ，花了 {n} 积分 | ，消耗 {n} 积分 | 书面语 |
| `ip/director/director-storyboard.tsx:527` | 优化稿（还没发送） | 优化稿（未发送） | 状态简洁 |
| `ip/director/director-storyboard.tsx:527` | 发给模型的英文 | 已发送的英文提示词 | 补全名词 |

### 6.6 镜头编辑（暴露内部 id）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-storyboard.tsx:568` | 资产「{id}」不存在（取消勾选以移除） | 有一项资产已删除（取消勾选以移除） | 不暴露内部 id（这里插的是资产 id，不是名字） |
| `ip/director/director-storyboard.tsx:585` | 未知角色（{l.speakerId}） | 已删除的角色 | 同上，括号里是内部 id |

### 6.7 重写分镜脚本（`director-rewrite.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-rewrite.tsx:29` | 本集正在写分镜脚本，完成后再重写 | 本集正在写分镜脚本，完成后可重写 | 去「再」 |
| `ip/director/director-rewrite.tsx:31` | 这一段正在重写 | 此片段正在重写 | 书面语 |
| `ip/director/director-rewrite.tsx:32`、`:33` | 视频生成中，完成后再重写 / 分镜图生成中，完成后再重写 | 视频生成中，完成后可重写 / 分镜图生成中，完成后可重写 | 去「再」 |
| `ip/director/director-rewrite.tsx:35` | 先保存或取消镜头修改 | 请先保存或取消镜头修改 | 提示补全 |
| `ip/director/director-rewrite.tsx:46`、`:47` | 手改过的视频提示词会换成新写的 / 手改过的分镜图提示词会换成新写的 | 手动修改过的视频提示词将被替换 / 手动修改过的分镜图提示词将被替换 | 书面语 |
| `ip/director/director-rewrite.tsx:49` | 还有没保存的修改，开始重写后会丢掉 | 有未保存的修改，开始重写后将丢失 | 书面语 |
| `ip/director/director-rewrite.tsx:62` | AI 按本集正文重写这一段的镜头，分镜图提示词和视频提示词跟着更新；这一段在本集里的位置和讲的剧情不变。 | AI 按本集正文重写此片段的镜头，分镜图提示词和视频提示词随之更新；此片段在本集中的位置和剧情不变。 | 书面语 |
| `ip/director/director-rewrite.tsx:64`、`:107` | 已有的分镜图和视频留在历史版本里，会标成「需更新」，要不要重新生成由你决定。 | 已有的分镜图和视频保留在历史版本中，将标记为「需更新」，是否重新生成由你决定。 | 书面语 |
| `ip/director/director-rewrite.tsx:101` | AI 按本集正文重新写镜头，每个片段的分镜图提示词和视频提示词跟着更新。只改文字，不会出图、不会生成视频，其他集不受影响。只想换某一段，关掉这里，在那个片段上点「重写」。 | AI 按本集正文重写镜头，各片段的分镜图提示词和视频提示词随之更新。只修改文字，不生成图片和视频，其他集不受影响。如只需重写某个片段，请关闭此窗口，在该片段上点击「重写」。 | 「出图」改「生成」，书面语 |
| `ip/director/director-rewrite.tsx:102`、`:103` | 怎么重写 | 重写方式 | 字段名用名词 |
| `ip/director/director-rewrite.tsx:107` | 片段的数量和顺序不变，每段换一套新镜头。 | 片段的数量和顺序不变，每段重写镜头。 | 书面语 |
| `ip/director/director-rewrite.tsx:112` | 已有分镜图或视频，重新切分会丢掉它们，所以现在不能选。要重新切分，先删除这些片段。 | 已有分镜图或视频，重新切分会丢失这些内容，暂不可选。如需重新切分，请先删除这些片段。 | 书面语 |
| `ip/director/director-rewrite.tsx:117` | 现有镜头会换成新写的，包括你在「编辑镜头」里改过的内容。 | 现有镜头将被替换，包括你在「编辑镜头」中修改过的内容。 | 书面语 |
| `ip/director/director-rewrite.tsx:119` | 。写好后自动显示，关掉页面也不中断。 | 。完成后自动显示，关闭页面不影响进行。 | 书面语 |

### 6.8 片段视频、导出（`director-output.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-output.tsx:41` | 先处理上面标出的问题 | 请先处理上方标出的问题 | 与同组「请先生成分镜图」一致 |
| `ip/director/director-output.tsx:44` | 正在重新优化提示词，好了之后由你决定用哪一份 | 正在重新优化提示词，完成后可选择使用哪一份 | 去口语 |
| `ip/director/director-output.tsx:45` | 。约需数分钟，关闭页面不中断 | 。通常需要几分钟，关闭页面不影响生成 | 统一说法（示例「通常需要几分钟」） |
| `ip/director/director-output.tsx:53` | 优化稿太长，视频模型收不下 | 优化稿过长，超出视频模型限制 | 去口语（测试受影响） |
| `ip/director/director-output.tsx:54` | 优化稿有需要留意的地方 | 优化稿有需要注意的问题 | 书面语 |
| `ip/director/director-output.tsx:59` | 重新改写一版提示词，只出稿、不生成视频，按实际用量另扣少量积分 | 重新改写提示词，不生成视频，按实际用量另行扣费 | 去「少量」「出稿」 |
| `ip/director/director-output.tsx:73` | 上一份优化稿太长用不了。重新改写一版，只出稿、不生成视频，按实际用量另扣少量积分 | 上一份优化稿过长，无法使用。重新改写提示词，不生成视频，按实际用量另行扣费 | 同上 |
| `ip/director/director-output.tsx:75` | 先按 H3 官方写法优化提示词再生成，会额外消耗少量积分 | 按 H3 写法优化提示词后生成视频，优化按实际用量另行扣费 | 同上，去「先…再」 |
| `ip/director/director-output.tsx:78` | ，另需少量积分优化提示词 | ，提示词优化按实际用量另计 | 同上（测试受影响） |
| `ip/director/director-output.tsx:85` | （优化稿太长，没用上） / （优化没成功） / （你选的） | （优化稿过长，未使用） / （优化失败） / （手动选择） | 书面语，状态用「失败」 |
| `ip/director/director-output.tsx:86` | 这条视频用的是优化后的提示词 / 这条视频用的是中文原文 | 此视频使用优化后的提示词 / 此视频使用中文原文提示词 | 书面语（测试受影响） |
| `ip/director/director-output.tsx:87` | ，这份优化稿花了 {n} 积分 | ，优化消耗 {n} 积分 | 书面语（测试受影响） |

---

## 7. 工作台外壳：状态线、停止、一键制作

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-workbench.tsx:61` | 第一步：说说你的想法，或粘贴剧本 | 第一步：描述你的想法，或粘贴剧本 | 去「说说」 |
| `ip/director/director-workbench.tsx:62` | 下一步：信息够了，生成剧本 | 下一步：生成剧本 | 删冗余 |
| `ip/director/director-workbench.tsx:84` | 片段视频生成中，完成后自动出现在片段卡 | 片段视频生成中，完成后将显示在片段卡上 | 书面语 |
| `ip/director/director-workbench.tsx:274` | 规划分镜 | 写分镜脚本 | 叫法统一：`plan` 任务全站叫「写分镜脚本」（按钮显示为「停止规划分镜」） |
| `ip/director/director-workbench.tsx:275` | 已停止后续处理，已提交模型的请求仍在等待用量结算。可另行确认生成，原请求按实际用量计费。 | 已停止后续处理。已提交给模型的请求正在等待用量结算，将按实际用量计费；如需重新生成，可另行发起。 | 「可另行确认生成」读不懂 |
| `ip/director/director-workbench.tsx:289` | 名字已恢复成原来的，可以重新输入后再试。 | 作品名已恢复为原名称，请重新输入后重试。 | 书面语 |
| `ip/director/director-workbench.tsx:323` | 从剧本一路做到每集的成片：拆分集、提取资产、写分镜脚本、出资产图和分镜图、生成片段视频，最后导出整集。 | 从剧本制作到每集成片：拆分集、提取资产、写分镜脚本、生成资产图和分镜图、生成片段视频，最后导出整集。 | 「出」改「生成」 |
| `ip/director/director-workbench.tsx:325` | 只做文字：拆分集、提取资产、写分镜脚本（每段的镜头、分镜图提示词和视频提示词），不出图。 | 只处理文字：拆分集、提取资产、写分镜脚本（每段的镜头、分镜图提示词和视频提示词），不生成图片。 | 同上 |
| `ip/director/director-workbench.tsx:335` | 快捷方式：从剧本一路自动做到成片（也可以只做到分镜脚本或分镜图），后台执行，关掉页面不中断。想逐步检查每一步，就按剧本页的步骤来。 | 从剧本自动制作到成片（也可只做到分镜脚本或分镜图），在后台执行，关闭页面不影响进行。如需逐步检查，请按剧本页的步骤操作。 | 书面语 |
| `ip/director/director-workbench.tsx:434` | 的分镜脚本都已写好。一键制作只补还没做的步骤，不会重写已有的分镜脚本；要重写，请到「分镜」点「重写分镜脚本」（整集），或在片段上点「重写」（单段）。 | 的分镜脚本均已写好。一键制作只补充未完成的步骤，不会重写已有的分镜脚本；如需重写，请在「分镜」点击「重写分镜脚本」（整集），或在片段上点击「重写」（单段）。 | 写「点击」，书面语 |
| `ip/director/director-workbench.tsx:452` | 这是快捷方式，后面几步会连着自动做完。想每一步先看再改，就关掉这个窗口，在剧本页按步骤来。 | 一键制作会自动连续完成后续步骤。如需逐步检查和修改，请关闭此窗口，按剧本页的步骤操作。 | 去口语 |
| `ip/director/director-workbench.tsx:455` | 已经做好的不重做，已有内容不覆盖。 | 已完成的步骤不重复执行，已有内容不会被覆盖。 | 书面语 |
| `ip/director/director-workbench.tsx:461` | 关键步骤停下来让我确认 | 关键步骤暂停等我确认 | 勾选项去口语（保留用户第一人称，勾选项常用） |
| `ip/director/director-workbench.tsx:461` | 出来后先等你看过再继续。不勾就全自动，做完再看。 | 生成后暂停，确认后继续。不勾选则全自动完成。 | 去「先…再」 |
| `ip/director/director-workbench.tsx:472` | 推荐值比估算多留约 15% 余量；用到上限会暂停，不会超支，没用完的不扣。 | 推荐预算在估算基础上预留约 15% 余量；达到上限会暂停，不会超支，未用完的部分不扣除。 | 书面语（「15%」是代码真实系数，服务端 `pipeline/estimate` 同口径） |
| `ip/director/director-workbench.tsx:475` | 积分，做到一半会暂停。 | 积分，制作中途会暂停。 | 书面语 |

---

## 8. 作品设置

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-settings.tsx:35` | 设置没有保存：{m}。改动还在，调整后再点「保存」。 | 设置保存失败：{m}。修改内容已保留，请调整后点击「保存」。 | 去「再点」 |
| `ip/director/director-settings.tsx:47` | 原文本模型不在可选范围内，换一个模型才能继续写剧本和分镜。其他设置可以照常保存。 | 原文本模型已不可用，请更换模型后继续写剧本和分镜脚本。其他设置可正常保存。 | 书面语；叫法「分镜脚本」 |
| `ip/director/director-settings.tsx:57` | 原图片模型不在可选范围内，换一个模型才能继续出图。其他设置可以照常保存。 | 原图片模型已不可用，请更换模型后继续生成图片。其他设置可正常保存。 | 「出图」改「生成」 |
| `ip/director/director-settings.tsx:69` | 同时参考分镜图、角色 / 场景 / 道具图和角色声音。片段时长按模型支持的范围来定。 | 同时参考分镜图、资产图和角色声音，片段时长按模型支持的范围确定。 | 叫法「资产图」 |
| `ip/director/director-settings.tsx:86` | 原图片模型已停用，资产图和分镜图暂时生成不了，换一个模型才能继续出图。其他设置可以照常保存。 | 原图片模型已停用，暂时无法生成资产图和分镜图，请更换模型。其他设置可正常保存。 | 书面语（测试受影响） |
| `ip/director/director-settings.tsx:97` | {who}{name}不能出{missing}，{affected}的图生成不了；其他画面照常{price}。换一个模型才能出全部画面，不换也可以保存其他设置。 | {who}{name}不支持{missing}，无法生成{affected}的图片；其他画面不受影响{price}。更换模型后可生成全部画面，不更换也可保存其他设置。 | 「出」改「生成/支持」（测试受影响） |
| `ip/director/director-settings.tsx:98` | {who}{name}不能出{missing}，当前画幅下不影响出图{price}。 | {who}{name}不支持{missing}，当前画幅下不影响生成{price}。 | 同上 |

---

## 9. 全能创作助手（侧边栏 + 浮层对话）

快捷提示（`director-assistant.tsx:445–447`、`:815–822`）是填进输入框、由用户发出的话，按规则保留用户口吻，不改。

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-assistant.tsx:171`、`:172` | 有没保存的修改，请先保存或撤销，再采用助手的建议 | 有未保存的修改，请保存或撤销后采用助手的建议 | 书面语，去「先…再」 |
| `ip/director/director-assistant.tsx:208` | 有镜头时长没填好，改好或撤销后再发送 | 有镜头时长未填写，请修改或撤销后发送 | 书面语 |
| `ip/director/director-assistant.tsx:244` | 选中的段落改过了，请在正文里重新选择要修改的地方 | 选中的段落已修改，请在正文中重新选择 | 书面语 |
| `ip/director/director-assistant.tsx:248` | AI 正在处理这份正文，请等回复完成后再修改 | AI 正在处理此正文，请在回复完成后修改 | 去「再」 |
| `ip/director/director-assistant.tsx:411` | 回复完成后再开新对话 | 回复完成后可新建对话 | 去「再」 |
| `ip/director/director-assistant.tsx:411` | 开一段新对话，之前的对话留在历史里 | 新建对话，之前的对话保留在历史对话中 | 书面语 |
| `ip/director/director-assistant.tsx:449` | 选中正文、点镜头或图片旁的「AI」按钮，我就知道你要改哪里。讨论的时候我只给分析和方向，你说「改」我才给修改建议，采用前都能先对比。 | 选中正文，或点击镜头、图片旁的「AI」按钮，指定要修改的内容。讨论时只给出分析和方向，你明确要求修改后才给出修改建议，采用前可先对比。 | 这是固定的欢迎说明，不是模型回复；去口语 |
| `ip/director/director-assistant.tsx:470` | 助手没有回复成功 | 回复失败 | 状态用「失败」 |
| `ip/director/director-assistant.tsx:483` | 条建议对不上原文或超出这次的修改范围，已略过。 | 条建议与原文不符或超出本次修改范围，已忽略。 | 书面语 |
| `ip/director/director-assistant.tsx:522`、`:523` | 分镜图提示词是你改过的，不会跟着镜头变；需要的话让助手一起改。 / 视频提示词是你改过的，不会跟着镜头变；需要的话让助手一起改。 | 分镜图提示词已自定义，不会随镜头更新；如需修改，可让助手一并调整。 / 视频提示词已自定义，不会随镜头更新；如需修改，可让助手一并调整。 | 书面语 |
| `ip/director/director-assistant.tsx:528`、`:535` | 已有的分镜图会标为「需更新」；要新图请点「生成新版本」。 / 已有的资产图会标为「需更新」；要新图请点「生成新版本」。 | 已有的分镜图将标记为「需更新」；如需新图，请点击「生成新版本」。 / 已有的资产图将标记为「需更新」；如需新图，请点击「生成新版本」。 | 写「点击」 |
| `ip/director/director-assistant.tsx:592` | 采用文字后，以当前这张为参考生成一张新图（另外计费） | 采用文字修改后，以当前图片为参考生成新版本（另行计费） | 书面语 |
| `ip/director/director-assistant.tsx:595` | 不用了 | 不采用 | 按钮标准叫法 |
| `ip/director/director-assistant.tsx:605` | 没有采用 | 未采用 | 状态 |
| `ip/director/director-assistant.tsx:617` | 删掉原第 | 删除原第 | 书面语 |
| `ip/director/director-assistant.tsx:619` | 镜 · 改了 | 镜 · 修改了 | 书面语 |
| `ip/director/director-assistant.tsx:645` | 这部作品的文本模型，和「作品设置」里的是同一项：写剧本、拆分集、写分镜也用它。 | 即本作品的文本模型，与「作品设置」中的选项相同，也用于写剧本、拆分集和写分镜脚本。 | 书面语，叫法「分镜脚本」 |
| `ip/director/director-assistant.tsx:655` | 模型没有换成：{m} | 模型切换失败：{m} | 状态用「失败」 |
| `ip/director/director-assistant.tsx:702` | 上一条消息还没确认是否送达，请先按原请求核对送达状态，再发新的消息。 | 上一条消息的送达状态尚未确认，请点击「按原请求重新发送」核对后，再发送新消息。 | 书面语，指向真实按钮 |
| `ip/director/director-assistant.tsx:733` | 没确认送达的消息 | 未确认送达的消息 | aria-label 书面语 |
| `ip/director/director-assistant.tsx:736` | 不发了 | 放弃发送 | 按钮标准叫法 |
| `ip/director/director-assistant.tsx:782` | 助手正在回复，你可以继续改内容，回复完成后再发送 | 助手正在回复，可继续编辑，回复完成后发送 | 去「再」 |
| `ip/director/director-assistant.tsx:782` | 说说你的想法，或者要怎么改。Enter 发送，Shift+Enter 换行 | 输入你的想法或修改要求。Enter 发送，Shift+Enter 换行 | 占位去口语 |
| `ip/director/director-assistant.tsx:792`、`:982` | 等这条回复完成 | 请等待回复完成 | title 书面语 |
| `ip/director/director-assistant.tsx:880` | （还是空的） | （暂无内容） | 空态统一 |
| `ip/director/director-assistant.tsx:950` | 按住标题栏可以拖动 | 按住标题栏可拖动 | 简洁 |
| `ip/director/director-assistant.tsx:954` | 转到侧边栏的创作助手，可以看历史对话 | 转到侧边栏的创作助手，可查看历史对话 | 书面语 |
| `ip/director/director-assistant.tsx:962` | 说说你想怎么改，我先给建议，你看过对比再决定用不用。 | 输入修改要求，助手会先给出建议，你可在对比后决定是否采用。 | 固定空态说明，去口语 |
| `ip/director/director-assistant.tsx:976` | AI 正在回复，回复完成后再发送 | AI 正在回复，回复完成后可发送 | 去「再」 |
| `ip/director/director-assistant.tsx:976` | 想怎么改？比如「 | 想如何修改？例如「 | 占位举例用「例如」 |
| `ip/director/director-assistant.tsx:1109` | 按住标题栏可以拖到别处，拖四边或右下角可以调整大小 | 按住标题栏可拖动位置，拖动边缘或右下角可调整大小 | 书面语 |

---

## 10. 共用组件（`director-shared.tsx`、`director-pending.ts`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/director/director-shared.tsx:136` | 可以关闭页面，后台继续，完成后自动显示 | 可离开此页面，后台将继续处理，完成后自动显示 | 示例写法「可离开此页面……」 |
| `ip/director/director-pending.ts:44` | 网络不稳定，发送状态还不确定。 | 网络不稳定，送达状态尚未确认。 | 书面语 |
| `ip/director/director-pending.ts:56` | 网络不稳定，这条消息的发送状态还不确定。内容已保留，再点发送会按原请求恢复，不会重复扣费。 | 网络不稳定，此消息的送达状态尚未确认。内容已保留，重新发送将按原请求恢复，不会重复扣费。 | 去「再点」 |
| `ip/director/director-script-reference.tsx:57` | 正文改过，找不到这个片段的起始句；下面是本集全文。 | 正文已修改，未找到此片段的起始句，以下为本集全文。 | 书面语 |
| `ip/director/director-script-reference.tsx:57` | 这个片段没有记录对应的正文位置（旧片段或拆出来的片段），下面是本集全文。 | 此片段未记录对应的正文位置，以下为本集全文。 | 括号里是内部原因，删 |
| `ip/director/director-script-reference.tsx:71` | · 写分镜后正文改过 | · 写分镜脚本后正文已修改 | 叫法「分镜脚本」 |
| `ip/director/director-script-reference.tsx:79` | 点片段卡上的「对照剧本」，这里会标出它对应的段落。 | 点击片段卡上的「对照剧本」，此处将标出对应段落。 | 写「点击」 |
| `ip/director/director-script-reference.tsx:83` | 本集还没有正文。 | 本集暂无正文。 | 空态统一 |

---

## 叫法变动（全仓同步）

1. **「不发了」→「放弃发送」**（按钮）
   - `apps/web-aiavatar/src/ip/director/director-brief.tsx:101`（提示里引用）、`:156`（按钮）
   - `apps/web-aiavatar/src/ip/director/director-assistant.tsx:736`（按钮）
   - `docs/ai-director-assistant.md:44`（引用了按钮名，需同步）
   - `apps/web-drama/src/canvas/core/use-canvas-runs.tsx:76` 也出现「不发了」，是 drama 另一句话，不在本批，不动。

2. **「开始聊」→「开始对话」**（导演台创意对话按钮）
   - `apps/web-aiavatar/src/ip/director/director-brief.tsx:136`（提示里引用）、`:137`、`:206`（按钮）
   - `apps/web-aiavatar/src/ip/director/director-brief.test.tsx:49`（注释）、`:54`（断言）
   - `apps/web-aiavatar/README.md:1164`（回收站说明里引用「开始聊」）
   - `docs/audits/director-trash-independent-review-20261029.md:16`（历史审计记录，建议不改）
   - web-drama 的「开始聊」（`apps/web-drama/src/app/(workspace)/dashboard/page.tsx:221`、`docs/drama-ux-copy-pass.md:179`）是 drama 术语表定的，不同产品，不动。

3. **「规划分镜」→「写分镜脚本」**（停止按钮里的任务名）
   - `apps/web-aiavatar/src/ip/director/director-workbench.tsx:274`
   - `docs/audits/director-script-stale-and-latency-20261026.md:19`（历史审计，不改）
   - 服务端 seed（`drama-recipes-official.json:182`、`flova-skill-example-videos.json:110`）是 drama 技能描述，无关。

4. **「标准照」→「资产图」**（界面上）
   - 前端可见：`apps/web-aiavatar/src/ip/director/director-storyboard.tsx:315`（title）、`:450`（说明）；`:417` 是注释，可一并改。
   - 服务端 `apps/server/src/main/java/com/aistareco/aep/ipstudio/director/DirectorPrompts.java:847` 的「参考图2起为资产标准照」是**发给模型的提示词**，不归界面规则管，不改。docs 下的提示词审阅稿同理不改。

5. **「回到资产页」→「返回资产页」、「去资产页修改」→「前往资产页」**：只在 `director-storyboard.tsx:453`、`:468`，无其他引用。

6. **「不用这个结果」→「放弃分集」**：只在 `director-split.tsx:53`。

7. 「提交重新生成」→「重新生成」：只在 `director-storyboard.tsx:411`（`:342` 是注释）。

---

## 测试会受影响的

| 测试 | 断言 | 建议 |
|---|---|---|
| `ip/director/director-brief.test.tsx:41` | `getByRole("button", { name: /跳过，直接生成剧本/ })` | 文案若保留「跳过，直接生成剧本」可不动；若同步改，建议给按钮加稳定的 `data-testid` 或改断言 `title` 之外的结构（例如 header 内唯一的 `ip-brand-*` 按钮） |
| `ip/director/director-brief.test.tsx:54` | `findByRole("button", { name: "开始聊" })` | 改成新文案「开始对话」，或用 `.director-self-start` 类名定位 |
| `ip/director/director-brief.test.tsx:73` | `name: /不聊了，直接生成剧本/` | 同 :41 |
| `ip/director/director-trash.test.tsx:37`、`:84` | `findByText("回收站是空的")` | 改为断言空态结构（`.director-empty` 存在、含「返回作品列表」链接），或同步成新文案 |
| `ip/director/director-video-rewrite.test.tsx:18` | `/12 秒，约 480 积分，另需少量积分优化提示词/` | 断言价格数字（`480 积分`）与「按实际用量」关键词即可；文案本身是被测行为（必须说清改写另计费），保留关键词断言 |
| `ip/director/director-video-rewrite.test.tsx:58` | `getByText("优化稿太长，视频模型收不下")` | 改为断言 `role=group name=优化稿待确认` 存在且不出现「用优化稿生成」按钮（这才是 too_long 的行为） |
| `ip/director/director-video-rewrite.test.tsx:85` | 整句「这条视频用的是中文原文（优化稿太长，没用上），这份优化稿花了 12 积分」 | 这是 `promptUsedText` 纯函数的输出，可直接对新句子做单元断言；或拆成断言包含「中文原文」「12 积分」 |
| `ip/director/director-settings.test.tsx:28` | `/原图片模型已停用，资产图和分镜图暂时生成不了/` | 改为断言「已停用」关键词 |
| `ip/director/director-settings.test.tsx:49`、`:52`、`:61` | `/…不能出方图，道具的图生成不了；其他画面照常，约 55 积分\/张。/` 等 | `imageStateNote` 是纯函数：断言它返回的句子含受影响类别（「道具」「分镜」）和价格即可，不断言整句 |
| `ip/director/director-settings.test.tsx:18`、`:64` | `/用于资产图和分镜图，约 37 积分\/张。/` | 本批未改此句；若采纳「存疑 1」去掉「约」需同步 |

`ip/director/director-rewrite.test.tsx:50`、`:75` 断言「不出现 `\d+ 积分`」，与第 1 节去掉冻结上限的方向一致，改后可在 `director-assistant.test.tsx` / `director-brief.test.tsx` 补同样的断言防回退。

---

## 需要核实或连带改行为

1. **冻结上限门禁正在红**：`git grep -n 'pricing.textMax.toLocaleString' -- apps/web-aiavatar/src` 现命中 `director-assistant.tsx:789`、`:980`；`director-brief.tsx:149`、`:167` 通过 `const cost = work.pricing.textMax`（`:39`）绕过了这条 grep，同样显示冻结上限。改文字即可，不涉及行为；建议门禁改成同时扫 `cost.toLocaleString` 在 brief 里的用法，或在 brief 里不再声明 `cost` 用于展示。

2. **删除片段的确认文案与行为不符**（`director-storyboard.tsx:248`）：服务端 `DirectorService` `case "clip.delete"`（约 584 行）直接 `remove(c, "clips", id)`，片段连同**全部视频候选**一起删掉，也没有撤销；且没有检查该片段是否有在途视频（`video.pending`），而同文件的 `clip.unlinkAsset` 在 598 行是拦了的。文案改成「镜头、分镜图和视频将一并删除，且无法恢复」后，还建议确认：在途视频时是否应拒绝删除（否则视频回投找不到片段）。

3. **「已有分镜图的片段要先删掉」已过时**（`director-script.tsx:270`）：`分镜脚本写好后正文又改过……可在「分镜」重写分镜脚本（已有分镜图的片段要先删掉）。` 现在整集「重写分镜脚本」默认是 `reshoot`（保留片段，已有分镜图和视频留作历史并标「需更新」），只有「重新切分片段」才要求先删除。建议改为：`分镜脚本写好后正文又改过，片段可能与正文不一致。可在「分镜」重写分镜脚本。`

4. **「继续提取」按钮名对不上**（`director-extract.tsx:31`）：说明让用户点「继续提取」，资产页实际按钮是「继续提取剩下 N 集」（`director-assets.tsx:39`），且只有 `batched && 已有资产 && 剩余集数 < 总集数` 时才出现这个名字，其他情况叫「重新提取全剧资产」。表里已按真实名字改写；如果想更稳，可写成「保存后在「资产」中继续提取剩下的集」。

5. **灰按钮 + 只在 title 里写原因**：AGENTS「重写分镜脚本与一键制作无事可做」一条写明「不能操作时按钮照样能点，点了说原因，不做点了没反应的灰按钮」，分镜页的「重写」已经这样做（`modal.info`）。下面几处仍是 `disabled` + `title`，PC 上鼠标悬停才看得到原因，触屏完全看不到：
   - `director-script.tsx:289`「重新生成剧本」（已有分镜图/视频或助手回复中时禁用）
   - `director-storyboard.tsx:105`「换成新版本」（`hasMedia` 时禁用）
   - `director-split.tsx:83`「并入第 1 集」（未保存时禁用，title「先保存修改」）
   - `director-assets.tsx:224`「添加」虽然旁边有「至少选一集」，但名称为空时没有任何提示
   要改文字就得连带改成可点 + 弹出原因，这属于行为改动。

6. **视频进度百分比**（`director-output.tsx:45`）：`视频生成中：{stage} {pct}%` 的 `pct` 取自素材视频任务的 `progress_pct`（`DirectorService.java` 约 1599 行 ← `MaterialVideoJobService` `job.getProgress()`）。规则要求不编百分比；需要确认聚算 H3 是否真的回进度，如果是我方按阶段写的固定值，应去掉百分比只留阶段。

7. **「约」字与真实价格**（`director-shared.tsx:111` `costText`）：所有图片、视频价格都显示「约 N 积分」。图片按 `work.pricing.image` 定价、视频按服务端 `quote` 的报价冻结，接入点有折扣时实际扣费可能更低。若报价已含折扣、即为最终价，「约」应去掉；若可能因折扣/赠款变动，保留。需按 `ModelChargeContext` 的实际结算口径确认（见下「存疑 1」）。

8. **AGENTS.md 里的声音样本限制已过时**（不是界面问题，顺手记）：AGENTS「导演台角色声音参考」写「2–15 秒、最多 15 MiB」，代码是最多 25 MB、至少 2 秒、超过 14.9 秒截取前 14.9 秒（`StudioMediaImportService.java:44`、`AUDIO_REFERENCE_NOTICE`）。界面文字（`director-voice.tsx:77`）与代码一致，要改的是 AGENTS.md。

---

## 仅手机端（不改，列出备查）

- `ip/director/director-script-reference.tsx:30`「对照第 {n} 集剧本」按钮：在 `.director-board-side-mobile` 里，`styles/director.css:803` 桌面隐藏。
- 助手在手机上是全屏面板（同一组件），文字与桌面相同，已在第 9 节处理。

---

## 存疑（拿不准的，给两种写法）

1. **价格前的「约」**（`director-shared.tsx:111`，全页通用）
   - A：保留「约 8 积分」（报价可能因折扣、赠款变化）
   - B：改「8 积分」（若报价即最终冻结价）。改 B 要同步 `director-settings.test.tsx:18/49/64`、`director-video-rewrite.test.tsx:18`。

2. **「出图提示词」字段名**（`director-assets.tsx:314`、`:315`、`:348`；`director-assistant.tsx:349`、`:350`、`:579`；服务端 staleReasons「描述或出图提示词已修改」会显示在「需更新」说明里）
   - A：保留「出图提示词」（AGENTS 与服务端已大量使用，改动面大）
   - B：改「资产图提示词」，与分镜页的「分镜图提示词」对称、去掉「出图」。需同步服务端 `DirectorService.java:2746`、`:3901`、`:4086` 的可见报错/原因文案和相关测试（`DirectorImagePromptFormatTest.java:159`、`DirectorImageTemplateVersionTest.java:112`）。

3. **「先聊几句，再写剧本」标题**（`director-brief.tsx:126`）与「可以开始写剧本了」（`:140`）
   - A：「创意沟通」/「可以写剧本了」
   - B：保留现状（这一步本身就是对话，口语可接受）

4. **「去生成分镜图」**（`director-output.tsx:67`）：点了是打开分镜图弹窗，不直接扣费。AGENTS 发布记录里提过这个按钮名。
   - A：「生成分镜图」（动词 + 对象，弹窗里再显示价格）
   - B：「前往生成分镜图」（说明会跳转）

5. **「做到哪一步」**（`director-workbench.tsx:453`，一键制作弹窗的字段名）
   - A：「制作到」
   - B：保留（短、易懂）

6. **「自己上传」角标**（`director-assets.tsx:117`、`:300`）
   - A：「已上传」
   - B：保留「自己上传」（与「资产库」「测试图」区分来源，意思清楚）

7. **提取清单弹窗的「不保存」**（`director-extract.tsx:55`，红色危险按钮，实际是丢弃整份清单、一键制作在此停止）
   - A：「丢弃清单」
   - B：保留「不保存」

---

# 第六批 · 资产、发行（含名片 / 授权）

读过的文件（括号内为 inscope 条数，均已打开源码看上下文）：
`app/assets/page.tsx`（4）、`app/assets/[id]/page.tsx`（74）、`app/ips/page.tsx`（0，只是重定向）、`app/distribution/**`（0，三页都只渲染 `StudioDistribution`）、`app/cards/page.tsx`（26）、`app/cards/[id]/edit/page.tsx`（95）、`app/card/p/[slug]/page.tsx`（6）、`app/licenses/page.tsx`（29）、`components/card/card-view.tsx`（59）、`components/card/persona-studio.tsx`（39）、`components/hub/asset-cards.tsx`（10）、`components/hub/assets-library.tsx`（11）、`ip/assets-hub.tsx`（73）、`ip/assets-hub-shared.ts`（5）、`ip/assets-people.tsx`（51）、`ip/asset-thumb.tsx`（2）、`ip/personal-asset-library.tsx`（93）、`ip/supplementary-asset-library.tsx`（67）、`ip/studio-ip-library.tsx`（65）、`canvas-bridge/studio-ip-library.ts`（11）、`canvas-bridge/library-reference.ts`（4）、`ip/library-asset-editor.tsx`（48）、`ip/library-extraction-panel.tsx`（44）、`ip/library-folder-select.tsx`（3）、`ip/library-media-picker.tsx`（25）、`ip/library-reference-picker.tsx`（18）、`ip/library-script-assets.tsx`（25）、`ip/ip-management.tsx`（101）、`ip/ip-management-data.ts`（5）、`ip/personal-ip-prompts.ts`（14，全是拼给模型的提示词和选项名，无需改）、`ip/studio-distribution.tsx`（69）、`ip/studio-social-bind.tsx`（26）。

说明：`/assets/[id]`、`/cards`、`/cards/[id]/edit`、`/licenses`、`/card/p/[slug]` 用的是 hub 样式（`HubScreen`），但不在 `(mobile)` 路由下，桌面顶栏菜单（`shell/desktop-top-bar.tsx:52-53`）和 `/me` 都链到这些页面，所以按 PC 可见处理。新版资产页是 `ip/assets-hub.tsx` + `ip/assets-people.tsx`；旧版资产页（正式站默认）是 `components/hub/assets-library.tsx` 下的 `ip-management` / `personal-asset-library` / `supplementary-asset-library`，两套都列了。

---

## 资产页 · 外壳（新旧版共用）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `components/hub/assets-library.tsx:40`、`ip/assets-hub.tsx:80`、`app/assets/page.tsx:7` | 人物、声音与创作素材，让每一次灵感有所承接。 | 人物、声音和创作素材，创作时可直接使用。 | 旧版页头说明；「让……有所承接」是营销腔，空话 |
| `components/hub/assets-library.tsx:40`、`app/assets/page.tsx:7` | 人物、声音和素材，做什么都能直接拿来用 | 人物、声音和素材，创作时可直接使用。 | 新版说明；口语「拿来用」 |
| `ip/assets-hub.tsx:80` | 上传的和 AI 做的都在这里，做视频、出图时直接拿来用 | 上传和 AI 生成的素材都在这里，生成图片和视频时可直接使用。 | 口语「做的」「出图」「拿来用」；统一「生成」 |
| `components/hub/assets-library.tsx:41`、`app/assets/page.tsx:7` | 正在打开资产… | 正在加载资产… | 统一「正在加载 X…」 |

## 资产页 · 新版（assets-hub / assets-people）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/assets-hub.tsx:109` | 里面的东西不会删，会回到「全部」里。画布里已经用上的也不受影响。 | 库中的素材不会被删除，仍可在「全部」中找到。已在画布中使用的素材不受影响。 | 确认弹窗正文写后果，去口语「东西」「用上」 |
| `ip/assets-hub.tsx:119`、`:141` | 改名 | 重命名 | 标准叫法；弹窗标题（141）建议「重命名资产库」 |
| `ip/assets-hub.tsx:123`、`:275` | 重新读取 | 重试 | 按钮用标准叫法；全批统一（见「叫法变动」） |
| `ip/assets-hub.tsx:260` | 做出来的图片、视频和音频会自动放在这里，移到别的资产库就从这里拿走。 | AI 生成的图片、视频和音频会自动保存在这里，移到其他资产库后不再显示在此处。 | 口语「做出来」「拿走」 |
| `ip/assets-hub.tsx:267` | 正在读取… | 正在加载… | 统一加载中写法 |
| `ip/assets-hub.tsx:276` | 正在读取资产（aria-label） | 正在加载资产 | 同上 |
| `ip/assets-hub.tsx:278` | 这里还是空的 | 还没有 AI 生成的素材 | 空态说清缺什么 |
| `ip/assets-hub.tsx:278` | 在 AI 图片、AI 视频或画布里做出来的东西会自动放进来。 | 在 AI 图片、AI 视频或画布中生成的内容会自动保存在这里。 | 口语「做出来的东西」 |
| `ip/assets-hub.tsx:278` | 去做一张图 | 生成图片 | 按钮用「生成图片」 |
| `ip/assets-hub.tsx:279` | 没有找到 | 没有找到匹配的素材 | 标题说清对象 |
| `ip/assets-hub.tsx:279` | 换个名称或来源试试。 | 请尝试其他名称或来源。 | 去「试试」口语 |
| `ip/assets-hub.tsx:300` | 生成时的描述 | 提示词 | 同页搜索框写「搜索名称或提示词」，同一个东西一个叫法（见「叫法变动」） |
| `ip/assets-hub.tsx:311` | 暂时读不到 | 无法加载 | 去「读不到」 |
| `ip/asset-thumb.tsx:31` | 视频暂时读不到 / 图片暂时读不到（aria-label） | 视频无法加载 / 图片无法加载 | 同上 |
| `ip/assets-people.tsx:102` | 这里只放做出来的图片、视频和音频。人物在「全部」里。 | 此处仅保存 AI 生成的图片、视频和音频，人物请在「全部」中查看。 | 口语「做出来的」 |
| `ip/assets-people.tsx:113` | 正在读取… | 正在加载… | 统一加载中写法 |
| `ip/assets-people.tsx:115` | 重新读取 | 重试 | 同上 |
| `ip/assets-people.tsx:119` | 用照片建 | 使用照片创建 | 动词 + 对象，不省字成口语 |
| `ip/assets-people.tsx:120` | 录一段视频建 | 录制视频创建 | 同上 |
| `ip/assets-people.tsx:126` | 没有找到 | 没有找到匹配的人物 | 标题说清对象 |
| `ip/assets-people.tsx:126` | 换个名字或筛选试试。 | 请尝试其他名字或筛选条件。 | 去「试试」 |
| `ip/assets-people.tsx:129` | 已建好「${o.name}」 | 已创建「{name}」 | 去口语 |
| `ip/assets-people.tsx:138` | 还没写设定 | 暂无设定 | 状态文字书面化 |
| `ip/assets-people.tsx:186` | 先写个名字 / 还差一张正脸 / 勾选下面的确认 | 请填写名字 / 请添加正脸照片 / 请勾选下方的确认 | 禁用原因写在按钮旁，去「先」「个」口语 |
| `ip/assets-people.tsx:194` | 换一张${s.label}（aria-label） | 更换{label} | 标准叫法 |
| `ip/assets-people.tsx:195` | 换一张 | 更换 | 同上 |
| `ip/assets-people.tsx:198` | 可选 | 选填 | 规则：选填项标「选填」 |
| `ip/assets-people.tsx:206` | 选${…label} | 选择{label} | 弹窗标题写全动词 |

## 资产页 · 旧版「我的 IP」（ip-management）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/ip-management.tsx:49` | IP 列表没有读取成功 | IP 列表加载失败 | 统一加载失败写法 |
| `ip/ip-management.tsx:50` | 人物素材没有读取成功 | 人物素材加载失败 | 同上 |
| `ip/ip-management.tsx:51` | 人物声音没有读取成功 | 人物声音加载失败 | 同上 |
| `ip/ip-management.tsx:136` | 正在打开我的 IP… | 正在加载我的 IP… | 统一加载中写法 |
| `ip/ip-management.tsx:143` | 正在读取 IP… / 暂时无法读取 IP | 正在加载 IP… / IP 加载失败 | 同上 |
| `ip/ip-management.tsx:144` | 正在读取你的 IP… | 正在加载 IP… | 同上 |
| `ip/ip-management.tsx:147` | 为你的第一个角色留一个位置 | 还没有 IP | 空态标题 AI 味，直接说缺什么 |
| `ip/ip-management.tsx:147` | 换个关键词，或清除当前筛选。 | 请更换关键词或清除筛选。 | 去口语 |
| `ip/ip-management.tsx:147` | 在画布里创作并归档形象，就能在这里管理角色、视角与设定。 | 在画布中生成并归档形象后，可在此管理角色、视角和设定。 | 去「就能」 |
| `ip/ip-management.tsx:148`、`:161` | 重新读取 | 重试 | 按钮统一 |
| `ip/ip-management.tsx:153` | 记录角色的第一句介绍 | 暂无简介 | 这是没有简介时显示在简介位置的兜底文字，不是输入框占位，读起来像指令 |
| `ip/ip-management.tsx:166` | 打开已创建的画布继续 | 打开已创建的画布 | 去「继续」 |
| `ip/ip-management.tsx:170` | 正在保存 | 保存中 | 统一状态 |

## 资产页 · 旧版「创作素材 / 生成与上传」（personal-asset-library）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/personal-asset-library.tsx:106` | 文件夹名称暂不可用 | 未知文件夹 | 兜底名称，不写成状态句（测试受影响，见下） |
| `ip/personal-asset-library.tsx:125` | 按作品或主题整理，下一次创作更好找。 | 按作品或主题整理，方便下次创作时查找。 | 口语「更好找」 |
| `ip/personal-asset-library.tsx:128` | 文件夹读取失败： | 文件夹加载失败： | 统一加载失败写法 |
| `ip/personal-asset-library.tsx:128` | 重新读取文件夹 | 重试 | 按钮统一 |
| `ip/personal-asset-library.tsx:138` | 正在读取资产… / 暂时无法读取资产 | 正在加载资产… / 资产加载失败 | 统一 |
| `ip/personal-asset-library.tsx:140` | 资产读取失败 / 重新读取资产 | 资产加载失败 / 重试 | 统一 |
| `ip/personal-asset-library.tsx:140` | 从第一份素材开始 | 还没有资产 | 空态标题说清缺什么 |
| `ip/personal-asset-library.tsx:140` | 试试其他名称或筛选条件。 | 请尝试其他名称或筛选条件。 | 去「试试」 |
| `ip/personal-asset-library.tsx:154` | 素材暂不可读取 | 素材无法加载 | 去「读取」 |
| `ip/personal-asset-library.tsx:171` | 生成指令 | 提示词 | 同上「生成时的描述」，全站一个叫法 |
| `ip/personal-asset-library.tsx:174` | 新建可复用资产 | 新建资产 | 触发它的按钮就叫「新建资产」，标题一致 |

## 资产页 · 旧版「人物形象 / 专属声音」（supplementary-asset-library）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/supplementary-asset-library.tsx:76` | 正在读取${title}… | 正在加载{title}… | 统一 |
| `ip/supplementary-asset-library.tsx:76` | 已读取 ${n} 项，部分内容暂不可用 | 已加载 {n} 项，部分内容加载失败 | 统一 |
| `ip/supplementary-asset-library.tsx:77` | 重新读取 | 重试 | 按钮统一 |
| `ip/supplementary-asset-library.tsx:79` | ${title}暂不可读取 | {title}加载失败 | 统一 |
| `ip/supplementary-asset-library.tsx:79` | 读取恢复后，这里的资产会重新显示。 | 请稍后刷新重试。 | 统一加载失败下一步 |
| `ip/supplementary-asset-library.tsx:79` | 试试其他名称或筛选条件。 | 请尝试其他名称或筛选条件。 | 去「试试」 |
| `ip/supplementary-asset-library.tsx:79` | 重新读取资产 | 重试 | 按钮统一 |
| `ip/supplementary-asset-library.tsx:101` | 授权信息读取中 / 授权信息暂不可用 | 正在加载授权信息 / 授权信息加载失败 | 统一 |
| `ip/supplementary-asset-library.tsx:109` | 自建形象读取失败：${…} / 明星授权读取失败：${…} | 自建形象加载失败：{…} / 明星授权加载失败：{…} | 统一（测试受影响） |
| `ip/supplementary-asset-library.tsx:121` | 声音读取失败：${…}（三处） | 声音加载失败：{…} | 统一 |

## IP 人物库（画布内弹窗，studio-ip-library）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-ip-library.tsx:34` | ${title}素材将在归档后显示 | 暂无{title} | 空态简洁；「归档」对用户不直观 |
| `ip/studio-ip-library.tsx:39` | 正在读取人物档案… | 正在加载人物… | 统一 |
| `ip/studio-ip-library.tsx:48` | 正在读取声音… | 正在加载声音… | 统一 |
| `ip/studio-ip-library.tsx:48` | 重读声音 | 重试 | 按钮统一 |
| `ip/studio-ip-library.tsx:49` | 仅整理此素材的类别，保存免费。 | 仅修改素材类别，不消耗积分。 | 说清积分；「保存免费」口语 |
| `ip/studio-ip-library.tsx:51` | 将“${selected.name}”添加为人物参考，保留所选形象版本。 | 将「{name}」添加为人物参考，保留所选形象版本。 | 全站用「」，不用弯引号 |
| `ip/studio-ip-library.tsx:52` | 点开查看设定和素材 | 点击查看设定和素材 | 统一「点击」 |
| `ip/studio-ip-library.tsx:52` | 换个名称或素材类别试试。 | 请尝试其他名称或素材类别。 | 去「试试」 |
| `ip/studio-ip-library.tsx:52` | 在画布生成并采用主形象后，就能在这里管理和引用。 | 在画布中生成并采用主形象后，可在此管理和引用。 | 去「就能」 |

## 资产库选择框 / 引用框（library-media-picker / library-reference-picker）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/library-media-picker.tsx:31` | 从资产库选 | 从资产库选择 | 弹窗标题写全 |
| `ip/library-media-picker.tsx:145` | 上传到这个库 | 上传到此资产库 | 口语「这个库」（见「叫法变动」） |
| `ip/library-media-picker.tsx:151` | 这里还没有带图的人物。 | 暂无带图的人物。 | 空态统一 |
| `ip/library-media-picker.tsx:151` | 还没有 AI 做的${NOUN}。 | 还没有 AI 生成的{noun}。 | 口语「做的」 |
| `ip/library-media-picker.tsx:151` | 没有找到，换个名称试试。 | 没有找到匹配的素材，请尝试其他名称。 | 去「试试」 |
| `ip/library-media-picker.tsx:151` | 这里还没有${NOUN}，可以上传一个。 | 暂无{noun}，可点击「上传」添加。 | 空态 + 点击写法 |
| `ip/library-media-picker.tsx:151` | 这里还没有${NOUN}。 | 暂无{noun}。 | 空态统一 |
| `ip/library-media-picker.tsx:156` | 选 ${a.title}（aria-label） | 选择 {title} | 写全动词（测试受影响） |
| `ip/library-reference-picker.tsx:45` | 没有匹配的资产，可以切换到全部个人资产或换个名称。 | 没有匹配的资产，请切换到「全部个人资产」或更换名称。 | 去口语，选项名加「」 |

## 资产编辑 / 剧本提取（library-asset-editor / library-extraction-panel）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/library-asset-editor.tsx:36` | 一键生成缺图 | 生成缺失主图 | 去「一键」，说清对象 |
| `ip/library-asset-editor.tsx:49` | 生成缺图资产（弹窗标题） | 生成缺失主图 | 与按钮一致 |
| `ip/library-asset-editor.tsx:50` | 缺提示词 | 缺少提示词 | 书面 |
| `ip/library-asset-editor.tsx:50` | 已有主图和正在生成的资产会跳过。提示词缺失的项目需先补充。 | 已有主图或生成中的资产将跳过，缺少提示词的资产需先补充。 | 用标准状态「生成中」 |
| `ip/library-asset-editor.tsx:41` | 长期描述 | 描述 | 「长期」是内部区分说法，用户看不懂 |
| `ip/library-asset-editor.tsx:41` | 本次生成提示词 | 生成提示词 | 该字段随「保存」一起存进资产（`editLibraryObject` 带 `prompt`），并非只用于本次，「本次」不准确 |
| `ip/library-asset-editor.tsx:42` | 移除参考 | 移除参考图 | 与相邻「上传参考图 / 替换参考图」一致 |
| `ip/library-asset-editor.tsx:42` | 保存信息 | 保存 | 标准叫法 |
| `ip/library-asset-editor.tsx:46` | 新版本不会替换已有画布的引用。生成任务关闭后仍继续，所有候选自动入库。 | 新版本不会替换画布中已有的引用。关闭此窗口后生成仍会继续，结果自动存入资产库。 | 「生成任务关闭后仍继续」有歧义（像是任务被关闭）；「候选」「入库」内部说法 |
| `ip/library-extraction-panel.tsx:77` | 剧本解析未完成，原文保留 | 剧本解析失败，原文未改动。 | 失败用「失败」 |
| `ip/library-extraction-panel.tsx:100` | 文件夹名称暂时无法读取，已保存资产仍可查看。 | 文件夹加载失败，已保存的资产仍可查看。 | 统一（测试受影响） |
| `ip/library-extraction-panel.tsx:103` | 默认文件夹未能读取，保存位置暂设为未分类，请核对后保存。 | 默认文件夹加载失败，保存位置已设为「未分类」，请确认后保存。 | 统一 |
| `ip/library-extraction-panel.tsx:167` | 素材暂时无法读取 | 素材加载失败 | 统一 |
| `ip/library-extraction-panel.tsx:167` | 请重新读取，已保存的资产仍会保留。 | 请重试。已保存的资产不受影响。 | 统一下一步 |
| `ip/library-extraction-panel.tsx:168` | 正文分析中，可关闭后继续查看。 | 正在分析正文，可关闭此窗口，稍后查看结果。 | 说清关闭的是什么 |
| `ip/library-extraction-panel.tsx:168` | 核对下方结果，保存后即可在“已保存资产”中查看。提取不生成图片。 | 请核对下方结果，保存后可在「已保存资产」中查看。提取不会生成图片。 | 去「即可」，用「」 |
| `ip/library-extraction-panel.tsx:172` | 从正文分析提取 | 提取资产 · 按实际用量结算 | 会扣积分（`maxCost` 按 Token 冻结），按钮要写清怎么收费，不显示冻结上限（测试受影响） |
| `ip/library-extraction-panel.tsx:195` | 读取失败（Tab 计数位） | 加载失败 | 统一 |
| `ip/library-extraction-panel.tsx:200` | 重新读取 | 重试 | 按钮统一（测试受影响） |

## 资产详情 `/assets/[id]`

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `app/assets/[id]/page.tsx:178`、`:186` | 资产名片（NavBar 标题） | 资产详情 | 和「数字名片」功能撞名，同页又有「数字名片」一节，用户分不清 |
| `app/assets/[id]/page.tsx:68` | 补齐标准图：还差 ${n} 张，补完正面 / 侧面 / 全身出图会是同一张脸 | 补齐标准图：还差 {n} 张，补齐后正面、侧面、全身图保持同一张脸 | 去「出图」口语 |
| `app/assets/[id]/page.tsx:73` | 补多角度图集：转到侧面还是同一张脸 | 补充多角度图集：侧面角度也保持同一张脸 | 口语 |
| `app/assets/[id]/page.tsx:74` | 补一组表情：出片时不会从头到尾一个表情 | 补充表情图：生成视频时表情更丰富 | 去「出片」口语 |
| `app/assets/[id]/page.tsx:75` | 补几张场景图：换背景不用每次重新生成 | 补充场景图：更换背景时无需重新生成 | 口语 |
| `app/assets/[id]/page.tsx:76` | 补一套换装：换场景时衣服不会变来变去 | 补充换装：切换场景时服装保持一致 | 口语 |
| `app/assets/[id]/page.tsx:77` | 补 3D 模型：可以换任意角度重新出图 | 补充 3D 模型：可从任意角度生成图片 | 去「出图」 |
| `app/assets/[id]/page.tsx:78` | 补一段运镜视频：名片首图就能动起来 | 补充运镜视频：名片首图可动态展示 | 去「就」 |
| `app/assets/[id]/page.tsx:88` | 绑一个声音：视频里就用这个声线说话 | 绑定声音：视频将使用此声音配音 | 口语 |
| `app/assets/[id]/page.tsx:90` | 写两句人设：AI 写台词时知道这个角色该怎么说话 | 填写人设：AI 写台词时会参照角色的说话方式 | 口语 |
| `app/assets/[id]/page.tsx:188` | 回资产货架 | 返回资产 | 统一「返回 X」；「货架」不是导航叫法（`market/[id]`、`stars/[id]` 同句，属其他批次，建议一起改） |
| `app/assets/[id]/page.tsx:199` | 合成出片 | 合成视频 | 去「出片」 |
| `app/assets/[id]/page.tsx:277` | 素材加载中（LoadingBlock label） | 正在加载素材… | 统一 |
| `app/assets/[id]/page.tsx:280` | 素材加载失败：${derivs.error} | 素材加载失败，请稍后刷新重试。 | 统一，不直接拼原始错误 |
| `app/assets/[id]/page.tsx:284` | 还没有可切换的素材。生成表情、换装或运镜视频后，这里就能换着看 | 还没有可切换的素材。生成表情、换装或运镜视频后，可在此切换查看。 | 去口语，补句号 |
| `app/assets/[id]/page.tsx:284` | 去生成 | 生成素材 | 动词 + 对象 |
| `app/assets/[id]/page.tsx:289` | 换一个样子看看 | 切换形象 | 去「看看」 |
| `app/assets/[id]/page.tsx:290` | 点一下切换 | 点击切换 | 统一「点击」 |
| `app/assets/[id]/page.tsx:294` | 其余素材加载失败：${derivs.error} | 部分素材加载失败，请稍后刷新重试。 | 统一 |
| `app/assets/[id]/page.tsx:352` | 换一个 › | 更换 › | 标准叫法 |
| `app/assets/[id]/page.tsx:384` | 授权状态加载中… | 正在加载授权状态… | 统一 |
| `app/assets/[id]/page.tsx:386` | 授权状态加载失败：${licenses.error} | 授权状态加载失败，请稍后刷新重试。 | 统一 |
| `app/assets/[id]/page.tsx:404` | 确认平台协议 + 本人刷脸后才能出片 | 确认平台协议并完成本人刷脸后，可生成视频 | 去「出片」和「+」 |
| `app/assets/[id]/page.tsx:451` | 使用记录加载中 / 使用记录加载失败：${…} | 正在加载使用记录… / 使用记录加载失败，请稍后刷新重试。 | 统一 |
| `app/assets/[id]/page.tsx:454` | 还没有被使用的记录，出一条片就有了 | 暂无使用记录。 | 口语「出一条片」 |
| `app/assets/[id]/page.tsx:497` | 建卡没成功，稍后再试 | 名片创建失败，请重试。 | 统一报错下一步 |
| `app/assets/[id]/page.tsx:509` | 这个形象已经有名片了。访客打开就能点着切换装扮和表情。 | 此形象已有名片，访客打开后可切换查看装扮和表情。 | 口语「点着」「就能」 |
| `app/assets/[id]/page.tsx:510` | 把这个形象做成一张名片：名字和它的整柜造型自动带过去，访客能点着换装看，你只要再填联系方式。 | 将此形象做成名片：名字和全部造型自动带入，访客可切换查看造型，你只需填写联系方式。 | 口语「整柜」「点着」「再」 |
| `app/assets/[id]/page.tsx:521` | 去编辑名片 | 编辑名片 | 动词 + 对象 |
| `app/assets/[id]/page.tsx:535` | 建卡中 / 做成数字名片 | 创建中 / 创建数字名片 | 标准叫法（见「叫法变动」） |

## 我的名片 `/cards`、名片编辑、公开名片

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `app/cards/page.tsx:77` | 名片列表没加载出来，刷新页面再试 | 名片列表加载失败，请稍后刷新重试。 | 统一 |
| `app/cards/page.tsx:89` | 演示模式下不改状态 | 演示模式下无法修改发布状态 | 书面 |
| `app/cards/page.tsx:94` | 已取消发布，链接立刻打不开了 | 已取消发布，链接已失效 | 口语 |
| `app/cards/page.tsx:97`、`app/cards/[id]/edit/page.tsx:113` | 已发布，链接可以递出去了 | 已发布，可分享链接 | 口语「递出去」 |
| `app/cards/page.tsx:101` | 操作没成功 | 操作失败，请重试。 | 统一（另见「需要核实」：应走统一错误出口） |
| `app/cards/page.tsx:113` | 复制没成功，长按地址栏手动复制 | 复制失败，请手动复制卡片上的链接。 | PC 上没有「长按」；而且地址栏是 /cards，不是名片链接，原文指错了地方 |
| `app/cards/page.tsx:127-128` | 名片是数字资产的<b>对外发布面</b> —— 形象直接引用你的数字人，换了形象名片自动跟着变。发布后拿到一条链接，见客户扫码就能打开，对方不用注册。 | 名片用于对外展示你的数字人，更换形象后名片同步更新。发布后会生成一条链接，对方打开链接直接查看，无需注册。 | 去「——」和内部词「发布面」；「扫码」与实际不符，见「需要核实」第 3 条 |
| `app/cards/page.tsx:147` | 还没有名片。打开一个数字人形象，在「数字名片」那一节点「做成数字名片」，名字和整柜造型会自动带过来，你只要再填联系方式。 | 还没有名片。打开一个数字人形象，在「数字名片」中点击「创建数字名片」，名字和造型会自动带入，你只需填写联系方式。 | 口语，统一按钮名 |
| `app/cards/page.tsx:149` | 去打开一个形象 | 前往资产 | 链接去的是 `/assets`，按钮写去向 |
| `app/cards/page.tsx:282` | 演示模式：这里只展示一张内置样例名片，改动不会保存。 | 演示模式：仅展示一张示例名片，修改不会保存。 | 简洁 |
| `app/cards/page.tsx:283` | 取消发布后链接立刻打不开；形象被删或授权撤销时，名片会回落到已缓存的图并通知你。 | 取消发布后链接立即失效。 | 后半句与代码不符，见「需要核实」，先删 |
| `app/cards/[id]/edit/page.tsx:78` | 名片读不出来 | 名片加载失败，请稍后刷新重试。 | 统一 |
| `app/cards/[id]/edit/page.tsx:103` | 先填个名字 | 请填写名字 | 去「先」 |
| `app/cards/[id]/edit/page.tsx:119` | 保存没成功 | 保存失败，请重试。 | 统一 |
| `app/cards/[id]/edit/page.tsx:159-160` | 形象和造型已经从数字资产带过来了，访客能在名片上点着换装看。下面这些是机器猜不出来的。 | 形象和造型已从数字资产带入，访客可在名片上切换查看。请补充以下信息。 | 口语「点着」「机器猜不出来」 |
| `app/cards/[id]/edit/page.tsx:175` | 名片打开时第一眼看到的东西。选图片时访客可以点着换装扮和表情；选视频会自动播一遍，播完可以重播。 | 访客打开名片时首先看到的内容。选择图片时，访客可切换装扮和表情；选择视频时自动播放一次，可重播。 | 口语 |
| `app/cards/[id]/edit/page.tsx:242` | 名片顶部那排大写拉丁字母。留空就不显示。 | 名片顶部的大写拉丁字母，留空则不显示。 | 口语 |
| `app/cards/[id]/edit/page.tsx:246` | 见客户时你最想让对方记住的一句。可以换行分两行。 | 最希望对方记住的一句话，可换行分两行。 | 简洁 |
| `app/cards/[id]/edit/page.tsx:318` | 加一个作品 | 添加作品 | 标准叫法 |
| `app/cards/[id]/edit/page.tsx:341` | 行业 · 规模 · 成立年份这类。 | 例如行业、规模、成立年份。 | 说明给例子 |
| `app/cards/[id]/edit/page.tsx:349` | 名片上并排显示的那几个数（客户数、门店数、服务年限…）。 | 名片上并排显示的数字，例如客户数、门店数、服务年限。 | 口语 |
| `app/cards/[id]/edit/page.tsx:354` | 加一个数字 | 添加数字 | 标准叫法 |
| `app/cards/[id]/edit/page.tsx:367` | 按时间排。名片上是一条竖线串起来的。 | 按时间排列，名片上以时间轴展示。 | 口语 |
| `app/cards/[id]/edit/page.tsx:372`、`:395` | 加一条 | 添加 | 标准叫法 |
| `app/cards/[id]/edit/page.tsx:434` | 加一段经历 | 添加经历 | 标准叫法 |
| `app/cards/[id]/edit/page.tsx:441` | 2019 — 至今（placeholder） | 例如：2019 年至今 | 占位给例子，不用破折号 |
| `app/cards/[id]/edit/page.tsx:451` | 有改动还没保存 —— 包括人设那块「采用」进来的内容。 | 有未保存的修改，包括人设中已采用的内容。 | 去「——」和口语 |
| `app/cards/[id]/edit/page.tsx:468` | 还差：${missing.join(" · ")}（按钮 title） | 请填写：{…} | 禁用原因 |
| `app/cards/[id]/edit/page.tsx:485` | 发布后这张名片就能被任何拿到链接的人打开，不需要注册。随时可以取消发布。 | 发布后，任何人可通过链接打开此名片，无需注册。可随时取消发布。 | 书面 |
| `app/cards/[id]/edit/page.tsx:486` | 还差 ${missing.join(" 和 ")} 才能发布，草稿可以先存着。 | 填写{…}后可发布，草稿可先保存。 | 去「先存着」（规则原例）；`join(" 和 ")` 会出「名字 和 职位」多余空格，建议改 `join("和")` |
| `app/card/p/[slug]/page.tsx:35` | 名片打不开了 | 名片加载失败 | 统一 |
| `app/card/p/[slug]/page.tsx:50` | 链接可能已经失效，或者名片主人取消了发布。找他要一张新的吧。 | 链接可能已失效，或名片已取消发布。请联系名片主人获取新链接。 | 去「吧」 |
| `app/card/p/[slug]/page.tsx:51` | ${load.message}。稍后再试，或者直接联系名片主人。 | {message}。请稍后重试，或联系名片主人。 | 统一 |
| `app/card/p/[slug]/page.tsx:69` | 正在打开名片 | 正在加载名片… | 统一 |
| `components/card/card-view.tsx:221` | 已生成联系人文件，按提示存入通讯录 | 联系人文件已下载，请按提示存入通讯录。 | 书面 |
| `components/card/card-view.tsx:230` | 复制没成功，长按选中试试 | 复制失败，请手动选中复制。 | 去「试试」，PC 无长按 |
| `components/card/card-view.tsx:567`、`:867` | 存到通讯录 | 保存到通讯录 | 标准叫法 |
| `components/card/card-view.tsx:917` | 存下 {card.name} | 保存 {name} 的联系方式 | 口语 |
| `components/card/card-view.tsx:919` | 微信里存不进系统通讯录。逐条复制，或右上角用浏览器打开再存。 | 微信内无法保存到通讯录。请逐条复制，或点击右上角在浏览器中打开后保存。 | 口语「再存」 |

## 名片人设顾问（persona-studio）

开场三句（`OPENERS`，第 30-32 行）点了会作为用户消息发给顾问，是用户口吻，不改。`例：赋能、闭环、生态位`（186 行）是给用户看的反例，不改。

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `components/card/persona-studio.tsx:87` | 聊不通，稍后再试 | 人设对话失败，请重试。 | 统一报错 |
| `components/card/persona-studio.tsx:114` | 已经填进上面的表单了（记得点页面底部的保存）。要不要按这个人设，把「一句话 / 能提供 / 在找」也顺一遍？ | 已填入上方表单，请点击页面底部的「保存草稿」保存。如需按此人设改写「一句话 / 能提供 / 在找」，可点击「按人设改写名片文案」。 | 这是代码写死的固定文字（不是模型回复），提了问题却没有对应的答复按钮，改成说明操作入口 |
| `components/card/persona-studio.tsx:128` | 改写没成功，稍后再试 | 改写失败，请重试。 | 统一 |
| `components/card/persona-studio.tsx:158` | 这个人骨子里是谁（placeholder） | 例如：做事较真、说到做到的实干派 | 占位给例子，原文口语 |
| `components/card/persona-studio.tsx:163` | 一行一条。这些是访客在名片上看得到的。 | 每行一条，访客可在名片上看到。 | 简洁 |
| `components/card/persona-studio.tsx:173` | 加一个特征（placeholder） | 添加特征 | 标准叫法 |
| `components/card/persona-studio.tsx:176` | 「按人设改写文案」按这一条来写；将来数字人开口也按它。 | 「按人设改写名片文案」时参照此项。 | 按钮实名是「按人设改写名片文案」（196 行），引用要一致；「将来数字人开口也按它」承诺未上线功能 |
| `components/card/persona-studio.tsx:179` | 例：句子短，先给结论，不铺垫 | 例如：句子简短，先说结论 | 占位统一「例如：」 |
| `components/card/persona-studio.tsx:193` | 接着聊，改改人设 | 继续对话 | 去「接着」 |
| `components/card/persona-studio.tsx:211-212` | 名片上现在写的是你**做过什么**。但见了面真正被记住的，是你在意什么、说话什么调子。跟顾问聊几句 —— 它问的都是具体的小事，你照实说就行，价值观和性格由它替你提炼。 | 名片目前展示的是你做过什么。与顾问对话几轮，它会从你的回答中提炼价值观、性格和说话风格。 | `**` 在 JSX 里会原样显示成星号；去「——」「照实说就行」口语 |
| `components/card/persona-studio.tsx:239` | 随便从哪句开始都行。顾问会一次问一个具体的问题。 | 可从任意话题开始，顾问每次会问一个具体问题。 | 口语 |
| `components/card/persona-studio.tsx:245` | 想一下… | 正在思考… | 状态书面 |
| `components/card/persona-studio.tsx:256` | 照实说就行（placeholder） | 输入你的回答 | 口语 |
| `components/card/persona-studio.tsx:279` | 换一版 | 重新改写 | 标准叫法 |
| `components/card/persona-studio.tsx:369` | 聊出来的人设 | 人设草稿 | 口语 |
| `components/card/persona-studio.tsx:376` | 就它了 | 采用 | 与改写结果的「采用」一致 |
| `components/card/persona-studio.tsx:377` | 再聊聊 | 继续对话 | 去「再」 |

## 授权中心 `/licenses`

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `app/licenses/page.tsx:61` | 待补确认 | 待补充确认 | 去缩写 |
| `app/licenses/page.tsx:85` | 去补确认 › | 补充确认 › | 动词 + 对象 |
| `app/licenses/page.tsx:76` | 平台协议确认 + 本人刷脸核验 | 平台协议确认、本人刷脸核验 | 界面不用「+」连接 |
| `app/licenses/page.tsx:151` | 还没有授权给你的明星形象。到 AI 明星带货里挑选明星并发起授权申请，通过后会出现在这里 | 还没有明星形象授权。在 AI 明星带货中选择明星并申请授权，审批通过后将显示在这里。 | 书面，补句号 |
| `app/licenses/page.tsx:158` | 明星授权的申请与审批在带货线和「明星工作台」完成，这里只看结果和授权内容。 | 明星授权在 AI 明星带货和「明星工作台」中申请和审批，此处仅展示授权结果。 | 「带货线」是内部叫法 |
| `app/licenses/page.tsx:173` | 还没有授权记录。真人数字人完成协议确认与刷脸核验后，证书会出现在这里 | 还没有授权记录。真人数字人完成协议确认和刷脸核验后，证书将显示在这里。 | 补句号 |

## 发行（studio-distribution / studio-social-bind）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/studio-distribution.tsx:32` | 让每一份作品，抵达它的观众。 | 管理发布账号，查看发布记录。 | 旧版页头说明，营销腔、翻译腔 |
| `ip/studio-distribution.tsx:32` | 绑定账号，把做好的作品发出去 | 管理发布账号，查看发布记录。 | 新版说明；口语，且从画布发布尚未开通（同页标【待建设】），不能承诺「发出去」 |
| `ip/studio-distribution.tsx:36` | 把作品，带到更多人面前。 | 发布账号与记录 | 标题营销腔，逗号断句是 AI 味 |
| `ip/studio-distribution.tsx:37` | 保存未完成的发布准备，随时回来继续。 | 保存未完成的发布内容，稍后继续编辑。 | 口语「回来」 |
| `ip/studio-distribution.tsx:38` | 先把作品打磨好 | 继续完善作品 | 去「先」 |
| `ip/studio-distribution.tsx:38` | 画布里的下载与成片制作可以继续使用。新的发行入口接通后，再从这里发布。 | 画布中的下载和成片合成可正常使用。发布功能上线后，可在此发布作品。 | 「接通」开发词，去「再」 |
| `ip/studio-distribution.tsx:63` | 正在读取账号… / 账号读取未完成 | 正在加载账号… / 账号加载失败 | 统一 |
| `ip/studio-distribution.tsx:66` | 账号由本人统一管理，与已有带货应用共用。 | 账号与 AI 明星带货共用。 | 用产品名，不写「带货应用」 |
| `ip/studio-distribution.tsx:81` | 当前账号的全部发布批次，包含已有带货应用的记录。 | 当前账号的全部发布记录，包含 AI 明星带货中的发布。 | 同上；「批次」内部词 |
| `ip/studio-distribution.tsx:84` | 草稿保存尚未接通，不会混入平台任务。 | 发布草稿功能暂未开放。 | 开发词「接通」「混入平台任务」 |
| `ip/studio-distribution.tsx:92` | 暂时没有可读取的发布任务。 | 暂无发布任务。 | 空态统一 |
| `ip/studio-social-bind.tsx:71` | 继续查询本次绑定 | 重新查询绑定状态 | 标准叫法（测试受影响） |

---

## 叫法变动（全仓同步）

1. **「做成数字名片」→「创建数字名片」**（按钮；加载态「建卡中」→「创建中」）
   - `apps/web-aiavatar/src/app/assets/[id]/page.tsx:535`（按钮）、`:479`（注释）
   - `apps/web-aiavatar/src/app/cards/page.tsx:147`（空态引用按钮名）
   - `apps/web-aiavatar/src/ip/publish/publish-dialog.tsx:227`（发布弹窗里的同一按钮，属其他批次，需同步）
   - 服务端注释：`apps/server/src/main/java/com/aistareco/aep/ipstudio/service/IpPublishService.java:289`、`apps/server/src/main/java/db/migration/V30__card_payload_longtext.java:16`（只是注释，已执行迁移不改，可不动）
2. **「上传到这个库」→「上传到此资产库」**
   - `apps/web-aiavatar/src/ip/library-media-picker.tsx:145`（按钮）、`:5`（注释）
   - `apps/web-aiavatar/src/ip/assets-people.tsx:206`（intro 引用了这个按钮名，但这段 intro 实际不显示，见「需要核实」）
   - 测试 `apps/web-aiavatar/src/ip/library-media-picker.test.tsx:92`
3. **生成提示词的叫法统一为「提示词」**：`生成时的描述`（`ip/assets-hub.tsx:300`）、`生成指令`（`ip/personal-asset-library.tsx:171`）。同名的 `ip/project-history.tsx:88`「生成指令 / 完整生成提示词」属其他批次，建议一起看。服务端 `SubmitGenerationTool.java:32/52` 里的「生成指令」是给模型的工具说明，不改。
4. **「重新读取」→「重试」**（本批内）：`ip/assets-hub.tsx:123,275`、`ip/assets-people.tsx:115`、`ip/personal-asset-library.tsx:128（重新读取文件夹）,140（重新读取资产）`、`ip/supplementary-asset-library.tsx:77,79（重新读取资产）`、`ip/studio-ip-library.tsx:48（重读声音）`、`ip/ip-management.tsx:148,161`、`ip/library-extraction-panel.tsx:200`。本批外仍有 `ip/enterprise-invitation-landing`、`ip/invitation-registration`（「重新读取邀请」）等，归其他批次。
5. **「资产名片」→「资产详情」**：`app/assets/[id]/page.tsx:178,186`；注释 `app/assets/[id]/page.tsx:3`、`proto/card.ts:7`；文档 `apps/web-aiavatar/README.md:374`、`docs/VERSION_HISTORY.md:871`（历史记录，不改）、`docs/aiavatar-asset-hub-redesign.md:43`。
6. **「带货线 / 带货应用」→「AI 明星带货」**（仅界面）：`app/licenses/page.tsx:158`、`ip/studio-distribution.tsx:66,81`。服务端和 admin 里的「带货线」都是注释或后台内部说明，不改。
7. **「回资产货架」→「返回资产」**：`app/assets/[id]/page.tsx:188`；同句还在 `app/market/[id]/page.tsx:43`、`app/stars/[id]/page.tsx:48`（其他批次）。

## 测试会受影响的

| 测试 | 断言 | 建议 |
|---|---|---|
| `ip/assets-people.test.tsx:62` | `getByText('先写个名字')` | 改断言「创建人物」按钮 `disabled` 和 `.assets-person-missing` 非空，不断言文字 |
| `ip/assets-people.test.tsx:64` | `getByText('还差一张正脸')` | 同上 |
| `ip/assets-people.test.tsx:70` | `findByRole('button', { name: '换一张左侧脸' })` | 改成新 aria-label「更换左侧脸」，或断言该槽位按钮内有图片 |
| `ip/assets-people.test.tsx:66,68,87,89` | `从资产库选正脸` 等 | 不改（这句保留） |
| `ip/library-media-picker.test.tsx:51,79,80,96,105,106,108,109,123` | `name: '选 xxx'` | 跟着 aria-label 改成「选择 xxx」 |
| `ip/library-media-picker.test.tsx:92` | `name: /上传到这个库/` | 改成 `/上传到此资产库/`，或断言 `type=file` 输入存在 |
| `ip/library-extraction-panel.test.tsx:31,43,79,93` | `name: '从正文分析提取'` | 改成新按钮名，或用 `data-ai-action` 之类结构定位 |
| `ip/library-extraction-panel.test.tsx:142` | `name: '重新读取'` | 改成「重试」 |
| `ip/library-extraction-panel.test.tsx:143` | `queryByText('素材暂时无法读取')` 为空 | 改成新文案「素材加载失败」 |
| `ip/library-extraction-panel.test.tsx:144` | `getByText('文件夹名称暂不可用')` | 这条来自 `library-script-assets.tsx:47`，若该处同改需同步 |
| `ip/library-extraction-panel.test.tsx:152` | `split('文件夹名称暂时无法读取').length === 2` | 测的是「同一提示只出现一次」，改为按新文案分割 |
| `ip/personal-asset-library.test.tsx:46-48` | `toContain('暂不可用')`、`getByText('文件夹名称暂不可用')`、`name: '重新读取文件夹'` | 跟新文案改；按钮改为「重试」后可用 `within(.library-notice)` 定位 |
| `ip/supplementary-asset-library.test.tsx:42` | `getByText('授权信息暂不可用')` | 改成「授权信息加载失败」 |
| `ip/supplementary-asset-library.test.tsx:44` | `name: '重新读取'` | 改成「重试」 |
| `ip/supplementary-asset-library.test.tsx:47` | `toContain('明星授权读取失败')` | 改成「明星授权加载失败」 |
| `ip/supplementary-asset-library.test.tsx:75,77` | `专属声音暂不可读取`、`name: '重新读取资产'` | 改成「专属声音加载失败」「重试」 |
| `ip/studio-social-bind.test.tsx:26` | `name: '继续查询本次绑定'` | 改成新按钮名 |
| `ip/ip-management.test.tsx:69,79,81` | `name: '生成形象'` | 只在「需要核实」第 7 条决定改名时才动 |

## 需要核实或连带改行为

1. **公开名片把演示内容当真内容显示**（`components/card/card-view.tsx`）。每张公开名片都会显示：
   - `:618` 固定图片 `/card/demo-works.jpg`，alt 写「{name}的数字人形象 · 抱臂」，与用户自己的形象无关；
   - `:839` 写死的一段话「想聊门店线上化，想找区域代理，或者只是想问问这个数字人怎么做出来的 —— 直接联系我，我自己看。」，不是用户填的；
   - `:819-823` 「关于这张名片」三条：「内容出自 AI 军师的战略诊断 / 企业诊断的结论，直接用作名片内容」「形象是登记在册的数字人资产 / 真人复刻 · 本人授权」「开屏那段由 AI 生成 / 文案更新后自动重新生成」；
   - `:885`「形象为本人授权数字人 · 内容由本人确认」、`:804`「本人确认公开」。
   这些只在 `card.demo` 时才成立：AI 原创形象没有「真人复刻 · 本人授权」，名片内容也不是来自 AI 军师，代码里也没有「文案更新后自动重新生成」。建议这几块只在演示数据下显示，或按 `card` 的真实字段（形象来源 path、授权状态）生成，否则删掉。
2. **名片列表页脚承诺「通知你」**（`app/cards/page.tsx:283`）：「形象被删或授权撤销时，名片会回落到已缓存的图并通知你。」服务端 `apps/server/src/main/java/com/aistareco/aep/card/` 下没有任何通知或缓存兜底逻辑。主表先建议删掉后半句；如要保留需先实现。
3. **「扫码就能打开」**（`app/cards/page.tsx:128`）：名片页没有生成二维码，只给链接和「复制链接」。主表已改为「打开链接」；要保留「扫码」需加二维码。`app/me/page.tsx:66,197` 的「扫码即看」同样问题（其他批次）。
4. **「加微信」按钮其实是复制微信号**（`components/card/card-view.tsx:545`）：`onWechat` 调 `copy("微信号", …)`，提示「微信号已复制」。建议按钮改「复制微信号」。没有微信号时同一按钮显示「复制信息」，实际调用的是 `saveContact`（下载 vcf 或打开联系方式面板），不是复制，建议改「保存联系方式」或直接隐藏。
5. **「逗号或换行分隔」与输入方式不符**（`components/card/persona-studio.tsx:169`）：`ChipEditor` 是单行输入框，按回车（或失焦）添加一个特征，不按逗号拆分，单行框里也打不出换行。建议说明改为「输入后按回车添加。」
6. **名片页的失败提示没走统一错误出口**（`app/cards/page.tsx:101,113`、`app/cards/[id]/edit/page.tsx:103,119`）：用自写底部 toast（`say()`）显示 `e.message`，2.2 秒消失。按规则用户点击的操作（发布、取消发布、保存）失败应走 `reportStudioError` 弹窗。主表只改了文字。
7. **「生成形象」按钮不生成任何东西**（`ip/ip-management.tsx:166`）：点了只是免费新建一张画布、带上参考图跳过去，下方小字「免费进入画布。生成前在节点里确认模型、参考与积分。」。按钮带 Sparkles 图标、叫「生成」，容易让人以为会扣积分。建议改「在画布中创作」或「新建画布」。测试 `ip/ip-management.test.tsx:69,79,81` 断言这个名字。
8. **「从正文分析提取」不显示收费方式**（`ip/library-extraction-panel.tsx:172`）：按 Token 计费（`tokenPricing.maxCost`），按钮只有 `title="AI 处理，会消耗积分"`。主表改为「提取资产 · 按实际用量结算」；测试 `library-extraction-panel.test.tsx:34` 断言界面不出现冻结上限，与新文案不冲突。
9. **「创建形象」跳到画布页**（`ip/supplementary-asset-library.tsx:109`）：旧版「授权形象」分类页的「创建形象」按钮和空态链接 `actionHref="/create"`，`/create` 是「画布·自由创作」页，不是形象创建流程（真人复刻在 `studioHref('#/create/real')`）。文字和去向对不上，要么改链接（例如 `studioHref('#/create')`），要么把按钮改叫「开始创作」。
10. **新建人物里的选图提示不显示**（`ip/assets-people.tsx:206`）：传给 `LibraryReferencePicker` 的 `intro`「从资产库里选一张；新照片点「上传到这个库」。」在 `mediaType` 存在且非 embedded 时会转给 `LibraryMediaPicker`，而后者不接收 `intro`，这句永远不显示；而且按钮在「全部」库里叫「上传」，不叫「上传到这个库」。可以直接删掉这个 prop。
11. **「本次生成提示词」**（`ip/library-asset-editor.tsx:41`）：该字段会随「保存信息」一起持久化，不只用于本次。主表已改为「生成提示词」，确认产品是否就要它常驻。

## 仅手机端（不改，列出备查）

- `ip/personal-asset-library.tsx:127` `aria-label="资产范围"`、`ip/supplementary-asset-library.tsx:66` `${title}分类`：`library-mobile-folder` 窄屏下拉，桌面隐藏。文字无问题。
- `components/card/card-view.tsx:917-942` 联系方式面板（`ContactSheet`）只在微信内置浏览器里触发，主要见于手机微信；文字问题已列在主表（PC 微信内置浏览器也可能出现）。

## 存疑（拿不准的，写出两种写法让用户选）

1. **「去 X」类链接按钮**：`app/assets/[id]/page.tsx:409「去完成 ›」`、`:432「去补 ›」`、`:454「去创作」`、`app/licenses/page.tsx:175「去真人授权」`。正式 App 里「去完成」「去设置」很常见，规则也没禁「去」。A：保留；B：统一成动词 + 对象（「完成授权 ›」「补充 ›」「开始创作」「真人授权」）。
2. **`app/assets/[id]/page.tsx:470「去工作室创作」`**：链到旧版 `/studio#/avatar/{id}`，「工作室」不在导航叫法里。A：「开始创作」；B：「编辑形象」（实际进入的是形象详情编辑页）。
3. **公开名片的分段装饰字「Roll 01 · 纸白」「Roll 02 · 青雾」等**（`components/card/card-view.tsx:241-247,610`）：设计用的胶片卷标，`aria-hidden` 但视觉可见，对访客无意义。A：作为设计风格保留；B：删掉卷标文字只留渐变。
4. **形象状态筛选「调整中 · 迭代」「调整中 · 精修」**（`ip/supplementary-asset-library.tsx:109`）：两个状态都叫「调整中」，靠「迭代 / 精修」区分，后者是内部说法。A：合并为一个「调整中」选项；B：改成用户能懂的区分（如「调整中 · 换造型」「调整中 · 修细节」），需产品确认两者区别。
5. **「归档」**（`ip/ip-management.tsx:131「尚未归档」、:132「{title}会在画布生成并归档后显示在这里。」、:147`）：画布里确实有把结果存为人物素材的操作，但界面上那个按钮叫什么需要确认。A：保留「归档」；B：跟画布按钮同名（如「存为人物素材」）。
6. **发布记录里的「请在原发布入口完成平台验证」**（`ip/studio-distribution.tsx:96`）：「原发布入口」指 AI 明星带货的发布页。A：「请在 AI 明星带货中完成平台验证。」；B：保留但补一个跳转链接。

---

# 第七批：账号相关页（我的、企业、邀请、登录）+ 服务端报错文案

读过的文件：
- 第一部分（前端，相对 `apps/web-aiavatar/src/`）：`app/me/page.tsx`（65 条，桌面只走 `AccountOverview`，其余全是手机端）、`app/enterprise/page.tsx` + `app/enterprise/invite/page.tsx`（2）、`app/invitations/page.tsx`、`app/invite/[code]/page.tsx`（2）、`app/login/page.tsx`（2）、`app/auth/test-login/page.tsx`（5）、`app/layout.tsx`（2）、`ip/enterprise-workspace.tsx`（142，全读）、`ip/enterprise-management.tsx`（147，全读）、`ip/enterprise-reports.tsx`（70，全读）、`ip/enterprise-invitation-landing.tsx`（71，全读）、`ip/enterprise-invitation-link.ts`（1）、`constants/enterprise-ui.ts`（9）、`ip/invitation-registration.tsx`（70，全读）、`ip/invitation-workspace.tsx`（49，全读）、`shell/account-workspace.tsx`（25）、`shell/account-navigation.ts`（8）、`shell/account-avatar.tsx`（2）、`shell/test-account-banner.tsx`（1）、`components/hub/auth.tsx`（1）、`components/hub/ui.tsx`（22，手机底栏）。以及这些文件对应的 9 个测试。
- 第二部分（服务端）：用脚本抽出 `aep/{ipstudio,enterprise,dap,enrollment,security,identity,billing}` 下 `new BusinessException(...)` / `BusinessException.xxx(...)` 里带中文的 message 共 626 条（去掉 `ipstudio/skill`、`identity`、`billing` 这些后台专用的后 538 条），逐条看过；另补看了 `enterprise/service/*` 里经 `denied()/conflict()` 包装的 message、`config/PhoneVerificationGuard.java`、`enrollment/config/EnrollmentGuard.java`、`service/CreditService.java`、`service/AiModelGuardService.java`。

---

# 第一部分：账号相关页

## 账号总览（桌面 `/me` = `shell/account-workspace.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `shell/account-workspace.tsx:47` | 手机号与登录方式可在账号与安全中管理 | 手机号与登录方式可在「账号与安全」中管理 | 引用界面上的入口名加「」，和右侧链接对上 |
| `shell/account-workspace.tsx:54` | 管理企业余额、积分分配与充值记录 | 查看企业积分、分配与充值记录 | 普通成员只能看本人企业积分，不能「管理」，写「管理」不实（见 `enterprise-workspace.tsx:60-66` 的权限判断） |
| `shell/test-account-banner.tsx:8` | 测试账号 · 企业权限、开通和积分按正常规则检查 | 测试账号 · 企业权限、开通与积分规则与正式账号相同 | 「按正常规则检查」读不懂；要说的是除手机号外规则不变 |

## 企业管理页（`ip/enterprise-workspace.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/enterprise-workspace.tsx:157` | 数据刷新失败，当前显示上次读取的内容 | 企业数据刷新失败，当前显示的是上次加载的内容 | 统一「加载」，不用「读取」 |
| `ip/enterprise-workspace.tsx:159` | 暂时无法读取企业数据 | 企业数据加载失败 | 统一写法（正文是错误原因，按钮「重试」保留） |
| `ip/enterprise-workspace.tsx:161` | 创建企业后，主账号可将个人积分转入企业，也可申请企业充值，再分配给成员。每个人仍需按现有规则开通数字资产产品。 | 创建企业后，主账号可将个人积分转入企业或申请企业充值，并分配给成员。成员需各自开通 IP Studio。 | 「按现有规则」空泛；产品叫法见「叫法变动」 |
| `ip/enterprise-workspace.tsx:165` | 我的两份积分（aria-label） | 我的积分 | 「两份积分」不像界面用语 |
| `ip/enterprise-workspace.tsx:165` | 读取中 | 加载中… | 统一加载写法 |
| `ip/enterprise-workspace.tsx:165` | 个人充值与消费，企业无权回收 | 个人充值与消费，企业不可回收 | 「无权」生硬 |
| `ip/enterprise-workspace.tsx:165` | 暂未读取 | 加载中… | 同上；这里实际就是还没拿到 |
| `ip/enterprise-workspace.tsx:167` | 你仍可查看本人记录，并选择个人积分继续创作。企业在途任务按原账户结算。 | 你仍可查看本人记录，并使用个人积分继续创作。进行中的企业积分任务仍按企业积分结算。 | 「在途」是财务用语，见「叫法变动」 |
| `ip/enterprise-workspace.tsx:169`、`:171` | 在途任务占用，不可回收 | 进行中的任务占用，不可回收 | 同上（两处） |
| `ip/enterprise-workspace.tsx:174` | 企业积分与个人积分独立。回收仅处理可用余额，冻结积分保留原任务结算。 | 企业积分与个人积分分开计算。回收只针对可用余额，冻结积分仍用于原任务结算。 | 书面、读得顺 |
| `ip/enterprise-workspace.tsx:188` | 暂无充值申请，可先提交一笔充值申请 | 暂无充值申请。 | 空态 + 页面已有「申请充值」按钮，去掉「先」 |
| `ip/enterprise-workspace.tsx:206` | 提交前会核对每人余额与本次总额。整批成功或整批失败，不会扣用个人积分。 | 提交前将核对每人余额与本次总额，全部成功或全部不执行。不会动用你的个人积分。 | 「扣用」不是常用词；「整批失败」听着像会出错 |
| `ip/enterprise-workspace.tsx:219` | 申请提交至平台财务，核准后积分进入“企业待分配积分”。此操作不会直接增加积分。 | 申请将提交至平台财务，核准后积分进入「企业待分配积分」。提交申请不会直接增加积分。 | 全站引用界面名用「」，不用弯引号 |

## 企业管理 · 成员与邀请 / 生成设置 / 企业关系（`ip/enterprise-management.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/enterprise-management.tsx:161` | 重新读取 | 重试 | 统一按钮叫法 |
| `ip/enterprise-management.tsx:165` | 仅约束使用企业积分的 Studio 任务。个人积分仍按个人规则使用。 | 仅对使用企业积分的生成任务生效，不影响个人积分。 | 「信」：企业付款已覆盖数字资产与声音克隆（`EnterpriseBillingService.SCOPES` 含 `dap-job`、`dap-voice`），不止 Studio |
| `ip/enterprise-management.tsx:166` | 成员用企业积分时可以用哪些模型 | 成员使用企业积分时可用的模型 | 表单标签用名词短语 |
| `ip/enterprise-management.tsx:170` | 成员用企业积分时只能选这些模型，以后新上的模型要再加进来。已排队或已提交的任务按原来的模型和价格结算。 | 成员使用企业积分时只能选择以上模型，后续上线的模型需手动添加。已排队或已提交的任务按原模型和价格结算。 | 去口语 |
| `ip/enterprise-management.tsx:170` | 至少选一个模型才能保存。 | 请至少选择一个模型。 | 去口语 |
| `ip/enterprise-management.tsx:171` | Studio 里能用的模型都可以用企业积分付，包括以后新上的。 | 所有可用模型均可使用企业积分，包括后续上线的模型。 | 去口语；同上「信」，不止 Studio |
| `ip/enterprise-management.tsx:172` | 每位成员最多在途任务数 | 每位成员同时进行的任务上限 | 「在途」；测试受影响，见下 |
| `ip/enterprise-management.tsx:174` | 在途包括排队、运行，以及厂商已受理但结果待核对的任务。画布一次制作常会同时跑好几项，设得太小，后面的步骤会停下来等。 | 包括排队中、生成中，以及已提交、结果待确认的任务。画布一次制作常会同时运行多项任务，上限过低时后续步骤需要等待。 | 「在途」「厂商已受理」是内部说法；去口语 |
| `ip/enterprise-management.tsx:178` | 主账号须先将管理责任移交给另一位正常成员，才能退出。关闭企业前需要处理完在途任务、充值申请与剩余积分。 | 主账号需将主账号移交给一位状态正常的成员后才能退出。关闭企业前，需处理完进行中的任务、充值申请和剩余积分。 | 「正常成员」有歧义；「在途」 |
| `ip/enterprise-management.tsx:178` | 核对关闭企业条件 / 核对并退出企业 | 关闭企业 / 退出企业 | 按钮写动作；点开是确认弹窗，弹窗里会列出阻止项，不会直接执行。测试受影响 |
| `ip/enterprise-management.tsx:181` | 管理员只管理普通成员。积分授权不会开放成员的个人钱包、素材或画布。 | 管理员只能管理普通成员。积分相关授权不涉及成员的个人积分、素材和画布。 | 「个人钱包」统一为「个人积分」 |
| `ip/enterprise-management.tsx:181` | 创建分享链接 | 创建邀请链接 | 同一个东西本页叫「分享链接」「邀请链接」「企业邀请链接」三种，统一为「邀请链接」；测试受影响 |
| `ip/enterprise-management.tsx:181` | 分享链接已创建，有效期内可供多人加入。 | 邀请链接已创建，有效期内可供多人加入。 | 同上 |
| `ip/enterprise-management.tsx:181` | 邀请已创建；链接仅首次返回，如未保存可重新创建。 | 邀请已创建。链接只显示一次，如未保存，可重新创建。 | 「仅首次返回」是接口说法 |
| `ip/enterprise-management.tsx:183` | 。对方需已登录并开通数字资产平台；未注册的同事可通过分享链接加入。 | 。对方需已登录并开通 IP Studio；未注册的同事可通过邀请链接加入。 | 产品叫法、链接叫法统一 |
| `ip/enterprise-management.tsx:200` | 接受邀请后仍需按原有规则开通数字资产产品；加入企业不会自动开通。 | 加入企业不会自动开通 IP Studio，成员需自行开通。 | 产品叫法；「按原有规则」空泛 |
| `ip/enterprise-management.tsx:200` | 无需操作 | — | 操作列空值用占位符，不写一句话 |
| `ip/enterprise-management.tsx:202` | 将链接发给同事或企业群，大家验证手机号后可直接加入「 | 将链接发给同事或企业群，对方验证手机号后可加入「 | 「大家」口语 |
| `ip/enterprise-management.tsx:202` | 链接只在本次创建后显示，请复制保存。加入不会自动开通产品或发放积分。 | 链接仅显示这一次，请复制保存。加入企业不会自动开通产品，也不会发放积分。 | 读得顺 |
| `ip/enterprise-management.tsx:204` | 发起移交，等待对方接受（okText） | 发起移交 | 按钮只写动作，「等待对方接受」正文已说明 |
| `ip/enterprise-management.tsx:205` | 企业关系已更新，余额与任务仍按原账户结算。 | 操作已完成。进行中的任务仍按原账户结算。 | 「企业关系已更新」说不清做了什么 |
| `ip/enterprise-management.tsx:205` | 在途冻结积分 / 在途任务 | 冻结积分 / 进行中的任务 | 「在途」 |
| `ip/enterprise-management.tsx:205` | 尚未受理任务 / 未受理，提交后取消 | 尚未开始的任务 / 尚未开始，确认后取消 | 「受理」是内部说法；按钮是「确认…」不是「提交」 |
| `ip/enterprise-management.tsx:205` | 已受理，继续原任务结算 | 已开始，按原任务结算 | 同上 |
| `ip/enterprise-management.tsx:205` | 恢复后可接收分配并使用企业积分。此前退回并归集的积分不会自动重新分配。 | 恢复后可重新获得分配并使用企业积分。停用时回收的积分不会自动退回。 | 「归集」是财务说法 |
| `ip/enterprise-management.tsx:205` | 已受理任务继续结算，失败释放的积分归原企业；个人积分、画布与作品保留。 | 已开始的任务继续结算，失败退回的积分归原企业；个人积分、画布和作品不受影响。 | 「受理」「释放」 |

## 企业流水（`ip/enterprise-reports.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/enterprise-reports.tsx:11` | 生成或核对中 | 生成中 | 状态用标准叫法 |
| `ip/enterprise-reports.tsx:11` | 已结算，余款已退回 | 已结算，多余积分已退回 | 积分不是钱，「余款」不对；测试受影响 |
| `ip/enterprise-reports.tsx:11` | 等待核对 | 待确认 | 状态短词 |
| `ip/enterprise-reports.tsx:13` | 归集旧任务退款 | 回收旧任务退回的积分 | 「归集」 |
| `ip/enterprise-reports.tsx:35` | 展示本人使用企业积分的任务与实际消耗。个人付费账单可在我的账号查看。 | 展示本人使用企业积分的任务与实际消耗。个人积分的消费记录可在「我的账号」查看。 | 引用入口加「」；「付费账单」不是本站叫法 |
| `ip/enterprise-reports.tsx:36` | 已变更允许模型或在途任务上限 | 已变更可用模型或任务上限 | 「在途」 |

## 企业邀请落地页（`/enterprise/invite`，`ip/enterprise-invitation-landing.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/enterprise-invitation-landing.tsx:12` | 你已加入其他企业。请先前往企业管理退出原企业，再回来接受邀请。 | 你已加入其他企业。请在企业管理中退出原企业后，重新打开此邀请链接。 | 去「先…再…回来」 |
| `ip/enterprise-invitation-landing.tsx:80` | 暂时无法读取邀请或账号状态，请重试。 | 邀请加载失败，请稍后刷新重试。 | 统一写法 |
| `ip/enterprise-invitation-landing.tsx:145` | 了解 Studio | 了解 IP Studio | 产品名写全，和朋友邀请页（「认识 Studio」）统一为一个叫法 |
| `ip/enterprise-invitation-landing.tsx:149` | 接受企业邀请，用分配给你的积分，<br/>继续属于自己的创作。 | 接受企业邀请，<br/>使用企业分配的积分开始创作。 | 「继续属于自己的创作」翻译腔；和本页 metadata 描述一致 |
| `ip/enterprise-invitation-landing.tsx:156`、`:159` | 返回 Studio | 返回首页 | 链接去的是 `/` 公开首页 |
| `ip/enterprise-invitation-landing.tsx:157` | 正在读取企业邀请 / 稍等片刻，马上就好。 | 正在加载企业邀请… /（删除这行） | 统一写法；「马上就好」是聊天口吻 |
| `ip/enterprise-invitation-landing.tsx:158` | 暂时无法读取邀请 | 邀请加载失败 | 统一写法 |
| `ip/enterprise-invitation-landing.tsx:158` | 重新读取 | 重试 | 统一按钮叫法；测试受影响 |
| `ip/enterprise-invitation-landing.tsx:164` | 进入企业 | 进入企业管理 | 同一目标 `/enterprise` 本页有「进入企业」「进入企业管理」「前往企业管理」三种叫法；测试受影响 |
| `ip/enterprise-invitation-landing.tsx:167` | 前往企业管理 | 进入企业管理 | 同上 |
| `ip/enterprise-invitation-landing.tsx:167` | 。每个账号同时只能属于一家企业，退出后可回来重新接受邀请。 | 。一个账号同时只能属于一家企业，退出原企业后可重新打开此链接接受邀请。 | 去「回来」 |
| `ip/enterprise-invitation-landing.tsx:168` | 你已登录。开通数字资产产品后，将继续加入这家企业。 | 你已登录。开通 IP Studio 后，将自动加入该企业。 | 产品叫法见「叫法变动」 |
| `ip/enterprise-invitation-landing.tsx:175` | 请先登录，再继续接受企业邀请。 | 请登录后接受企业邀请。 | 去「先…再」 |
| `ip/enterprise-invitation-landing.tsx:177` | 个人钱包与作品仍由你管理。 | 个人积分与作品仍归你所有。 | 「个人钱包」统一为「个人积分」 |

## 朋友邀请注册页（`/invite/{code}`，`ip/invitation-registration.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/invitation-registration.tsx:16` | 这份邀请已失效，请重新读取后继续注册。 | 邀请已失效，你仍可继续注册。 | 「信」：邀请失效时页面照样能注册（`:103`），不需要「重新读取」 |
| `ip/invitation-registration.tsx:96` | 认识 Studio | 了解 IP Studio | 和企业邀请页统一 |
| `ip/invitation-registration.tsx:101` | 邀请你加入 Studio | 邀请你加入 IP Studio | 产品名写全 |
| `ip/invitation-registration.tsx:102` | 正在读取邀请… | 正在加载邀请… | 统一写法 |
| `ip/invitation-registration.tsx:103` | 这份邀请已失效，你仍可直接注册 Studio。 | 邀请已失效，你仍可直接注册 IP Studio。 | 产品名 |
| `ip/invitation-registration.tsx:104` | 暂时无法读取邀请，请检查网络后重试。 | 邀请加载失败，请检查网络后重试。 | 统一写法 |
| `ip/invitation-registration.tsx:104` | 重新读取邀请 | 重试 | 统一按钮叫法；测试受影响 |
| `ip/invitation-registration.tsx:111` | 正在进入 Studio… / 注册并进入 Studio | 正在进入 IP Studio… / 注册并进入 IP Studio | 产品名 |
| `ip/invitation-registration.tsx:112` | 未注册自动注册，已有账号直接登录。 | 未注册的手机号将自动注册，已有账号直接登录。 | 「未注册自动注册」重复、不通 |
| `ip/invitation-registration.tsx:121` | 验证手机号后直接进入 IP Studio。新账号会记录这次邀请；各项创作能力仍按账号开通情况和具体使用规则提供。 | 验证手机号后进入 IP Studio，新账号会记录本次邀请。邀请不附带积分或奖励，各项功能按账号开通情况提供。 | 「具体使用规则」空泛；邀请确实不产生奖励（AGENTS「账号注册邀请」） |
| `ip/invitation-registration.tsx:121` | 使用同一表单验证手机号即可登录，原有邀请关系保持不变。 | 可以。在上方验证手机号后登录，原有邀请关系不变。 | 去「即可」；先回答问题 |

## 邀请朋友（`/invitations`，`ip/invitation-workspace.tsx`）

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ip/invitation-workspace.tsx:77` | 邀请链接已生成，可以发给朋友了。 | 邀请链接已生成。 | 去聊天口吻 |
| `ip/invitation-workspace.tsx:89` | 邀请链接已复制，可以发给朋友了。 | 邀请链接已复制。 | 同上；`:109` 用 `startsWith("邀请链接已复制")` 判断，改后仍成立；测试受影响 |
| `ip/invitation-workspace.tsx:98` | 分享一个注册链接，在这里查看邀请记录。 | 分享注册链接，查看邀请记录。 | 去「一个」「在这里」 |
| `ip/invitation-workspace.tsx:102` | 暂时无法读取邀请记录 | 邀请记录加载失败 | 统一写法；测试受影响 |
| `ip/invitation-workspace.tsx:102` | 当前仍显示上次读取的记录。 | 当前显示的是上次加载的记录。 | 统一写法 |
| `ip/invitation-workspace.tsx:103` | 正在读取邀请记录… | 正在加载邀请记录… | 统一写法 |
| `ip/invitation-workspace.tsx:110` | 可选中链接手动复制。此链接用于统一账号注册，各应用的访问权限和权益分别管理。 | 可选中链接手动复制。此链接用于注册账号，各产品的使用权限与权益需另行开通。 | 「统一账号」「各应用」是内部说法 |
| `ip/invitation-workspace.tsx:117` | 没有注册邀请记录。 | 暂无邀请人。 | 这一栏标题是「我的邀请人」 |
| `ip/invitation-workspace.tsx:120` | 这里记录直接邀请的注册账号，不代表各应用的开通或使用情况。 | 仅记录由你直接邀请注册的账号，不反映对方的开通或使用情况。 | 去「这里」「各应用」 |
| `ip/invitation-workspace.tsx:122` | 还没有邀请记录。把邀请链接发给朋友，邀请他们注册。 | 还没有邀请记录。 | 空态 + 页面上已有链接和「复制链接」 |
| `ip/invitation-workspace.tsx:122` | 还没有邀请记录。生成邀请链接后，就可以发给朋友。 | 还没有邀请记录。 | 空态 + 页面上已有「生成邀请链接」 |
| `ip/invitation-workspace.tsx:122` | 这一页没有记录，请返回上一页。 | 此页暂无记录。 | 下方已有「上一页」按钮 |
| `ip/invitation-workspace.tsx:125` | 只记录注册时的邀请关系，已有账号不补绑。更换手机号或合并账号，不会改写原有记录。 | 只记录注册时的邀请关系，已有账号不会补记。更换手机号或合并账号，不会改变原有记录。 | 「补绑」是内部说法 |

## 时间格式（§4.8，不是 `slice(0,10)`，但没走 `formatDateTime()`）

| 位置 | 现状 | 改为 |
|---|---|---|
| `ip/enterprise-workspace.tsx:189` | 充值申请时间 `new Date(value).toLocaleString("zh-CN")`，显示成「2026/11/3 14:05:06」 | `formatDateTime(value)`（`@/lib/datetime`） |
| `ip/enterprise-management.tsx:18` | `const time = (value) => new Date(value).toLocaleString("zh-CN")`，用于移交有效期、邀请有效至、`:163` 移交提示 | 同上 |
| `ip/enterprise-reports.tsx:10` | 同上，用于三张流水表的时间列 | 同上 |
| `ip/enterprise-invitation-landing.tsx:27` | `expiry()` 输出「2026年11月3日」，`:162` 写「（北京时间）」 | 同上；「（北京时间）」视情况保留（这是给未登录访客看的，`formatDateTime` 按浏览器本地时区，不再是北京时间，需同步删掉这四个字） |
| `ip/invitation-workspace.tsx:22-26` | `dateText()` 用 `Intl.DateTimeFormat` 输出「2026/11/03 14:05」，无秒 | `formatDateTime(value)`；`:24` 的「时间暂不可用」可由 `formatDateTime` 的 fallback 代替 |

---

# 第二部分：服务端会显示给用户的报错文案

路径省略前缀 `apps/server/src/main/java/com/aistareco/aep/`。插值写成 `{x}`。错误码一律不改。

## 模式 A：口语、聊天口吻、「先…再」

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ipstudio/service/IpProjectService.java:843` | 这张画布已经有一份更新的内容了。现在保存会把那份覆盖掉，刷新一下再改。 | 这张画布已有更新的版本，继续保存将覆盖该版本。请刷新后再修改。 | 去「一下」「那份」 |
| `ipstudio/service/IpProjectService.java:116`、`:125` | 这张画布不存在，或者已经删了 | 画布不存在或已删除 | 去口语 |
| `ipstudio/service/IpRunService.java:209` | 这张正在生成中，等它完成再跑 | 该图片正在生成中，请等待完成后重试 | 「跑」口语 |
| `ipstudio/service/IpPublishService.java:199` | 这张还没出图，先生成再发布 | 这张图片还没有生成，请生成后发布 | 「出图」「先…再」 |
| `ipstudio/service/StudioVideoService.java:107` | 首帧图读不出来，没法按 {ratio} 裁剪。请换一张 PNG 或 JPG 图片，或把画幅改成和首帧图一致 | 首帧图无法读取，无法按 {ratio} 裁剪。请更换 PNG 或 JPG 图片，或将画幅改为与首帧图一致。 | 「读不出来」「没法」 |
| `ipstudio/h3/H3PromptRewrite.java:915` | 视频提示词优化没成功（{原因}），本次未扣积分，请重试或按原文生成 | 视频提示词优化失败（{原因}），本次未扣积分。请重试或按原文生成。 | 「没成功」；见测试小节（测试断言的是另一句 `videoPromptNotes`） |
| `ipstudio/dialogue/StudioDialogueTurnWorker.java:395` | 这一轮回复中断了（服务重启或连接丢失），冻结积分已退回，可以再发一次 | 本轮回复已中断（服务重启或连接断开），冻结积分已退回，请重新发送。 | 去口语 |
| `ipstudio/dialogue/StudioDialogueTurnWorker.java:129` | 现在回复的人太多，请稍后再发一次 | 当前使用人数较多，请稍后重新发送。 | 去口语 |
| `ipstudio/director/DirectorService.java:2167` | 这段对话太长了，请开一段新对话 | 对话内容已达上限，请新建对话。 | 去口语 |
| `ipstudio/director/DirectorService.java:2367` | {what}约 {n} 字，超过当前文本模型一次能读的约 {m} 字，AI 会读不全，所以没有提交、没有扣积分。 | {what}约 {n} 字，超过当前文本模型单次可读取的约 {m} 字。本次未提交，未扣积分。 | 去「会读不全，所以」 |
| `ipstudio/director/DirectorService.java:287` | 一键制作正在进行，请先停止制作，等进行中的任务结束后再删除 | 一键制作进行中。请停止制作，并在进行中的任务结束后删除。 | 去「先…等…再」 |
| `ipstudio/director/DirectorService.java:515-517` | 」还用在 {n} 个片段里（{片段名} 等），先在这些片段里解除关联再删除 | 」仍被 {n} 个片段使用（{片段名} 等），请在这些片段中解除关联后删除。 | 去「先…再」 |
| `ipstudio/director/DirectorService.java:3559-3561` | 「{模型}」不能出 {比例}，短剧导演台的道具、角色场景和分镜要用方图、横图和竖图。请选择其他图片模型 | 「{模型}」不支持生成{比例}。短剧导演台的道具、角色、场景和分镜需要方图、横图和竖图，请选择其他图片模型。 | 「出」口语；测试受影响 |
| `ipstudio/execution/StudioPlanExecutionService.java:709` | 预算不够，还差 {n} 积分。可以追加预算或缩小计划后再继续 | 预算不足，还差 {n} 积分。请追加预算或缩小计划后继续。 | 去口语 |
| `ipstudio/execution/StudioPlanSteps.java:108` | 这一步现在还不能自动做 | 此步骤暂不支持自动执行 | 去口语 |
| `ipstudio/execution/StudioNaturalApprovals.java:55`、`:57` | 你说的重做额度是 {n} 积分，确认时只能用这个数；要改请直接说新的额度，或在卡片上修改（`:57` 同句式「上限」） | 你在消息中提到的重做额度为 {n} 积分，确认时将按此金额执行。如需调整，请在消息中说明新的额度，或在确认卡上修改。（`:57` 同改） | 去「这个数」；这是对话里的报错，保留「你」 |
| `config/PhoneVerificationGuard.java:135` | 请先绑定手机号后再操作 | 请绑定手机号后操作 | 「先…后再」重复 |
| `ipstudio/service/StudioWorkflowWorker.java:565` | 创作超时，冻结积分已释放，可重新生成 | 创作超时，冻结积分已退回，可重新生成 | 「释放」是账本用语，界面一律说「退回」 |
| `ipstudio/dialogue/StudioDialogueService.java:512` | 这次制作已确认由{企业/个人}积分付款，制作期间的对话也由它付；要换付款账户，请先结束这次制作 | 本次制作已确认使用{企业/个人}积分付款，制作期间的对话也使用该账户。如需更换付款账户，请结束本次制作。 | 「由它付」口语 |
| `ipstudio/execution/StudioPlanExecutionService.java:180` | 付款账户与这次制作已确认的不一致；要换付款人，请结束这次制作后重新开始 | 付款账户与本次制作已确认的不一致。如需更换付款账户，请结束本次制作后重新开始。 | 「付款人」与「付款账户」混用 |

同类还有约 20 处「X 正在生成，完成后再 Y」「请先 X，再 Y」：
`git grep -nE '完成后再|，再[^次]|先.{1,12}再' -- 'apps/server/src/main/java/com/aistareco/aep/ipstudio/director/DirectorService.java' 'apps/server/src/main/java/com/aistareco/aep/dap/service/*.java'`
（典型：`DirectorService.java:432/566/599/601/612/902/904/1705/2163`；`dap/service/DapMaterialService.java:202`、`DapWorkflowService.java:257/307`、`DapAssetService.java:480/614`、`DapCompositionService.java:153/157`、`ipstudio/service/IpDemoTemplateService.java:126`）。改法统一为「请 X 后 Y」，例如 `DapMaterialService.java:202`「该数字人还没有定妆形象，先完成创建再送审」→「该数字人还没有定妆形象，请完成创建后送审」。

## 模式 B：暴露内部词、字段名、技术细节

| 位置 | 原文 | 改为 | 依据 |
|---|---|---|---|
| `ipstudio/service/IpDocs.java:69` | 画布内容缺 nodes / connections | 画布内容不完整，请刷新后重试 | 字段名 |
| `ipstudio/service/IpProjectService.java:974`、`ipstudio/service/IpDemoTemplateService.java:657` | 画布数据无法序列化 | 画布内容保存失败，请重试 | 「序列化」 |
| `ipstudio/service/IpProjectService.java:208` | 画布数据过大（{n}KB），请精简节点或参考图后重试 | 画布内容过大（{n} KB），请删除部分节点或参考图后重试 | 单位前加空格 |
| `ipstudio/service/IpProjectService.java:802` | 一次最多重签 {n} 张图，请分批 | 一次最多刷新 {n} 张图片，请分批操作 | 「重签」指签名链接，内部说法 |
| `ipstudio/service/IpPublishService.java:192` | 画布上找不到节点 {nodeId} | 画布上找不到所选内容，请刷新后重试 | 把节点 ID 拼进了报错 |
| `ipstudio/service/IpPublishService.java:87` | 请先选择要发布的主形象节点 | 请选择要发布的主形象图片 | 用户选的是一张图 |
| `ipstudio/service/IpRunService.java:454` | 请选择图片节点 | 请选择一张图片 | 同上 |
| `dap/service/DapMaterialService.java:82` | 缺少查询条件（refType + refId） | 缺少查询条件，请刷新后重试 | 字段名 |
| `dap/service/DapAvatarRefResolver.java:164` | 展示图指针格式应为 look:&lt;id&gt; / deriv:&lt;id&gt; / variant:&lt;idx&gt; / shot:&lt;name&gt; | 所选展示图无效，请重新选择 | 内部格式 |
| `dap/service/DapLicenseService.java:64` | 真人形象不能通过声明式接口直接授权，请完成当前协议确认与本人刷脸核验 | 真人形象需完成授权协议确认和本人刷脸核验后才能授权 | 「声明式接口」 |
| `dap/service/modelink/HttpModelinkGateway.java:197` | 该素材分组当前不可删除（未到终态或组内仍有素材） | 该素材分组仍在处理中或仍有素材，暂时无法删除 | 「终态」 |
| `ipstudio/service/IpRunService.java:554` | 图片已交给生成引擎，请等待原任务结果 | 图片已提交生成，暂时无法停止，请等待生成结果 | 「生成引擎」「原任务」 |
| `ipstudio/service/IpRunService.java:562` | 视频已交给生成引擎，暂时不能停止。可以继续编辑并等待原任务结果 | 视频已提交生成，暂时无法停止。你可以继续编辑，并等待生成结果。 | 同上 |
| `ipstudio/service/StudioHypitMedia.java:36` | 视频处理工具不可用，请配置Node.js 22以上、FFmpeg 5.1以上及Hypit媒体适配器 | 视频处理服务暂不可用，请稍后重试或联系平台处理 | 把服务器依赖告诉用户；运维信息只留日志 |
| `ipstudio/service/JusuanImageClient.java:62` | 图片模型的调用地址必须是有效的 HTTPS 地址 | 当前图片模型暂不可用，请选择其他模型或联系平台处理 | 配置错误不给用户看 |
| `ipstudio/service/JusuanImageClient.java:570` | 当前图片模型尚未配置合法请求规格 | 当前图片模型暂不可用，请选择其他模型 | 同上 |
| `ipstudio/service/StudioVisionFallback.java:59` | 提示词库缺少「stage-vision-batch」：请在后台「提示词与技能」里启用或补齐后重试 | 看图功能暂不可用，请联系平台处理 | 内部 key + 让用户去后台 |
| `ipstudio/service/StudioPlatformPricing.java:59` | 配音定价暂不可用，请检查运营平台成本与定价配置 | 配音暂不可用，请联系平台处理 | 「成本」不给用户看（`PublicModelErrorPolicy` 只对 `STUDIO_SPEECH*` 等码过滤，这个码 `STUDIO_PLATFORM_PRICING_UNAVAILABLE` 不在内，会原样到界面） |
| `ipstudio/service/StudioPlatformPricing.java:62` | 配音定价配置与模型不匹配，请联系运营核对 | 配音暂不可用，请联系平台处理 | 同上 |
| `ipstudio/service/StudioTokenBilling.java:23` | 请先配置文本模型标准售价。想免费送用户体验，请发放模型赠款 | 此模型暂未定价，请选择其他模型 | 给运营的话出现在用户界面上 |
| `ipstudio/service/StudioTokenBilling.java:45` | 文本模型渠道已变更，请重新确认后再生成 | 文本模型已更新，请重新确认后生成 | 「渠道」 |
| `ipstudio/service/StudioPointPricing.java:31`、`:38` | 模型用户积分售价尚未正确配置 / 模型积分换算尚未正确配置 | 此模型暂未定价，请选择其他模型（两处同改） | 「换算」「用户积分售价」 |
| `ipstudio/dialogue/StudioDialogueService.java:545`；`ipstudio/service/StudioWorkflowService.java:251`、`:495`、`:943` | 此模型尚未配置按量积分售价 | 此模型暂未定价，请选择其他模型 | 同上，四处统一 |
| `ipstudio/service/StudioWorkflowService.java:253`、`:497` | 模型计费配置已更新，请刷新后重试 | 模型价格已更新，请刷新后重试 | 「计费配置」 |
| `ipstudio/service/StudioWorkflowService.java:437` | 提示词优化未绑定可用模型，可以关闭智能优化按原文生成 | 提示词优化暂不可用，可关闭「智能优化」按原文生成 | 「绑定」；引用开关名加「」 |
| `ipstudio/service/StudioWorkflowService.java:443` | 提示词优化暂不可用（绑定模型未配置按量售价），可以关闭智能优化按原文生成 | 提示词优化暂不可用，可关闭「智能优化」按原文生成 | 括号里是运营信息 |
| `ipstudio/service/StudioWorkflowWorker.java:404` | 提示词优化用的文本模型已停用，可以关闭智能优化按原文生成 | 提示词优化暂不可用，可关闭「智能优化」按原文生成 | 三处统一 |
| `ipstudio/dialogue/StudioDialogueService.java:536-537` | 所选文本模型不可用：它不是对话用途的默认模型，也没有在后台「AI 模型」里启用为对话用途的候选模型 / 还没有配置可用的对话模型：请在后台「AI 模型」里为对话用途绑定默认模型 | 所选对话模型不可用，请重新选择 / 对话功能暂不可用，请联系平台处理 | 「用途」「候选」「后台」是运营概念 |
| `ipstudio/service/StudioWorkflowWorker.java:124` | 全片拆解需要至少4096输出Token预算，请调整模型配置 | 当前模型不支持全片拆解，请联系平台处理 | 用户调不了模型配置 |
| `ipstudio/service/StudioWorkflowWorker.java:136` | 片段读取结果被截断，请调整模型输出配置 | 片段读取结果不完整，本次未扣积分，请重试 | 同上（先核实这一处确实未扣） |
| `ipstudio/service/StudioWorkflowWorker.java:328` | 本次Token预算已用完，请调整后台预算 | 本次用量已达上限，请缩短内容后重试 | 「后台预算」用户无法操作 |
| `ipstudio/service/StudioWorkflowWorker.java:352` | 模型输出被截断，请调整后台输出预算 | 生成内容不完整，请缩短要求后重试 | 同上 |
| `ipstudio/service/StudioVisionFallback.java:127` | 分批读取所需Token超出本次预算，请减少素材或调整后台预算 | 素材过多，超出本次用量上限，请减少素材后重试 | 同上 |
| `ipstudio/dialogue/StudioDialogueTurnWorker.java:574`；`ipstudio/dialogue/DialogueModels.java:115`；`ipstudio/dialogue/tools/ViewImagesTool.java:152`；`ipstudio/dialogue/tools/ProposePlanTool.java:133`；`ipstudio/service/StudioWorkflowWorker.java:514` | 模型未返回有效Token用量，本次未扣积分 | 生成服务未返回用量信息，本次未扣积分，请重试 | Token 前后缺空格；给下一步。`ipstudio/service/StudioTokenBilling.java:56` 是带空格版本，一并改成同一句 |
| `ipstudio/service/StudioVisionFallback.java:128`；`ipstudio/service/StudioRecreation.java:164` | 分批画面记录不完整，请核对模型输出 / 拆解报告不完整或画面引用无效，请核对模型输出 | 画面记录不完整，请重试 / 拆解报告不完整，请重试 | 用户没法「核对模型输出」 |
| `service/AiModelGuardService.java:125` | 该模型今日成本额度已用完，请联系管理员调整配额 | 该模型今日用量已达上限，请明天再试或选择其他模型 | 「成本额度」是平台成本；「管理员」对企业成员有歧义 |
| `service/AiModelGuardService.java:114` | 该模型今日额度已用完，请联系管理员调整配额 | 该模型今日用量已达上限，请明天再试或选择其他模型 | 同上 |
| `ipstudio/service/StudioWorkflowWorker.java:112`、`:292`；`ipstudio/dialogue/StudioDialogueTurnWorker.java:490` | 创作模型已停用或不再是默认模型，请联系管理员 / 对话模型已停用或不再是默认模型，请联系管理员 | 当前创作模型已停用，请联系平台处理 / 当前对话模型已停用，请重新选择或联系平台处理 | 「默认模型」是运营概念；企业成员会以为是企业管理员 |
| `ipstudio/director/DirectorService.java:857`、`:895`、`:1166` | 暂无支持片段生成的视频模型，无法确定片段时长。请联系管理员开通（`:1166` 无中间一句） | 暂无可用于片段生成的视频模型，请联系平台处理 | 同上「管理员」 |
| `ipstudio/service/IpRunService.java:787` | 所选模型暂未开放该分辨率，请重新选择模型或联系运营 | 所选模型暂不支持该分辨率，请选择其他模型 | 「运营」是平台内部角色 |
| `ipstudio/service/IpRunService.java:862` | 选择的出图模型不可用，请在下拉里重新选一个 | 所选图片模型不可用，请重新选择 | 「出图」「下拉里」 |
| `ipstudio/service/IpRunService.java:776` | 选中的那次生成不存在或不属于本项目，请重新生成并选图 | 所选生成结果不存在或不属于此画布，请重新生成并选择图片 | 「项目」本仓已叫「画布」 |
| `ipstudio/service/IpPublishService.java:83` | 该项目已发布为数字资产 {id}，暂不支持追加发布 | 这张画布已发布为数字资产 {id}，暂不支持再次发布 | 同上 |
| `ipstudio/service/IpProjectService.java:141` | 工作流不存在或已下线：{id} | 模板不存在或已下线 | 界面叫「模板」；不拼 id |
| `dap/service/DapCompositionService.java:218` | 」是真人复刻形象，需要生效中的肖像授权才能出片。 | 」是真人复刻形象，需要生效中的肖像授权才能生成视频。 | 「出片」 |
| `dap/service/DapAvatarRefResolver.java:128` | 该数字人已在回收站，请先在 AiAvatar 中恢复 | 该数字人已在回收站，请在回收站中恢复后使用 | 用户在 IP Studio 里看不到「AiAvatar」这个入口 |
| `enterprise/service/EnterpriseBillingService.java:71` | 企业积分只用于工作台创作 | 此功能不支持使用企业积分 | 「工作台创作」不是本站叫法；数字资产也能用企业积分，原句不准 |
| `enterprise/service/EnterpriseBillingService.java:91`、`:226` | 已达到企业设定的在途任务上限，请等待已有任务完成 | 已达到企业设定的同时进行任务上限，请等待进行中的任务完成后重试 | 「在途」 |
| `enterprise/service/EnterpriseLifecycleService.java:132` | 仍有在途任务或冻结积分，请先完成结算 | 仍有进行中的任务或冻结积分，请等待任务结算后操作 | 「在途」；用户无法「完成结算」 |
| `enterprise/service/EnterpriseService.java:181` | 角色或能力无效 | 角色或授权无效 | 界面叫「授权」 |
| `enterprise/service/EnterpriseService.java:214` | 模型或在途上限无效 | 可用模型或任务上限设置无效 | 「在途」 |
| `enterprise/service/EnterprisePointsService.java:197`、`:199` | 企业不可使用 | 该企业已关闭或暂不可用 | 说清是什么情况 |
| `enterprise/service/EnterpriseService.java:101` | 未找到该手机号的产品账号，请让对方先登录并开通数字资产平台，或使用企业邀请链接 | 未找到该手机号对应的账号。请对方登录并开通 IP Studio 后再添加，或通过企业邀请链接加入。 | 产品叫法；「让对方先」 |
| `enterprise/service/EnterpriseAccessService.java:29` | 请先开通数字资产平台 | 请开通 IP Studio 后使用 | 产品叫法 |
| `enrollment/config/EnrollmentGuard.java:138`、`:149` | 尚未开通该子产品，请先使用激活码开通 | 尚未开通此产品，请使用激活码开通 | 「子产品」内部说法 |
| `enrollment/config/EnrollmentGuard.java:119` | 该接口尚未登记子产品归属，请联系平台运营 | 此功能暂不可用，请联系平台处理 | 「接口」「子产品归属」 |
| `enrollment/service/EnrollmentService.java:298` | 该激活码不能用于开通此子产品 | 该激活码不能用于开通此产品 | 「子产品」 |
| `enrollment/service/EnrollmentService.java:405` | 开通记录写入异常，请重试 | 开通失败，请重试 | 「写入异常」 |
| `service/CreditService.java:209`、`:537` | 积分余额不足，本次操作需 {n}，当前可用 {m} | 积分余额不足，本次需要 {n} 积分，当前可用 {m} 积分 | 数字缺单位。注意：`ipstudio/execution/StudioPaymentMessage.java:8` 用正则解析这句，见「需要核实」 |

服务端主表 79 条。同类还有：
- 与主表同一毛病、未单列的 15 条（改法照主表同类）：`ipstudio/service/IpDocs.java:66`「画布内容格式不对」；`ipstudio/service/IpRunService.java:160`「这个节点不用运行」、`:163`「该节点正在生成中，请等它完成后再运行」、`:431`/`:433`「选择的出图模型不可用」、`:557`「生成已交给引擎，暂时不能停止。请等待原任务结果」；`ipstudio/service/IpProjectService.java:449`「这个素材取不到了，可能已被清理」；`ipstudio/director/DirectorService.java:2010`「剧本正在写，请稍候」、`:1699`/`:1701`「本集正在（重）写分镜脚本，完成后再试」、`:2723`「这个片段的视频正在生成，完成后再改镜头」；`ipstudio/service/IpDemoTemplateService.java:225`「这张画布的素材太多（{n} 个），先精简到 {m} 个以内」；`ipstudio/execution/StudioNaturalApprovals.java:61`/`:63`「…需要你在消息里说出新的上限/这个数，或在卡片上修改」；`dap/controller/DapRealAuthController.java:68`/`:130`「缺少捕获会话 id / 缺少送审对象 id」；`dap/service/DapAvatarRefResolver.java:131`「请先在 AiAvatar 完成形象生成」；`enrollment/config/EnrollmentGuard.java:131`「请求缺少子产品标识」；`enterprise/service/EnterpriseLifecycleService.java:69`「成员、余额或在途任务已变化」。
- 「请求编号无效 / 同一请求的内容已改变，请重新提交」这类幂等校验（用户正常操作不会触发，触发了也看不懂「同一请求」）约 30 处：
  `git grep -nE '请求编号无效|同一(条)?.{0,4}请求的.{0,6}已改变|同一条消息的内容已改变' -- apps/server/src/main/java`
  建议统一为「请求已失效，请刷新页面后重试」，其中消息类改「消息内容已变化，请刷新后重新发送」。
- 「生成引擎未配置：请在管理后台「AI 应用绑定」…绑定端点」这类运维指引（`dap/service/DapJobService.java:149`、`ipstudio/service/IpRunService.java:850`、`:854`、`dap/service/modelink/HttpModelinkGateway.java:225`、`dap/service/modelink/ModelinkService.java:79`，后两处还带供应商名「七牛 modelink」）：见「存疑」。
- 单位前缺空格：`ipstudio/service/IpProjectService.java:280`「{n}MB 上限」、`dap/service/DapWorkflowService.java:203`「（上限 15MB）」、`dap/service/DapAssetService.java:761`「（上限 30MB）」、`ipstudio/service/StudioHypitMedia.java:36`「Node.js 22以上」。`git grep -nE '[0-9]MB|[一-龥]Token|Token[一-龥]' -- apps/server/src/main/java`
- `ipstudio/**` 里经 `invalid()/fail()/bad()/conflict()` 包装的 message 约 470 处没有逐条进主表：其中 `fail(...)` 大多是回给模型的工具报错（「请如实告诉用户」「propose_plan」），不显示给用户，不要按界面文案改；`invalid(...)`/`bad(...)` 里另有「没有返回 JSON」「模型返回格式有误」「没有写镜头」这类，查看：
  `grep -rhoE '(invalid|bad)\("[^"]*[一-龥][^"]*"' apps/server/src/main/java/com/aistareco/aep/ipstudio | sort -u`

---

## 叫法变动（全仓同步）

### 1. 开通的产品叫什么：「数字资产 / 数字资产产品 / 数字资产平台 / 数字人资产平台」四种并存
同一个开通（`product_enrollment` 的 `aiavatar`）在界面上有四种叫法，而用户看到的产品名是 IP Studio。建议统一为「IP Studio」（是否改，见「存疑」第 1 条）。出现位置：
- `packages/types/src/account.ts:26` `aiavatar: "数字人资产平台"`（`EnrollmentGate` 的缺省产品名，`packages/landing/src/EnrollmentGate.tsx:125`）
- `apps/web-aiavatar/src/components/hub/auth.tsx:104` `productLabel="数字资产"`（全站开通门）
- `apps/web-aiavatar/src/ip/enterprise-invitation-landing.tsx:168`（两处「数字资产产品」）
- `apps/web-aiavatar/src/ip/enterprise-workspace.tsx:161`「数字资产产品」
- `apps/web-aiavatar/src/ip/enterprise-management.tsx:183`「数字资产平台」、`:200`「数字资产产品」
- `apps/web-aiavatar/src/proto/screen-login.tsx:78` `brandLabel: '数字资产平台'`（旧登录屏，非 ID 模式）
- `apps/web-aiavatar/src/ip/publish/publish-dialog.tsx:153`「去数字资产平台查看」
- 服务端：`enterprise/service/EnterpriseAccessService.java:29`、`enterprise/service/EnterpriseService.java:101`；`dap/service/DapRealAuthService.java:313/317/323/346/353/354/413`（刷脸回调页「返回数字资产平台」等）；`dap/service/DapLicenseService.java:256`（授权凭证页副标题）；`dap/service/DapConsentService.java:26` `PLATFORMS`（授权说明里的平台名，属于法律文本，改前需确认）
- mock：`apps/web-aiavatar/src/proto/api.ts:1285/1304/1375`（与 `DapConsentService.PLATFORMS` 同形，要一起改或都不改）
- 测试：`apps/web-aiavatar/src/ip/canvas-gate-auth.test.tsx:9/29`（mock 文案「请先开通数字资产」，只是桩，改不改不影响）
- 查找：`git grep -nE '数字资产平台|数字资产产品|数字人资产平台|productLabel="数字资产' -- apps packages ':!*.md'`（注释里的「数字资产平台」是域名称，不改）

### 2. 「在途」→「进行中」
财务/工程用语，用户界面上统一说「进行中的任务」。
- 前端：`ip/enterprise-workspace.tsx:167/169/171`、`ip/enterprise-management.tsx:172/174/178/205`、`ip/enterprise-reports.tsx:36`、`ip/studio-billing-dialog.tsx:69`（「每人 {n} 项在途任务限制」，不在本批，一并改为「每人最多 {n} 项进行中的任务」）
- 服务端：`enterprise/service/EnterpriseBillingService.java:91/226`、`enterprise/service/EnterpriseLifecycleService.java:69/132`、`enterprise/service/EnterpriseService.java:214`、`ipstudio/execution/StudioPlanExecutionService.java:191`（「上限不能低于已花费和在途的 {n} 积分」→「已花费和进行中的」）、`ipstudio/execution/StudioPlanExecutor.java:360`（进度条原因「本阶段已花 X 积分、在途 Y 积分」→「进行中 Y 积分」）
- 后台/财务专用的不改：`enterprise/service/EnterpriseRechargeService.java:130`、`service/materialvideo/MaterialVideoJobService.java:457/516`
- 不改：`ipstudio/execution/StudioPlanExecutionControl.java:78`（写给模型的上下文）
- 测试：`ip/enterprise-management.test.tsx:69` `getByLabelText("每位成员最多在途任务数")`
- 查找：`git grep -nE "[\"'>\`][^\"'<\`/]*在途" -- 'apps/web-aiavatar/src/**' ':!*.test.*'`；`git grep -nE '"[^"]*在途[^"]*"' -- apps/server/src/main/java`

### 3. 企业邀请链接：「分享链接 / 邀请链接 / 企业邀请链接」→「邀请链接」
- `ip/enterprise-management.tsx:181`（按钮「创建分享链接」、成功提示「分享链接已创建…」）、`:183`（「通过分享链接加入」）；弹窗标题「分享企业邀请」可保留（动作），里面的「企业邀请链接」「复制邀请链接」已是本叫法
- 测试：`ip/enterprise-management.test.tsx:101`、`:112`（`{ name: "创建分享链接" }`）
- 不涉及：`proto/screen-library.tsx:523`「已复制分享链接」、`ip/studio-conversation-share.tsx`（对话分享，另一个东西）

### 4. 「个人钱包」→「个人积分」
- `ip/enterprise-management.tsx:181`、`ip/enterprise-invitation-landing.tsx:177`
- 查找：`git grep -n '个人钱包' -- 'apps/web-aiavatar/src/**' ':!*.test.*'`（其余命中都在注释）

### 5. 用户可见处的「Studio」→「IP Studio」
- `ip/invitation-registration.tsx:96/101/103/111`、`ip/enterprise-invitation-landing.tsx:145/156/159`（`:156/:159` 改为「返回首页」后就不再有「Studio」）
- 查找：`git grep -nE "[\"'>][^\"'<]*(进入|加入|注册|了解|认识|返回) Studio" -- 'apps/web-aiavatar/src/**'`

### 6. 界面上的「受理 / 释放 / 归集」
- 「受理」→「开始 / 提交」：`ip/enterprise-management.tsx:205`（三处）
- 「释放」→「退回」：`ip/enterprise-management.tsx:205`、`ipstudio/service/StudioWorkflowWorker.java:565`
- 「归集」→「回收」：`ip/enterprise-management.tsx:205`、`ip/enterprise-reports.tsx:13`

---

## 测试会受影响的

前端（都在 `apps/web-aiavatar/src/`）：

| 测试 | 断言的句子 | 建议 |
|---|---|---|
| `ip/enterprise-workspace.test.tsx:151` | `findByText(/数据刷新失败，当前显示上次读取的内容/)` | 改为断言 `role="alert"` 的 Alert 存在且旧数据仍在表格里；或跟着改成新句子 |
| `ip/enterprise-workspace.test.tsx:124` | `getByText("这里仅展示你发起的申请，核准后积分进入企业待分配余额。")` | 本批没改这句；如后续改，改为断言表头 / 标题「我的充值申请」 |
| `ip/enterprise-workspace.test.tsx:91` | `getByLabelText("回收所选成员全部可用企业积分")` | 本批没改（控件名），保留 |
| `ip/enterprise-management.test.tsx:69` | `getByLabelText("每位成员最多在途任务数")` | 跟着改为新标签，或用 `#enterprise-policy-max` |
| `ip/enterprise-management.test.tsx:93` | `getByRole("button", { name: "核对关闭企业条件" })` | 改为 `{ name: "关闭企业" }`；后面的 `findByRole("dialog", { name: "关闭企业" })` 不变 |
| `ip/enterprise-management.test.tsx:101`、`:112` | `getByRole("button", { name: "创建分享链接" })` | 改为 `{ name: "创建邀请链接" }` |
| `ip/enterprise-reports.test.tsx:32` | `getAllByText("已结算，余款已退回")` | 改为新状态词；更好是断言 `status: "released"` 对应的那一列有内容 |
| `ip/enterprise-invitation-landing.test.tsx:60` | `getByRole("link", { name: "进入企业" })` | 改为 `{ name: "进入企业管理" }`（`:69` 已是这个） |
| `ip/enterprise-invitation-landing.test.tsx:84` | `getByRole("button", { name: "重新读取" })` | 改为 `{ name: "重试" }` |
| `ip/invitation-registration.test.tsx:36` | `getByRole("button", { name: "重新读取邀请" })` | 改为 `{ name: "重试" }` |
| `ip/invitation-workspace.test.tsx:35`、`:88` | `"邀请链接已复制，可以发给朋友了。"` | 改为 `"邀请链接已复制。"`，或断言 `role="status"` |
| `ip/invitation-workspace.test.tsx:55` | `findByText("暂时无法读取邀请记录")` | 改为新标题，或断言 `role="alert"` |
| `ip/invitation-workspace.test.tsx:104` | `heading { name: "请使用统一账号登录" }` | 本批没改（仅非 ID 模式），保留 |

服务端（`apps/server/src/test/java/com/aistareco/aep/`）：

| 测试 | 断言 | 建议 |
|---|---|---|
| `ipstudio/director/DirectorImageModelTest.java:194`、`:251` | `e.getMessage().startsWith("…「GPT Image 2 4K」不能出 1:1 方图")` | 改为断言错误码 `DIRECTOR_IMAGE_MODEL_UNSUPPORTED` + `details.missingRatios` 含 `1:1` |
| `ipstudio/service/StudioVideoRewriteWorkerTest.java:153` | `"提示词优化没成功，已按原文生成"`（`videoPromptNotes`，不是本表那句报错，但同样口语） | 如一起改 `videoPromptNotes` 文案，此处跟着改；该句来源：`git grep -n '提示词优化没成功' -- apps/server/src/main` |
| `ipstudio/execution/StudioPlanExecutorTest.java:245/253/271`、`service/ai/PublicModelErrorPolicyTest.java:41` | 自己构造「积分余额不足，本次操作需 320，当前可用 16」 | 不直接依赖 `CreditService`，但和 `StudioPaymentMessage` 的正则绑在一起，见下一节 |

---

## 需要核实或连带改行为

1. **`service/CreditService.java:209/537` 的余额不足句被正则解析**：`ipstudio/execution/StudioPaymentMessage.java:8` 用 `积分余额不足，本次操作需 ([0-9]+)，…` 去匹配这句话再重组给用户。改了 `CreditService` 的文字，匹配就失效、制作进度里的余额提示会退回原文。要改就两边一起改，更好是让 `CreditService` 在异常 details 里带 `required` / `available` 两个数，`StudioPaymentMessage` 读结构而不是读文字（§8.0.1 ⑩）。
2. **`ipstudio/service/IpRunService.java:320`「视频任务没建齐，请稍后再试」**：触发条件是 `videoJobs.submit(...)` 返回的任务数和请求数不一致，这时已经有一部分视频任务建好并冻结了积分。文案让用户「稍后再试」，用户再点一次会再提交一整批，可能重复扣费。文字应写成「部分视频任务创建失败，已创建的任务会继续生成。请在画布上查看后再决定是否补生成。」，前提是先确认已建的那几条确实会继续跑、不会被回滚；如果会回滚，现在的写法也不对。
3. **企业消费流水的「任务类型」**（`ip/enterprise-reports.tsx:36`）：`referenceType === "material_video_job"` 显示「视频生成」，其余一律「Studio 生成」。但企业付款现在还覆盖 `dap-job`（数字资产生成）和 `dap-voice`（声音克隆）（`enterprise/service/EnterpriseBillingService.java:25`），这两类会被标成「Studio 生成」，不准。需要补映射：`ip-run` → 「画布生成」、`dap-job` → 「数字资产生成」、`dap-voice` → 「声音克隆」。同表最后一列「记账结果」和「状态」列渲染的是同一个 `usageStatus`，重复了一列。
4. **企业生成设置说明**（`ip/enterprise-management.tsx:165/171`）：写的是「Studio 任务」，实际模型名单和在途上限也约束数字资产、声音克隆（AGENTS「所有付费功能同一套企业付款」）。主表已按真实范围改写；请确认 `dap-voice` 这类 `FLAT_FEES`（`EnterpriseBillingService.java:27`）是否也受「允许模型」名单约束，若不受，说明要写成「模型限制仅对按模型计费的任务生效」。
5. **`ip/enterprise-invitation-landing.tsx:105`**：冒充查看（运营查看）时 `join()` 抛普通 `Error("本人账号才能接受邀请")`，`failureMessage` 对非 `ApiError` 一律显示「连接暂时中断，请检查网络后重试。」，文字和真实原因不符。目前 `blocked` 时按钮不显示，正常路径碰不到；若要兜底，改成抛 `ApiError` 带 `IDENTITY_IMPERSONATION_UNSUPPORTED`。
6. **`ip/invitation-workspace.tsx:125`「分佣与奖励暂未开放。」**：「暂未开放」暗示以后会有。AGENTS「账号注册邀请」写的是「邀请不产生分佣/奖励」。若没有明确排期，建议改为「邀请不产生分佣或奖励。」——需要产品确认。
7. **`ipstudio/service/StudioWorkflowWorker.java:136`**：主表把「请调整模型输出配置」改成了「本次未扣积分，请重试」，这依赖该分支确实未扣积分，改前确认（同文件 `:191/:194` 明写了未扣积分，`:136` 没写）。
8. 出口过滤：`service/ai/PublicModelErrorPolicy.java` 会把一部分报错（命中「引擎 / 上游 / 定价 / 成本」等词且错误码属于模型类）在出 wire 时换成通用句。主表 B 类改动后，一些原本被换掉的句子可能变成原样显示（或反过来）。改完用 `PublicModelErrorPolicyTest` 跑一遍，并对 `STUDIO_PLATFORM_PRICING_*`、`AI_USAGE_*`、`STUDIO_HYPIT_UNAVAILABLE` 各抽一条看最终到界面的文字。

---

## 仅手机端（不改，列出备查）

- `app/me/page.tsx`：桌面形态 `:34` 直接返回 `AccountOverview`，下面整页都是手机版。
  - `:76`、`:204`「会员与算力」，与桌面「会员与积分」（`shell/account-navigation.ts:6`、`shell/account-workspace.tsx:55`）叫法不一致
  - `:187`「积分暂时读不出来，查看积分」（aria-label）→ 按统一写法应为「积分加载失败，点击查看积分」；`title`「可用积分，不含冻结的；点击查看积分」
  - `:192`「画布和场景草稿，接着做」（扫描已标「接着做」）
  - `:194`「写剧本、拆分镜、出片」（「出片」）
  - `:142`「画布和宽表格更好用」/「回到竖排界面」、`:160-161`「回到旧版」/「换回原来的首页和导航」、`:214`「回到旧版」（返回类按钮应为「返回旧版」）
  - `:67`「授权证书 · 待补确认」、`:66`/`:197`「对外发布面 · 扫码即看」
- `components/hub/ui.tsx:143-145` 手机「创作」面板：「选个场景，编导先写分镜再出片」「选个场景，补一句要求就出图」「素材和结果摆在一起，自由组合」（「出片 / 出图 / 就 / 先…再」）
- `components/hub/ui.tsx:161`「想做点什么？」
- `ip/enterprise-workspace.tsx:184`「可横向滑动查看完整积分信息。」（`.enterprise-mobile-hint`）
- `ip/invitation-workspace.tsx:97`「返回我的账号」（`.invitation-mobile-back`，仅 `data-layout="mobile"` 显示）

---

## 存疑（拿不准的，写出两种写法让用户选）

1. **开通产品的统一名称**（见「叫法变动」第 1 条）
   - 写法 A：一律「IP Studio」（用户在页面左上角看到的就是这个名字）。例：「加入企业不会自动开通 IP Studio，成员需自行开通。」
   - 写法 B：保留「数字资产」作为开通项名称（与激活码、后台开通记录一致），只把「数字资产产品 / 数字资产平台 / 数字人资产平台」统一成「数字资产」。例：「加入企业不会自动开通「数字资产」，成员需自行开通。」
   - 授权说明里的 `DapConsentService.PLATFORMS`「数字资产平台」是用户已同意过的协议文本，任何一种写法都建议先不动它。
2. **报错里的运维指引**（`dap/service/DapJobService.java:149`、`ipstudio/service/IpRunService.java:850/854`、`dap/service/modelink/HttpModelinkGateway.java:225`、`dap/service/modelink/ModelinkService.java:79`）。AGENTS §8.0 要求「错误文案给出运维指引（去 admin 哪里配什么）」，但这些句子会原样显示给普通用户（「请在管理后台「AI 应用绑定」为「数字人 · 人设」用途绑定一个支持图片输入的模型」，后两处还带供应商名「七牛 modelink 端点」）。
   - 写法 A：用户看到「生成服务暂不可用，请联系平台处理。」，运维指引放进 `internalDetail` / 日志 / `error.details.ops`，后台错误日志里能看到。
   - 写法 B：保留指引，只去掉供应商名和「端点」等词：「生成服务尚未配置，请联系平台处理（管理员可在后台「AI 应用绑定」中配置）。」
   - 选 A 需要同步修订 AGENTS §8.0 那句话。
3. **朋友邀请页三张场景卡的标题**（`ip/invitation-registration.tsx:8-10`）：「让想象，拥有自己的样子。」「让角色，走进新的故事。」「让一个想法，长成一个世界。」三条都以「让」开头，同页 `:120` 又有「让角色成为可延展的 IP」「让每次创作都成为下一次的起点」「让画面开口说话」「让角色拥有自己的世界」，描述里还有「让灵感有处可去」，「延展」也出现三次。AGENTS 点名「同一组卡片清一色『让……』」是模板感。但这是营销页设计稿，可能是定稿。
   - 写法 A（改）：「拥有自己的样子。」「走进新的故事。」「从一个想法，到一个世界。」；`:120` 第二行改「每一次创作，都是下一次的起点。」
   - 写法 B（不改）：视为品牌营销定稿，和「让灵感成形，让 IP 出圈」同一调性。
4. **分享卡标题**（`app/enterprise/invite/page.tsx:6`「一份企业创作邀请 · IP Studio」、`app/invite/[code]/page.tsx:6`「一份来自朋友的邀请 · IP Studio」）：在微信里被分享时显示。
   - 写法 A：保留「一份…邀请」，这是常见的分享语气。
   - 写法 B：「企业邀请 · IP Studio」/「好友邀请 · IP Studio」，更简短，与页脚「企业邀请 · IP Studio」（`ip/enterprise-invitation-landing.tsx:182`）一致。
5. **企业页右上角「我的账号」链接**（`ip/enterprise-workspace.tsx:31`、`:156`）：去 `/me`。按第一批「返回 X」的约定可改「返回我的账号」；但它放在页头操作区、与「刷新」并列，作为导航入口也说得通。两种都可以，看是否要和账号页左上角「返回项目」统一成返回类。
