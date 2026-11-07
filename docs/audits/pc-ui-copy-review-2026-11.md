# PC 站界面文案优化记录（2026-11）

> 范围：`apps/web-aiavatar` 桌面形态，涵盖首页（新版和旧版）、AI 视频、AI 图片、画布、导演台、项目、资产、发行，以及我的、企业、邀请、登录，另加用户能看到的服务端报错和 `scenes.json`。旧手机页 `src/proto/` 和 `src/canvas/locales/zh-CN.ts` 只改扫描命中。
> 规则依据 `.claude/skills/ui-copy/` 和 AGENTS.md §8「UI 文案」。第 1 批已合入 main；其余批次在分支 `dev/pc-ui-copy-full`。
> 这份记录原来是审阅稿，用户定下 12 件事后按最新代码重新扫描并改完，现在记的是实际改动。原始审阅表在 git 历史里（提交 `0088b0c2d`）。没改的存量问题在 `TODO.md`「时间显示与文案统一」。

## 0.1 数量

| 批次 | 改动表行数 |
|---|---|
| 第 1 批 · 外壳、首页新旧两版、全站报错弹窗、品牌标语 | 约 50 |
| 第 2 批 · 项目、/create、灵感 / 模板 | 141 |
| 第 3 批 · AI 视频、AI 图片 | 138 |
| 第 4A 批 · 画布工作台 | 365 |
| 第 4B 批 · 创作助手 | 199 |
| 第 5 批 · 短剧导演台 | 379 |
| 第 6 批 · 资产、发行、名片、授权 | 283 |
| 第 7 批 · 我的、企业、邀请、登录 | 136 |
| 第 7S 批 · 服务端报错与场景目录 | 365 |
| 第 8 批 · 旧手机页与画布语言包（只改扫描命中） | 48 |

一行可能合并了同一文件里相同的几处。

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

## 0.3 全站统一的叫法

| 现在的几种说法 | 统一为 |
|---|---|
| 正在读取 X… / 暂时读不到 / 没读出来 / 重新读取 | 正在加载 X… / X 加载失败，请稍后刷新重试。/ 重试 |
| 可以再点一次 / 复制后发给我们 | 请重试。多次失败时，可复制「错误详情」反馈给我们。 |
| 回到 X / 回 X / 回资产货架 | 返回 X / 返回资产 |
| 在画布上看 / 去画布看 / 在画布中查看 | 在画布上查看 |
| 新建创作 / 开始创作（新建画布那个按钮） | 新建画布 |
| 另存一份 / · 另一份 | 另存为新画布 / · 副本 |
| 生成时的描述 / 生成指令 / 本次生成提示词 | 提示词 |
| 可选 / 有就写 / 不写也行 | 选填 |
| 在途 | 进行中 |
| 个人钱包 | 个人积分 |
| 数字资产 / 数字资产产品 / 数字资产平台 / 数字人资产平台（开通的产品名） | IP Studio（授权凭证和授权范围不动） |
| 出图 / 出片 / 拍（按钮和状态里） | 生成图片 / 生成视频（「成片」作名词保留） |

## 0.4 用户定下的 12 件事（2026-11-06）

| # | 问题 | 定的做法 | 结果 |
|---|---|---|---|
| 1 | 公开名片显示写死的演示内容 | 只留给演示名片 | `card-view.tsx` 在 `card.demo` 时才显示 |
| 2 | 冻结上限当价格显示 | 写「按实际用量结算」；配音按钮写每秒单价 | 导演台助手、技能草稿、付款弹窗文字任务、配音按钮都已改 |
| 3 | 「视频任务没建齐」会重复扣费 | 核实后是误报：同一事务回滚，不会重复扣 | 只改文字：「视频任务创建失败，请重试。」 |
| 4 | 余额不足提示被正则读取 | 这句写得没问题，不改 | `CreditService` 原句保留 |
| 5 | 「确认后才扣积分」 | 按钮已不在，只剩旧草稿提示 | 改掉口语 |
| 6 | 删除片段没提视频 | 改文字，并拦住生成中 | 确认框写清；`clip.delete` 生成中 409 `DIRECTOR_TASK_RUNNING`，有用例 |
| 7 | 灰按钮原因只在悬停里 | 写到按钮旁 | 各页已加；没做的列在 TODO |
| 8 | 技能胶囊说明过时 | 改成实际行为 | 已改 |
| 9 | 产品名四种叫法 | 统一 IP Studio | 前后端、admin 类型已改；凭证和授权范围不动 |
| 10 | 时间格式 | 统一 `formatDateTime()` | 企业、邀请、对话分享、任务列表、模型结果页已改 |
| 11 | AGENTS.md 声音限制过时 | 改 AGENTS.md | 已改 |
| 12 | H3「少量积分」 | 统一「优化提示词按实际用量另计」 | 已改 |

另外三个范围决定：首页四个示例按钮不改；`src/proto/` 和语言包只改扫描命中；面向用户的报错不写运维指引，指引进 `internalDetail`（AGENTS.md §8.0 已同步）。

## 0.5 UI 走查（2026-11-06，本地，1440 和 1280 宽）

用浏览器逐页看过：首页新旧两版、AI 视频、AI 图片、项目、/create、灵感、资产（素材和我的 IP）、资产详情、发行、短剧导演台（作品列表、剧本、资产、分镜、删除确认框、作品不存在）、画布（空画布引导、添加菜单、顶栏更多、节点、生成视频面板、配音面板、故事板、成片编辑器、创作助手开场和制作完成的对话）、企业（全部 8 个标签）、我的账号、邀请朋友、朋友邀请页、企业邀请页、积分页、公开名片（演示）、名片列表、授权中心、发现、生成原文。没有横向溢出；被省略的只有用户自己的长正文。

走查发现并修掉的：
- 朋友邀请页的新标语在 1440 宽断成「无限可 / 能。」，改成固定两行。这个问题第 1 批已经在 main 上。
- 助手头部「已是新对话」在每个新对话都常驻，读着多余，去掉；回复或制作中的「暂不可切换」保留。
- 视频面板「视频时长需为 4 到 4 秒」，首尾相同时改写「视频时长需为 4 秒」。
- 官方模板里的「怎么用」说明还是口语（不在扫描范围内），改成书面语。

没有走到的（只有单元测试）：付款弹窗、错误弹窗的实际弹出、AI 编导对话、一键制作弹窗、冲突弹窗、真实名片（库里没有真实名片，隐藏写死内容只有测试）、导演台生成中删除片段被拦（服务端有用例）。走查不点生成类按钮，没有产生模型费用。旧手机页 `src/proto/` 没有走查。

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

# 第 2 批 · 项目、/create、灵感 / 模板

位置相对 `apps/web-aiavatar/src/`，`packages/` 开头的相对仓库根。原文、改为保留了所在的代码片段，便于定位。

| 位置 | 原文 | 改为 |
|---|---|---|
| `ip/studio-projects.tsx` | "在 AI 视频中打开" : "在 AI 图片中打开" | "在 AI 视频中编辑" : "在 AI 图片中编辑" |
| `ip/studio-projects.tsx` | description="管理画布，接续每一次创作。" | description="管理画布，继续未完成的创作。" |
| `ip/studio-projects.tsx` | }新建创作</>)} | }新建画布</>)} |
| `ip/studio-projects.tsx` | · 新画布没有创建成功，可以再点一次「新建创作」。 | · 新画布没有创建成功，请重试。 |
| `ip/studio-projects.tsx` | '正在读取画布…' | '正在加载画布…' |
| `ip/studio-projects.tsx` | '暂时无法读取画布' | '画布加载失败' |
| `ip/studio-projects.tsx` | "从第一张画布开始" | "还没有画布" |
| `ip/studio-projects.tsx` | "换个关键词，或清除当前筛选。" | "请更换关键词，或清除筛选。" |
| `ip/studio-projects.tsx` | "开始一次创作，画布会保存在这里。" | "新建的画布会保存在这里。" |
| `ip/studio-projects.tsx` | <>开始创作 {newCanvas.creating | <>新建画布 {newCanvas.creating |
| `ip/studio-projects.tsx` | "正在读取内容…" | "正在加载内容…" |
| `ip/studio-projects.tsx` | title="删除画布" footer={null} | title="删除这张画布？" footer={null} |
| `ip/studio-projects.tsx` | 确认删除「{pendingDelete?.name}」？画布内的节点和连线将一并删除，此操作无法撤销。 | 「{pendingDelete?.name}」中的节点和连线将一并删除，删除后无法恢复。 |
| `ip/studio-projects.tsx` | deleting ? "正在删除…" : "确认删除" | deleting ? "正在删除…" : "删除" |
| `ip/project-card-preview.tsx` | 正在读取内容… | 正在加载内容… |
| `ip/project-history.tsx` | "图片已放回画布，但尚未保存，请先重试保存" | "图片已添加到画布，但尚未保存，请重试保存。" |
| `ip/project-history.tsx` | "图片和指令已恢复到画布" | "图片和提示词已恢复到画布" |
| `ip/project-history.tsx` | "当前画布会先保存，可在历史记录里找回。" | "恢复前将保存当前画布，之后可在历史记录中找回。" |
| `ip/project-history.tsx` | "当前画布尚未保存，请先处理保存问题" | "当前画布尚未保存，请保存后重试。" |
| `ip/project-history.tsx` | "已保存到资产，可在顶部「资产」页查看" | "已保存到资产，可在「资产」页查看。" |
| `ip/project-history.tsx` | run.inputs.userPrompt ? "生成指令" : "完整生成提示词" | run.inputs.userPrompt ? "提示词" : "完整提示词" |
| `ip/project-history.tsx` | 保留最近 50 个内容版本。版本记录从此次更新开始，之前的成图和指令可在「生成记录」找回。 | 保留最近 50 个画布版本。更早的生成图片和提示词可在「生成记录」中找回。 |
| `ip/canvas-cover-editor.tsx` | 上传一张封面，或从画布中选择图片。恢复自动后，优先显示已有图片，没有图片则显示画布缩略图。 | 上传封面，或从画布中选择图片。恢复自动封面后，优先显示画布中的图片；没有图片时显示画布里的文字内容。 |
| `ip/canvas-cover-editor.tsx` | 正在读取画布图片… | 正在加载画布图片… |
| `ip/canvas-cover-editor.tsx` | >重试读取</button> | >重试</button> |
| `ip/canvas-cover-editor.tsx` | '选择图片即可保存' | '选择图片后自动保存' |
| `ip/studio-create-home.tsx` | const DESCRIPTION = "自由连接想法与素材，把灵感变成作品。"; | const DESCRIPTION = "自由组合文字、图片、视频和音频。"; |
| `ip/studio-create-home.tsx` | · 新画布没有创建成功，可以再点一次「新建画布」。 | · 新画布没有创建成功，请重试。 |
| `ip/studio-create-home.tsx` | 官方模板正在准备中。你可以先新建一张画布。 | 暂无官方模板。 |
| `ip/studio-create-tools.ts` | '从描述或首帧，展开动态画面。' | '由文字描述或首帧生成视频。' |
| `ip/studio-create-tools.ts` | '拆解镜头与风格，寻找创作方法。' | '拆解镜头与风格，生成解析文档。' |
| `ip/studio-create-tools.ts` | '选好声音，让台词有情绪。' | '选择人物声音，为台词配音。' |
| `ip/studio-create-tools.ts` | '让人物随配音自然开口。' | '用配音驱动人物口型。' |
| `ip/studio-entry.ts` | description: '真人照片变成数字人形象，出多角度设定图' | description: '由真人照片生成数字人形象和多角度设定图' |
| `ip/studio-entry.ts` | description: '跟助手聊镜头语言、节奏与分镜方案' | description: '与助手讨论镜头语言、节奏与分镜方案' |
| `ip/studio-template-market.tsx` | isCases ? "案例正在准备中" : "暂无官方模板" | isCases ? "暂无案例" : "暂无官方模板" |
| `ip/studio-template-market.tsx` | "换个关键词再搜。" | "请更换关键词后重试。" |
| `ip/studio-template-market.tsx` | "在个人画布中选择“发布为模板”，以后就可以从同一流程开始创作。" | "在画布右上角「⋯」中选择「保存为模板」，之后可从同一流程开始创作。" |
| `ip/inspiration-wall.tsx` | 已经到底了 | 已显示全部 |
| `ip/template-facts.ts` | '此节点等待填写内容或添加参考素材。' | '此节点尚未填写内容或添加参考素材。' |
| `ip/studio-template-library.tsx` | 打开查看完整画布和成品素材。需要继续创作时，点「做同款」。 | 打开后可查看完整画布和成品素材。点击「做同款」可复制到自己的画布。 |
| `ip/studio-template-library.tsx` | aria-label="正在读取模板" | aria-label="正在加载模板" |
| `ip/studio-template-library.tsx` | '还没有个人模板，可以在画布顶部保存。' | '还没有个人模板。可在画布右上角「⋯」中选择「保存为模板」。' |
| `ip/studio-template-library.tsx` | '当前没有可用的官方模板。' | '暂无官方模板。' |
| `ip/studio-template-use.tsx` | 正在读取内容… | 正在加载内容… |
| `ip/studio-template-use.tsx` | '不用准备素材，可以直接生成。' | '无需准备素材，可直接生成。' |
| `ip/studio-template-use.tsx` | 新建一张你的画布{templatePrompt(doc) ? '，提示词已填好' : ''}。不扣积分，生成前会显示所需积分。 | 将新建一张画布{templatePrompt(doc) ? '，并填好提示词' : ''}。此操作不消耗积分，生成前将显示所需积分。 |
| `ip/studio-template-publish.tsx` | setDone(`已保存完整画布：${version.doc.nodes.length} 个节点。${visibility==='official'?'所有用户':'你'}可以从画布模板中查看。`) | setDone(`已保存为模板（${version.doc.nodes.length} 个节点）。${visibility==='official'?'所有用户':'你'}可在「模板」中查看。`) |
| `ip/studio-template-publish.tsx` | title="保存画布模板" | title="保存为模板" |
| `ip/studio-template-publish.tsx` | >保存完整画布 | >保存模板 |
| `ip/studio-template-publish.tsx` | 保留全部节点、文字、连线和已生成的图片、视频。别人打开后就能看到这张画布。 | 将保留全部节点、文字、连线及已生成的图片和视频。 |
| `ip/studio-template-publish.tsx` | 谁可以看到<Select | 可见范围<Select |
| `ip/studio-template-source.tsx` | ready:'可以生成' | ready:'待生成' |
| `ip/studio-template-source.tsx` | running:'正在生成',failed:'生成失败' | running:'生成中',failed:'失败' |
| `ip/studio-template-source.tsx` | stale:'来源已改变' | stale:'来源已变更' |
| `ip/studio-template-source.tsx` | '当前模型或价格不可用，请检查平台配置' | '当前模型或价格不可用，请稍后重试或联系平台处理。' |
| `ip/studio-template-source.tsx` | '请先完成前序步骤或采用主形象' | '请完成前序步骤或采用主形象后重试。' |
| `ip/studio-template-source.tsx` | 画布锁定此版本。按步骤生成，每次确认费用；需要采用确认的上游结果未采用前，下游不会执行。刷新会找回原任务。 | 此画布已锁定该模板版本。按步骤生成，每步单独确认费用；上游结果采用前，依赖它的步骤不会执行。刷新可找回已提交的任务。 |
| `ip/studio-template-source.tsx` | 我套用这个版本：{metrics.instances} 个画布，{metrics.completedInstances} 个已完成；已消费 {metrics.spentCredits} 积分，冻结 {metrics.pendingCredits}；采用 {metrics.acceptedSteps} 个结果，首轮采用 {metrics.firstPassAcceptedSteps} 个，失败任务 {metrics.failedRuns} 个。 | 已使用此版本：{metrics.instances} 张画布，{metrics.completedInstances} 张已完成；已消费 {metrics.spentCredits} 积分，冻结 {metrics.pendingCredits} 积分；采用 {metrics.acceptedSteps} 个结果，其中首次即采用 {metrics.firstPassAcceptedSteps} 个；失败任务 {metrics.failedRuns} 个。 |
| `ip/studio-template-source.tsx` | 这是一张人物设定图，可整张作为角色参考。拍摄新画面时指定所需视角；图生视频先生成单独的镜头画面。 | 这是一张人物设定图，可整张作为角色参考。生成新画面时请指定视角；图生视频前，请生成单独的镜头画面。 |
| `ip/studio-template-source.tsx` | 原产物保留；只重做此步骤，不会自动重跑其他步骤。 | 原结果将保留。重新生成只针对此步骤，不会自动重新生成其他步骤。 |
| `ip/studio-template-source.tsx` | {s.run?'只重做此步骤':'生成此步骤'} | {s.run?'重新生成':isVideo(s)?'生成视频':'生成图片'} |
| `ip/studio-template-source.tsx` | s.accepted?'撤回采用确认': | s.accepted?'取消采用': |
| `ip/studio-template-source.tsx` | p.complete?'完整输出':'部分输出' | p.complete?'完整资产包':'部分资产包' |
| `ip/studio-template-source.tsx` | 使用已采用的图片。中文由排版服务绘制；保留每张原图及来源清单。未包含全部输出时明确标为部分资产包。 | 使用已采用的图片排版，并附每张原图及来源清单。未包含全部图片时，将标注为部分资产包。 |
| `ip/studio-template-source.tsx` | aria-label="资产包输出" | aria-label="资产包图片" |
| `ip/studio-template-source.tsx` | pending?.step.run?'确认只重做此步骤':'确认生成' | pending?.step.run?'确认重新生成':'确认生成' |
| `ip/studio-template-source.tsx` | 确认 {pending?.cost} 积分并提交 | 确认生成 · {pending?.cost} 积分 |
| `ip/studio-template-source.tsx` | '保留原产物；依赖它的结果会显示来源已改变。' | '原结果将保留；依赖它的步骤将显示「来源已变更」。' |
| `ip/studio-template-source.tsx` | '已提交的指令保持不变，再次点击会恢复原请求。' | '已提交的提示词不可修改，再次点击将恢复原请求。' |
| `ip/studio-template-source.tsx` | '可调整本次创作指令，模板原版本不变。引用仍按配方锁定。' | '可修改本次提示词，不影响模板。参考素材按模板设定锁定。' |
| `ip/studio-template-source.tsx` | "本次视频指令":"本次图片指令" | "本次视频提示词":"本次图片提示词" |
| `ip/studio-template-source.tsx` | '可新建 IP 或明确更新所选人物主形象。' | '可新建 IP，或更新所选人物的主形象。' |
| `app/projects/demos/page.tsx` | "没加载出来，刷新页面再试" | "官方内容加载失败，请稍后刷新重试。" |
| `app/projects/demos/page.tsx` | `「${row.name}」已下线，用户看不到了` | `「${row.name}」已下线` |
| `app/projects/demos/page.tsx` | action: `${row.enabled ? "下线" : "上线"}「${row.name}」`, fallback: "没成功，再试一次" } | action: `${row.enabled ? "下线" : "上线"}「${row.name}」` } |
| `app/projects/demos/page.tsx` | action: `保存「${editing.name}」的修改`, fallback: "没存上，再试一次" } | action: `保存「${editing.name}」的修改` } |
| `app/projects/demos/page.tsx` | `「${pendingDelete.name}」已删除，但有 ${res.assetsFailed} 个素材没清掉，要运维去存储里手动删` | `「${pendingDelete.name}」已删除，${res.assetsFailed} 个素材未能清理，需运维在存储中手动删除。` |
| `app/projects/demos/page.tsx` | action: `删除「${pendingDelete.name}」`, fallback: "没删掉，再试一次" } | action: `删除「${pendingDelete.name}」` } |
| `app/projects/demos/page.tsx` | 这一页只有平台运营能看。 | 此页面仅平台运营可访问。 |
| `app/projects/demos/page.tsx` | href="/projects">回到项目 | href="/projects">返回项目 |
| `app/projects/demos/page.tsx` | 下线后用户将看不到这条内容，随时可以重新上线。删除会清理素材副本，无法恢复；已复制到用户画布的内容不受影响。 | 下线后用户将看不到此内容，可随时重新上线。删除将清理素材副本，且无法恢复；已复制到用户画布的内容不受影响。 |
| `app/projects/demos/page.tsx` | 还没发过官方内容。在画布顶栏选择「存为官方内容」，发布后就会出现在这里。 | 还没有官方内容。在画布右上角「⋯」中选择「保存为官方内容」，发布后将显示在这里。 |
| `app/projects/demos/page.tsx` | hint="用于新建创作，只复制节点和提示词，不包含素材。" | hint="用于新建画布，用户使用时将复制到自己的画布。" |
| `app/projects/demos/page.tsx` | hint="包含素材成图，用户使用时会复制到自己的画布。" | hint="包含素材和成品，用户使用时将复制到自己的画布。" |
| `app/projects/demos/page.tsx` | <Field label="名字"> | <Field label="名称"> |
| `app/projects/demos/page.tsx` | placeholder="别人看到的名字" | placeholder="用户看到的名称" |
| `app/projects/demos/page.tsx` | placeholder="选填。写清楚这套工作流能做出什么" | placeholder="选填，例如：一张照片生成多角度人物设定图" |
| `app/projects/demos/page.tsx` | hint="数字小的排前面，一样大的按发布时间" | hint="数字越小越靠前，相同时按发布时间排序" |
| `app/projects/demos/page.tsx` | title={`删除「${pendingDelete?.name ?? ""}」`} | title={`删除「${pendingDelete?.name ?? ""}」？`} |
| `app/projects/demos/page.tsx` | 这条内容和它那份素材副本（{pendingDelete?.assetCount ?? 0} 个）会一起删掉，不可恢复。 / 已经拿它建过画布的用户不受影响 —— 那些是各自复制的一份。 / 只是想让别人看不到的话，下线就够了，随时能再打开。 | 此内容及其 {pendingDelete?.assetCount ?? 0} 个素材副本将一并删除，无法恢复。 / 已用它创建的用户画布不受影响。 / 如只需对用户隐藏，可选择下线，之后可随时重新上线。 |
| `app/projects/demos/page.tsx` | "（没写说明）" | "暂无说明" |
| `app/projects/demos/page.tsx` | label="删除（连素材，不可恢复）" | label="删除" |
| `app/market/[id]/page.tsx` | list.error ? `加载失败：${list.error}` : "没有找到这个官方资产" | list.error ? `官方资产加载失败：${list.error}` : "未找到该官方资产。" |
| `app/market/[id]/page.tsx` | actionLabel="回资产货架" | actionLabel="返回资产" |
| `app/market/[id]/page.tsx` | >适合用来做什么 | >适用场景 |
| `app/market/[id]/page.tsx` | <Badge tone="warn">建设中</Badge> | <Badge tone="warn">暂未开放</Badge> |
| `app/market/[id]/page.tsx` | 授权档位与在线付费正在建设。需要用这个角色出片，先联系客户经理线下开通。 | 在线授权与付费暂未开放。如需使用此角色生成视频，请联系客户经理开通。 |
| `app/market/[id]/page.tsx` | 授权功能还在建设中，暂时无法在线下单。可以先联系客户经理开通。 | 在线授权暂未开放，请联系客户经理开通。 |
| `app/market/[id]/page.tsx` | 明星形象的授权申请与审批在「明星工作台」完成，不在这里下单。 | 明星形象的授权申请与审批在 AI 明星带货与「明星工作台」中完成。 |
| `app/stars/[id]/page.tsx` | 授权范围 / 有效期 / 去带货创作。 | 授权范围 / 有效期 / 前往 AI 明星带货。 |
| `app/stars/[id]/page.tsx` | grants.error \|\| "没有找到这条明星授权" | grants.error \|\| "未找到该明星授权。" |
| `app/stars/[id]/page.tsx` | actionLabel="回资产货架" | actionLabel="返回资产" |
| `app/stars/[id]/page.tsx` | 去带货创作（AI 明星带货） | 前往 AI 明星带货 |
| `app/stars/[id]/page.tsx` | "申请已提交，等待明星团队在明星工作台审批。通过后这里会显示可用场景与有效期。" | "申请已提交，等待明星团队审批。审批通过后将显示可用场景与有效期。" |
| `app/stars/[id]/page.tsx` | "授权已到期。要继续使用，请到 AI 明星带货里重新发起授权申请。" | "授权已到期。如需继续使用，请在 AI 明星带货重新申请授权。" |
| `app/stars/[id]/page.tsx` | 明星授权的申请与审批在带货线和「明星工作台」完成，这里只展示结果。 / 用它生成的视频记录，将随带货出片链路上线后在这里汇总。 | 明星授权的申请与审批在 AI 明星带货与「明星工作台」中完成，此处仅展示结果。 |
| `components/hub/discover.tsx` | hint="授权后可用于出片" | hint="授权后可用于生成视频" |
| `components/hub/discover.tsx` | label="官方资产加载中" | label="正在加载官方资产…" |
| `components/hub/discover.tsx` | text="暂时还没有上架的官方角色" | text="暂无上架的官方角色。" |
| `components/hub/discover.tsx` | hint="授权与审批在明星端办理" | hint="在 AI 明星带货中申请" |
| `components/hub/discover.tsx` | >去申请明星形象授权 | >申请明星形象授权 |
| `components/hub/discover.tsx` | 明星本人与团队在带货端审批，通过后形象会出现在你的资产里 | 由明星本人及团队审批，通过后形象将显示在你的资产中。 |
| `components/hub/home.tsx` | <LinkAction href="/discover">去发现 ›</LinkAction> | <LinkAction href="/discover">查看全部 ›</LinkAction> |
| `components/hub/studio-home.tsx` | aria-label="AI IP Studio 创作首页" | aria-label="IP Studio 创作首页" |
| `components/hub/studio-home.tsx` | <h1>AI IP Studio</h1> | <h1>IP Studio</h1> |
| `components/hub/studio-home.tsx` | 还没有画布。从上方开始创作，或先选择一套模板。 | 还没有画布。可在上方开始创作，或选择模板。 |
| `components/hub/studio-home.tsx` | <Plus size={16}/>}新建空白画布</button> | <Plus size={16}/>}新建画布</button> |
| `components/hub/studio-home.tsx` | 点开预览 · 做同款后编辑 <ArrowRight | 点击预览 · 做同款后可编辑 <ArrowRight |
| `components/hub/studio-home.tsx` | '还没有个人模板。在画布里选择“发布为模板”，以后可以换一个 IP 继续使用。' | '还没有个人模板。可在画布右上角「⋯」中选择「保存为模板」。' |
| `components/hub/studio-home.tsx` | '精选画布发布后会展示在这里，你可以复制一份继续创作。' | '暂无精选画布。' |
| `components/hub/studio-home.tsx` | '暂时没有可用的官方模板，可以从空白画布开始。' | '暂无官方模板。' |
| `components/landing/ip-home-classic.tsx` | onClick={startBlank}>创建空白画布{newCanvas.creating | onClick={startBlank}>新建画布{newCanvas.creating |
| `packages/api-client/src/model-results.tsx` | e.message:"读取失败，请重试");}).finally(()=>{if(live)setLoading(false);}); | e.message:"加载失败，请重试。");}).finally(()=>{if(live)setLoading(false);}); |
| `packages/api-client/src/model-results.tsx` | e.message:"读取失败，请重试");}).finally(()=>{if(live)setDetailLoading(false);}); | e.message:"加载失败，请重试。");}).finally(()=>{if(live)setDetailLoading(false);}); |
| `packages/api-client/src/model-results.tsx` | setError("复制失败，可在下方选中文字复制") | setError("复制失败，请在下方选中文字后复制。") |
| `packages/api-client/src/model-results.tsx` | 正在读取… | 正在加载… |
| `packages/api-client/src/model-results.tsx` | 暂无记录。此功能上线后的文字回复会在这里保留。 | 暂无记录。此功能上线后的文字回复将保留在这里。 |
| `packages/api-client/src/model-results.tsx` | {new Date(row.createdAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"})} | {formatDateTime(row.createdAt)} |
| `packages/api-client/src/model-results.tsx` | 模型因输出额度停止，以下是已返回的内容，可能未写完。 | 模型已达到输出上限，以下是已返回的内容，可能不完整。 |
| `packages/api-client/src/model-results.tsx` | 正在读取全文… | 正在加载全文… |
| `packages/api-client/src/model-results.tsx` | 暂时无法读取，请点击刷新重试。 | 全文加载失败，请点击「刷新」重试。 |

#### 同步的测试
| 测试 | 改动 |
|---|---|
| `ip/studio-create-home.test.tsx` | 按钮名跟新叫法（新建画布、删除、在 AI 视频 / 图片中编辑）。空态按钮和右上角同名，改成等 `还没有画布` 标题出现后点最后一个 |
| `components/hub/studio-home.test.tsx` | 「新建空白画布」→「新建画布」 |
| `ip/studio-template-publish.test.tsx` | 按钮「保存模板」、下拉「可见范围」、成功提示「已保存为模板（N 个节点）」 |
| `ip/demo-admin-wiring.test.ts` | 源码断言改「保存模板」 |
| `ip/demo-admin.test.tsx` | 「名称」「删除」；整句断言改结构：无权限页断言有「返回项目」链接，删除弹窗断言弹窗内有「删除」按钮；空态用 `/还没有官方内容/` |
| `ip/studio-template-source.test.tsx` | `main · 待生成`、`生成图片 · 8 积分`、`确认生成 · N 积分`、`本次图片提示词` |
| `ip/studio-template-use.test.tsx` | `无需准备素材` |
| `ip/model-results.test.tsx` | `/可能不完整/` |

## 存疑项选了哪种写法

- 项目卡片回场景草稿：选「在 AI 视频中编辑 / 在 AI 图片中编辑」（统一表）。main 上已改成「在 AI 视频中打开」，仍按统一表改了。
- 项目页删除确认按钮：选「删除」。
- 制作计划里的冻结：选「冻结 {n} 积分」，和钱包、企业页用词一致。

偏离旧表或补充判断的：
- 发现页说明：旧表写「由明星本人及团队在 AI 明星带货审批」，但审批实际在明星工作台，发起才在 AI 明星带货。改成标题旁「在 AI 明星带货中申请」+ 说明「由明星本人及团队审批，通过后形象将显示在你的资产中。」
- 官方内容管理「工作流模板」说明：旧文案说「只复制节点和提示词，不包含素材」，而现在模板是整张快照（`StudioTemplateService` 的 `snapshotForTemplate`），老配方式模板才不含素材。改成对两种都成立的「用于新建画布，用户使用时将复制到自己的画布。」
- 官方资产页徽标：「建设中」→「暂未开放」，和同卡片说明同一个说法。
- 制作计划按钮：旧表写「生成 · N 积分」，改成带对象的「生成图片 / 生成视频 · N 积分」，再次生成写「重新生成 · N 积分」。
- 模型结果页在 `packages/api-client/src/model-results.tsx`（只有 web-aiavatar 用），不在 `scan2` 清单里，按任务范围一起改了。
- 手机端入口描述（`ip/studio-entry.ts` 的 `ip`、`director`）和 `components/hub/home.tsx`「去发现 ›」→「查看全部 ›」也一起改了，旧表只列备查。

---

# 第 3 批 · AI 视频、AI 图片

#### AI 视频输入区（`ip/scenes/scene-video-studio.tsx`）
| 位置 | 原文 | 改为 |
|---|---|---|
| 模型加载失败 action | 读取视频模型 | 加载视频模型 |
| 换场景提示 | {素材}在「{新场景}」用不上，先收起来了，回「{原场景}」还在 | 此场景不使用{素材}，返回「{原场景}」时会恢复。 |
| ensureDraft 报错 | 场景还没读出来，请稍等 | 场景尚未加载完成，请稍后重试。 |
| 资产选择报错 | 请选一张图片 / 请选一段视频 / 请选一段声音 | 请选择一张图片 / 请选择一段视频 / 请选择一段声音 |
| 添加素材 action | 放素材 | 添加素材 |
| 带图报错 | 这张图读不出来了，回 AI 图片重新点一次「做成视频」 | 图片加载失败，请返回 AI 图片重新点击「做成视频」。 |
| 带图说明 | 图带过来了，放在「X」。说说想拍成什么样，编导会照着写。 | 图片已添加到「X」。描述想要的视频后，可交给 AI 编导撰写脚本。 |
| 卡点（编导 / 复刻 / 短视频 / 长视频） | 正在读取场景… / 正在读取模型… / 正在读取视频模型… / 还没有可用的视频模型 | 正在加载场景… / 正在加载模型… / 正在加载视频模型… / 暂无可用的视频模型 |
| 同上 | 先放{X} | 请添加{X} |
| 同上 | 先写一句要求 / 先写一句要求，或放素材 | 请填写要求 / 请填写要求，或添加素材 |
| 同上 | 说说想改哪里 | 请填写修改意见 |
| 同上 | AI 编导暂时用不了（文字模型没配置价格） | AI 编导暂时不可用，请联系平台处理。 |
| 同上 | 先写提示词，或点「AI 编导」写一版脚本 | 请填写提示词，或点击「AI 编导」生成脚本 |
| 同上（两处） | 还有没填的：X。在上面换成实际内容，用不上的直接删掉。 | 脚本中还有待补充的内容：X。请替换为实际内容，不需要的请删除。 |
| 素材与模型 | 素材和模型对不上 | 素材与当前模型不匹配 |
| 费用报错 | 价格没读出来，请再试一次 / 费用暂时没读出来 | 价格加载失败，请稍后刷新重试。 / 费用加载失败，请稍后刷新重试。 |
| 复制报错 | 浏览器不让复制，请手动选中文字复制 | 浏览器不允许复制，请手动选中文字复制。 |
| 目录失败 / 加载中 | 场景目录没读出来 / 正在读取场景 | 场景加载失败。 / 正在加载场景… |
| 时长说明 | 这个模型单段最长 X 秒，Y 秒分 N 段（…）。脚本、分镜图、各段视频和合成一次做完。 | 当前模型单段最长 X 秒，Y 秒将分 N 段（…）。脚本、分镜图、各段视频和合成将一次完成。 |
| 时长说明 | 这个模型只做 N 秒的片子 / 这个模型最短 X 秒，会按 N 秒出 | 当前模型仅支持 N 秒 / 当前模型最短 X 秒，将按 N 秒生成 |
| 素材位 aria / title | 从资产库选{X} | 从资产库选择{X} |
| 素材位小字 | 可选 / 再加一张 | 选填 / 添加图片 |
| 编辑框占位 | 贴上写好的提示词直接生成；只有想法的话，写几句让 AI 编导帮你写成脚本 | 粘贴写好的提示词直接生成；只有想法时，可写几句交给 AI 编导撰写脚本 |
| 信息小标签 | 有就写 | 选填 |
| AI 编导按钮 title | 回到 AI 编导接着改 / 让 AI 编导写一版分镜脚本 | 返回 AI 编导继续修改 / 由 AI 编导撰写分镜脚本 |
| 长视频价格说明 | 写脚本和审核按实际用量结算 | 开优化时：写脚本、审核和优化提示词按实际用量结算；不开时不变 |
| 脚本与设置不一致（只改显示，提交给服务端的 `settingsChanged` 原样） | 这版脚本是照 X 秒写的，现在要出 Y 秒 | 此脚本按 X 秒撰写，当前为 Y 秒 |
| 同上 | 脚本是照竖屏写的，现在是横屏 | 此脚本按竖屏撰写，当前为横屏 |
| 同上 | 台词是照中文写的，现在选的是英文 | 台词按中文撰写，当前选择英文 |
| 同上 | 脚本里用了参考图，这个模型不看图 | 此脚本引用了参考图，当前模型不使用参考图 |
| 同上 | 脚本里用了 N 张参考图，这次只用得上 M 张 | 此脚本引用了 N 张参考图，本次使用 M 张 |
| 同上按钮 | 让编导照现在的改一版 | 按当前设置修改脚本 |
| 重新编辑提示 | 当时用的模型现在用不了，这次用「X」。 | 原模型已不可用，本次改用「X」。 |
| 重新编辑提示 | 这条的脚本和设置放回来了，素材用的是现在放着的。 | 已恢复此视频的脚本和设置，素材使用当前已添加的内容。 |
| 采用脚本提示 | 脚本放进编辑框了，原来写的那段换掉了 | 脚本已放入编辑框，替换了原有内容。 |
| 提交报错 | 这一版没发出去，请再点一次 | 提交失败，请重试。 |
| 提交未确认 errorDetails | 提交结果没有确认，点「确认原任务」查一下，不会重复扣费 | 提交结果待确认。点击「确认原任务」查询，不会重复扣费。 |
| 报错下一步（两处） | 这次可能已经被受理，点「确认原任务」查一下，不要直接重写 / 重新生成。 | 本次提交可能已成功。请点击「确认原任务」查询，不要直接重新生成。 |
| 重试报错 | 这一条已经不在了 | 此记录已不存在。 |
| 报错 action | 停止 / 让编导写脚本 / 改一版 | 停止生成 / 生成脚本 / 重新编辑 |

#### AI 视频 · AI 编导
| 位置 | 原文 | 改为 |
|---|---|---|
| 返回按钮（两处） | 回到编辑 | 返回编辑 |
| 改稿输入框 aria-label（`openDirector` 的选择器同步） | 想改哪里 | 修改意见 |
| 改稿输入框占位 | 设置改过了，直接发送就照现在的改一版 / 想改哪里，直接说 | 设置已修改，直接发送将按当前设置修改脚本 / 例如：开头更抓人，台词更口语 |
| 发送键 aria-label | 让编导改 / 让编导写 | 发送修改意见 / 生成脚本 |
| 发送键 title | 照现在的设置改一版 / 发送（Enter），按实际用量扣积分 | 按当前设置修改 / 发送（Enter），按实际用量结算 |
| 新增：#7 发送键不能点的原因写在键下方（`directorNote`，灰字 `.scene-hint.is-note`） | 只在 title | 请填写修改意见 / 请添加{X} / AI 编导暂时不可用，请联系平台处理。等 |
| 气泡占位（用户没写字时） | 再改一版 / 看素材写一版脚本 | 修改脚本 / 根据素材生成脚本 |
| 状态 | 正在交给编导 / 提交结果没有确认 / 排队中，前面还有 N 个 / 正在改脚本 / 正在看素材、写脚本 | 提交中 / 结果待确认 / 排队中 · 第 N 位 / 正在修改脚本 / 正在撰写脚本 |
| 悬停 | 记录号 X | 追查号 X |
| 核对提示 | 还缺X。在下面写上发给编导，会补进脚本。Y没有就不用写。 | 还缺X。请在下方输入框补充，AI 编导会写入脚本。Y为选填。 |
| 核对提示 | Y没有就不用写，出片前把脚本里标着的那几处删掉就行。 | Y为选填。如不需要，请在生成视频前删除脚本中标出的内容。 |
| 核对提示 | 编导觉得可能还缺X，写过了就不用管。 | AI 编导提示可能还缺X，如已填写可忽略。 |
| 核对提示 | 你写的 X 脚本里没用上，要加的话跟编导说一声。 | 你填写的 X 未出现在脚本中。如需加入，请告诉 AI 编导。 |
| 核对提示 | ……可能念不完。可以让编导精简台词，或把时长调长一些。 | ……可能念不完。可让 AI 编导精简台词，或延长时长。 |
| 停止按钮（新增 title） | 无 | 停止后，已产生的费用按实际用量结算 |
| 失败后按钮 | 重新写 | 重试 |
| 图标按钮 | 重新回答 | 重新生成 |

#### AI 视频 · 结果、规格面板、旧草稿进度
| 位置 | 原文 | 改为 |
|---|---|---|
| 结果区链接 | 在画布中查看 | 在画布上查看 |
| 空态 | 写好提示词点「生成视频」，做好的视频会出现在这里。 | 填写提示词后点击「生成视频」，生成的视频将显示在这里。 |
| 选择框标题 / 说明 | 选X / 从资产库里选；新文件点「上传到资产库」，传完会自动选中。原文件不会被改动。 | 选择X / 从资产库选择。新文件可点击「上传到资产库」，上传后自动选中，原文件不会被修改。 |
| 视频行状态 | 正在提交 / 提交结果没有确认 / 排队中，前面还有 N 个 / 正在生成，一般要几分钟 | 提交中 / 结果待确认 / 排队中 · 第 N 位 / 生成中，通常需要几分钟 |
| 视频行悬停 | （记录号 X） | （追查号 X） |
| 重新编辑 title | 把这条的脚本和设置放回编辑器，改好再出；这条留着 | 将此视频的脚本和设置恢复到编辑器，修改后重新生成，原视频保留 |
| 规格面板 | 超过单段上限，分 N 段生成后拼成一条：X 秒。 | 超过单段上限，将分 N 段生成后拼接：X 秒。 |
| 规格面板按钮 | 先优化再生成 | 优化后生成 |
| 规格面板说明（#12） | 先按这个模型更认的写法改写一遍，按实际用量另扣少量积分，不含在视频价里。 | 生成前按此模型的写法优化提示词。优化提示词按实际用量另计，不含在视频费用中。 |
| 规格面板说明 | 按你写的原文直接生成，只扣视频价。 | 按原文生成，只收取视频费用。 |
| `HandoffStatus` | 正在读取进度… | 正在加载进度… |
| `HandoffStatus`（#5） | 交给画布里的创作助手了，去那边确认方案和费用后才开始做。 | 已交给画布中的创作助手，确认方案和费用后开始制作。 |
| `HandoffStatus` | 创作助手在做，第 N 步，共 M 步。 | 制作中，第 N 步，共 M 步。 |
| `HandoffStatus` | 创作助手做完了，成片在画布里。 | 制作已完成，结果在画布上。 |
| `HandoffStatus` | 创作助手停下来等你：R。 / 创作助手停下来等你，去画布里看一眼。 | 创作助手已暂停：R。 / 创作助手已暂停，请在画布上查看。 |
| `HandoffStatus` | 这次制作停掉了，做好的部分还在画布里。 | 制作已停止，已完成的部分保留在画布上。 |
| `HandoffStatus` | 没全部做完，做好了 N 步，剩下的去画布里看看。 | 制作未全部完成，已完成 N 步，请在画布上查看。 |
| `HandoffStatus` 链接 | 去画布看 | 在画布上查看 |

#### AI 图片（`ip/scenes/scene-image-studio.tsx`）
| 位置 | 原文 | 改为 |
|---|---|---|
| 换场景提示 | 「X」在这里用不上，先收起来了，回「Y」还在 | 此场景不使用「X」，返回「Y」时会恢复。 |
| 模型失败 action | 读取图片模型 | 加载图片模型 |
| 卡点 | 正在读取场景… / 正在读取模型… / 还没有可用的图片模型 | 正在加载场景… / 正在加载模型… / 暂无可用的图片模型 |
| 卡点 | 先放X / 写一句想要的画面 | 请添加X / 请描述想要的画面 |
| 卡点 | 当前模型最多用 N 张参考图，已放 M 张 / 当前模型不能用参考图，请换一个模型 | 当前模型最多使用 N 张参考图，已添加 M 张 / 当前模型不支持参考图，请更换模型 |
| 卡点 | 最多 N 字 | 超出 N 字上限，请删减 |
| 规格说明 | 这个模型出不了 R，会按 U 出 | 当前模型不支持 R，将按 U 生成。 |
| 规格说明 | 一次出不了 N 张，会出 M 张 | 当前模型不支持一次生成 N 张，将生成 M 张。 |
| 拼话失败 | 描述没准备好，请再点一次 | 描述准备失败，请重试。 |
| 重试报错 | 这一行已经不在了，请重新生成 | 此生成记录已不存在，请重新生成。 |
| 提交未确认 errorDetails | 提交结果没有确认，点「确认原任务」查一下，不会重复扣费 | 提交结果待确认。点击「确认原任务」查询，不会重复扣费。 |
| 报错下一步 | 这次提交可能已经被受理，点「确认原任务」查一下，不要直接重新生成。 | 本次提交可能已成功。请点击「确认原任务」查询，不要直接重新生成。 |
| 重新编辑提示 | 当时用的模型现在用不了，这次用「X」。 / 这次的设置放回来了，改好再生成。 | 原模型已不可用，本次改用「X」。 / 已恢复此次的设置，修改后可重新生成。 |
| 用作参考图提示 | 放进「X」了，换掉了原来那张。 | 已添加到「X」，替换了原图。 |
| 用作参考图按钮（大图、每张图） | 当参考图 | 用作参考图 |
| 目录失败 / 加载中 | 场景目录没读出来 / 正在读取场景 / 正在打开草稿 | 场景加载失败。 / 正在加载场景… / 正在打开草稿… |
| 多图说明 | 「X」最多可放 N 张，H。 | 「X」最多可添加 N 张，H。 |
| 区块 aria-label | 出图设置 | 图片生成设置 |
| 张数 aria-label | 已放 N 张，最多 M 张 | 已添加 N 张，最多 M 张 |
| 素材位 aria-label | 从资产库选X | 从资产库选择X |
| 素材位小字 | 可选 | 选填 |
| 补充要求占位 | 还有要补充的，写在这里 | 补充要求（选填） |
| 描述按钮 | 改完整描述 / 用回场景描述 | 编辑完整描述 / 恢复场景描述 |
| 结果区链接 | 在画布中查看 | 在画布上查看 |
| 自由场景说明 | 放参考图，说说想要的画面。不知道怎么写，可以点上面的场景名换一个场景。 | 添加参考图并描述想要的画面，也可点击场景名选择其他场景。 |
| 空态 | 放好参考图，点「生成图片」，做好的图会出现在这里。 | 点击「生成图片」后，生成的图片将显示在这里。 |
| 选择框标题 / 说明 | 选X / 从资产库里选；新图点「上传到资产库」，传完会自动选中。原文件不会被改动。 | 选择X / 从资产库选择图片。新图片可点击「上传到资产库」，上传后自动选中，原文件不会被修改。 |
| 行状态 | 正在提交 / 提交结果没有确认 / 排队中，前面还有 N 个 | 提交中 / 结果待确认 / 排队中 · 第 N 位 |
| 行悬停 | （记录号 X） | （追查号 X） |

#### 共用（`ip/scenes/*`）
| 位置 | 原文 | 改为 |
|---|---|---|
| `scene-layout.tsx` 场景名 aria / title、弹层 aria | 换场景，当前：X / 换场景 | 切换场景，当前：X / 切换场景 |
| `scene-layout.tsx` 最近 | 没读到最新的草稿 / 最近的草稿没读到 | 最新草稿加载失败 / 草稿加载失败 |
| `scene-layout.tsx` 最近 | 正在读取 / 做过的会出现在这里 | 正在加载草稿… / 暂无草稿。 |
| `scene-layout.tsx` 无模型 | 后台还没有配置可用的X模型，暂时不能生成。请联系管理员在「AI 模型」里开通。 | 暂无可用的X模型，无法生成。请联系平台开通。 |
| `scene-layout.tsx` 失败 | 模型那边请求太多，稍等一分钟再点「重新生成」；没出来的X不扣积分 | 生成服务请求过多，请稍后点击「重新生成」。未生成的X不扣积分。 |
| `scene-layout.tsx` 失败 | 模型那边正在排满，过几分钟再点「重新生成」；没出来的X不扣积分 | 生成服务繁忙，请稍后点击「重新生成」。未生成的X不扣积分。 |
| `scene-layout.tsx` 失败 | 生成失败，没出来的X不扣积分（默认 X=图） | 生成失败，未生成的X不扣积分。（默认 X=图片） |
| `scene-prompt-editor.tsx` 图片标签 | X，点一下看大图 / L：X，看大图 | X，点击查看大图 / L：X，查看大图 |
| `scene-prompt-editor.tsx` @ 菜单 | 先放素材，就能在这里选 | 添加素材后可在此选择 |
| `scene-video-plan.ts` | 这个模型最多用 N 张图、M 段声音，多出来的不会用上 | 当前模型最多使用 N 张图片、M 段声音，超出部分不会使用 |
| `scene-video-plan.ts` | 这个模型只用第一张图做开头画面，声音不会用上 | 当前模型仅使用第一张图片作为首帧，不使用声音 |
| `scene-video-plan.ts` | 这个模型不看参考素材，只按脚本生成 | 当前模型不使用参考素材，仅按脚本生成 |
| `scene-draft-store.ts`（两处） | 草稿还没准备好 | 草稿尚未就绪，请稍后重试。 |
| `scene-drafts.ts` | 请换一个模型或稍后重试。 | 请更换模型或稍后重试。 |
| `scene-segmented-row.tsx` | 提交结果没有确认 / 点「确认原任务」查一下，不会重复开始。 | 结果待确认 / 点击「确认原任务」查询，不会重复开始。 |
| `scene-segmented-row.tsx` | 正在读取进度 / 读取中 | 正在加载进度… / 加载中 |
| `scene-segmented-row.tsx` | 正在制作，可以离开这个页面，做好后回来看。 | 可离开此页面，制作将在后台继续。 |
| `scene-segmented-row.tsx` | 已暂停，已经提交的任务会做完。 | 已暂停，已提交的步骤会继续完成。 |
| `scene-segmented-row.tsx` | 需要你看一下 | 需要你处理，请在画布上查看。 |
| `scene-segmented-row.tsx` | 已停止，做好的部分在画布里。 / 没有全部做完，做好的部分在画布里。 | 已停止，已完成的部分保留在画布上。 / 未全部完成，已完成的部分保留在画布上。 |
| `scene-segmented-row.tsx` 状态 | 已停下 | 未完成 |
| `scene-video-workspace.tsx`（四处链接） | 在画布中查看 | 在画布上查看 |
| `scene-video-workspace.tsx`（两处） | 正在读取任务 | 正在加载任务… |
| `scene-video-workspace.tsx` 标题 | 正在读取视频 / 这次生成没有完成 | 正在加载视频… / 生成没有完成 |
| `scene-video-workspace.tsx` 报错下一步 | 状态可能已经变化，请刷新页面后再试。 | 状态可能已变化，请刷新页面后重试。 |
| `scene-video-workspace.tsx` 失败说明 | 请在画布中查看这一步，处理后继续生成。 | 请在画布上查看这一步，处理后继续生成。 |
| `scene-video-workspace.tsx` title（两处） | 把这次的设置放回编辑器，原任务保留 | 将此次的设置恢复到编辑器，原任务保留 |
| `ip/mocks/scenes.ts`（照旧表里服务端的改法） | 自己写描述，可以放几张参考图 / 说说想要什么画面 / 说说要换成什么 | 自己写描述，可添加参考图 / 描述想要的画面 / 要替换的内容 |

#### 价格说明
| 位置 | 原文 | 改为 |
|---|---|---|
| `canvas-bridge/studio-video-price.ts`（#12） | 先优化另按实际用量扣少量积分。 | 优化提示词按实际用量另计。 |
| 同上 | 模型赠款抵 X 积分，再付 Y 积分。 / 模型赠款抵 X 积分，不用再付积分。 | 模型赠款抵扣 X 积分，另需支付 Y 积分。 / 模型赠款抵扣 X 积分，无需另付积分。 |
| 同上 | 可用积分不够，这条要付 N 积分。 / 现在还不能生成。 | 可用积分不足，需支付 N 积分。 / 暂时无法生成。 |
| 同上 | 个人账户 A 积分，企业账户 B 积分，点生成时选账户。 | 个人账户 A 积分，企业账户 B 积分，生成时选择付款账户。 |
| 同上 | 付款账户点生成时选，模型赠款到时再抵。 | 生成时选择付款账户，模型赠款在付款时抵扣。 |
| `canvas-bridge/studio-segmented.ts` | 个人账户视频费 A 积分，企业账户视频费 B 积分，点生成时选账户。 / 付款账户点生成时选。 | ……，生成时选择付款账户。 / 生成时选择付款账户。 |

#### 测试（同步）
`scene-test-helpers.ts`、`scene-continue`、`scene-director-spec`、`scene-draft-races`、`scene-draft-state`、`scene-drafts`、`scene-prompt-editor`、`scene-segmented`、`scene-studios`、`scene-video-plan`、`scene-video-workspace`、`studio-video-price`。按钮和 role 名直接改；编导核对提示、换场景提示、多图说明改成按关键内容匹配。`scene-continue` 里「在画布上查看」现在和结果区链接同名，改成在 `.scene-handoff` 里找。

## 存疑项选了哪种写法

1. 「做成视频」：选 A，保留。动词 + 对象，意思准确，点了只是带图去 AI 视频，不生成也不扣费。
2. 「停止」：选 A，保留。编导脚本的停止加了悬停「停止后，已产生的费用按实际用量结算」。
3. 「自由出图」场景名：选 A，保留，归服务端目录，不是按钮。
4. 脚本与设置不一致的那句话：选 B，显示用书面句，提交给服务端的原句不动。
5. 素材位「可选」：按全站统一表改「选填」。
6. 场景「做法」`structure`：不动，它同时是给模型的提示词。
- 状态「已停下」旧表没给写法：选「未完成」，这个分支是 needs_user 以外的失败和中止。
- 换场景提示两页统一写「此场景不使用 X，返回「Y」时会恢复。」，没用旧表视频页的「「新场景」不使用 X」。

---

# 第 4A 批 · 画布工作台

| 位置（相对 apps/web-aiavatar/src/） | 原文 | 改为 |
|---|---|---|
| `canvas-bridge/audio.ts:9` ×2 | 语音生成还没开通 | 暂不支持语音生成 |
| `canvas-bridge/generation.ts:107` | 等太久了（运行号 ${runId}）。这次运行可能还在服务端跑，把运行号报给运维可以查到它的结果；真卡住时冻结的积分由服务端释放 | 等待超时（运行号 ${runId}）。任务可能仍在处理中，请稍后刷新查看；任务异常时，未使用的积分将自动退回。 |
| `canvas-bridge/generation.ts:166` | 这次运行没有返回图片（运行号 ${run.id}）—— 把这个号报给运维可以查到原因 | 本次运行未返回图片（运行号 ${run.id}）。请重试。多次失败时，可复制「错误详情」反馈给我们。 |
| `canvas-bridge/generation.ts:188` | 画布还没打开，稍等一下再试 | 画布尚未打开，请稍后重试 |
| `canvas-bridge/generation.ts:254` | 看图对话还没开通 | 暂不支持看图对话 |
| `canvas-bridge/image-storage.ts:54` | 读取图片失败（${res.status}） | 图片加载失败（${res.status}） |
| `canvas-bridge/image-storage.ts:116` | 图片地址暂时无法读取 | 图片加载失败，请重试 |
| `canvas-bridge/image-storage.ts:116` | 这张图读不出来 | 图片加载失败，请重试 |
| `canvas-bridge/image-storage.ts:116` | 图片读取失败 | 图片加载失败，请重试 |
| `canvas-bridge/project-sync.ts:311` | 上一次的改动还在保存中。请等待原保存完成，再重新加载画布。 | 上一次的改动仍在保存中，请等待保存完成后重新加载画布。 |
| `canvas-bridge/project-sync.ts:341` | 这个项目打不开 | 画布加载失败，请稍后刷新重试。 |
| `canvas-bridge/project-sync.ts:558` | 没拿到最新内容，稍后再试 | 最新版本加载失败，请重试。 |
| `canvas-bridge/project-sync.ts:565` ×2 | ${snap.title} · 另一份 | ${snap.title} · 副本 |
| `canvas-bridge/project-sync.ts:568` | 另存没成功，这里的改动还在 | 另存失败，此页面的改动仍保留 |
| `canvas-bridge/project-sync.ts:571` | 已另存一份，但没拿到这张画布的最新内容，稍后再试 | 已另存为新画布，但当前画布的最新版本加载失败，请重试。 |
| `canvas-bridge/project-sync.ts:578` | 没拿到画布的当前版本，稍后再试 | 画布当前版本加载失败，请重试。 |
| `canvas-bridge/publish-gate.ts:24` | 这张画布在别处被改过了。先点顶栏的「处理冲突」选一种处理方式，再发布。 | 此画布已在其他窗口修改。请点击顶栏「处理冲突」完成处理后发布。 |
| `canvas-bridge/publish-gate.ts:27` | 画布还没保存上，发布会用到服务端上的旧内容。先点顶栏的「重试保存」，成功之后再发布。 | 画布尚未保存，此时发布将使用上一次保存的内容。请点击顶栏「重试保存」，保存成功后发布。 |
| `canvas-bridge/recording-audio.ts:68` | 录音不足 10 秒，请跟着文字完整读一遍再保存。 | 录音不足 10 秒，请完整朗读示例文字后保存。 |
| `canvas-bridge/recording-audio.ts:78` | 麦克风权限未开启，请在浏览器的网站设置中允许使用麦克风，再试一次。 | 麦克风权限未开启，请在浏览器的网站设置中允许使用麦克风后重试。 |
| `canvas-bridge/recording-audio.ts:79` ×2 | 也可以上传音频文件 | 也可上传音频文件 |
| `canvas-bridge/signed-audio.tsx:31` | >读不到这段音频< | >音频加载失败< |
| `canvas-bridge/studio-attachments.ts:46` | 不支持这个文件格式，请选择 | 不支持此文件格式，请选择 |
| `canvas-bridge/studio-batch.ts:12` | 请选择 1 到 12 个镜头 | 请选择 1–12 个镜头 |
| `canvas-bridge/studio-batch.ts:14` | 生成模型尚未配置 | 生成模型暂不可用 |
| `canvas-bridge/studio-frame-confirm.ts:17` | cancelText: "先去连图片 | cancelText: "连接图片 |
| `canvas-bridge/studio-image-file.ts:9` | 图片是空的，请重新选择 | 图片文件为空，请重新选择 |
| `canvas-bridge/studio-image-upload.ts:16` | 当前节点正在生成，请等待任务完成后再替换图片 | 当前节点生成中，请等待任务完成后替换图片 |
| `canvas-bridge/studio-linked-inputs.ts:51` | 请先为「 | 请为「 |
| `canvas-bridge/studio-linked-inputs.ts:54` | 请先填写「 | 请填写「 |
| `canvas-bridge/studio-node-failure.ts:34` | 这个模型已不可用，请换一个模型再生成 | 此模型已不可用，请更换模型后重新生成 |
| `canvas-bridge/studio-node-failure.ts:35` | 没有生成出来，可以修改后重试 | 生成失败，可修改后重试 |
| `canvas-bridge/studio-packaging.ts:31` | 条字幕请使用“开始秒-结束秒: 文字” | 条字幕请使用「开始秒-结束秒: 文字」格式 |
| `canvas-bridge/studio-save.ts:15` | 这张画布在别处被改过了，先处理顶栏里的保存冲突，再继续创作 | 此画布已在其他窗口修改，请处理顶栏的保存冲突后继续创作 |
| `canvas-bridge/studio-save.ts:16` | 画布保存失败，请先重试保存 | 画布保存失败，请重试保存 |
| `canvas-bridge/studio-script-markdown.ts:44` | 分集请使用“分集 / 人物标题”样式，名称如“第 1 集 · 标题”，集号 | 分集请使用「分集 / 人物标题」样式，名称如「第 1 集 · 标题」，集号 |
| `canvas-bridge/studio-script-markdown.ts:68` | AI 回复期间正文已修改。请先比较差异，再明确采用 AI 版本。 | AI 回复期间正文已修改，请比较差异后确认是否采用 AI 版本。 |
| `canvas-bridge/studio-video-frame.ts:34` | 这条视频无法在浏览器里读取，请换一条 MP4 再试 | 浏览器无法加载此视频，请更换 MP4 视频后重试 |
| `canvas-bridge/studio-video-frame.ts:35` | 读取视频超时，请重试 | 视频加载超时，请重试 |
| `canvas-bridge/studio-video-frame.ts:70` | 这条视频没有画面，无法截取 | 此视频没有画面，无法截取 |
| `canvas-bridge/studio-video-frame.ts:74` | 浏览器不支持截取画面，请换个浏览器再试 | 当前浏览器不支持截取画面，请更换浏览器后重试 |
| `canvas-bridge/studio-video-frame.ts:80` | 没能截出画面，请重试 | 截取画面失败，请重试 |
| `canvas-bridge/studio-video-prompt.ts:149` | 描述里提到了图片，这次没有用上图片 | 描述中提到了图片，但本次未使用图片 |
| `canvas-bridge/studio-video-prompt.ts:150` | 描述里提到了尾帧，当前模式只用首帧 | 描述中提到了尾帧，当前模式只使用首帧 |
| `canvas-bridge/studio-video-prompt.ts:150` | 描述里提到了 ${intent.needed} 张图，这次只用了 ${intent.bound} 张 | 描述中提到了 ${intent.needed} 张图片，本次只使用了 ${intent.bound} 张 |
| `canvas-bridge/studio-video-prompt.ts:152` | 这个模型只能按文字生成，要用图片请换一个模型。 | 当前模型只支持文字生成，如需使用图片，请更换模型。 |
| `canvas-bridge/studio-video-prompt.ts:153` | 这个模型一次最多用 ${most} 张图，放不下描述里的 ${intent.needed} 张。可以少用几张，或者换一个模型。 | 当前模型最多支持 ${most} 张图片，少于描述中的 ${intent.needed} 张。请减少图片或更换模型。 |
| `canvas-bridge/studio-video-prompt.ts:154` | 这个模型没有能用尾帧的模式，可以换一个支持首尾帧的模型，或者去掉描述里的尾帧。 | 当前模型不支持尾帧，请更换支持首尾帧的模型，或删除描述中的尾帧。 |
| `canvas-bridge/studio-video-prompt.ts:155` | 这个模型没有能按描述使用这些图片的模式，可以换一个模型。 | 当前模型无法按描述使用这些图片，请更换模型。 |
| `canvas-bridge/studio-video-prompt.ts:156` | 要照着图片出片，改用${name}，再选好要用的图片。 | 如需按图片生成视频，请改用${name}并选择图片。 |
| `canvas-bridge/studio-video-prompt.ts:157` | 要用上尾帧，改用${name}；这个模式还需要再选一张首帧图。 | 如需使用尾帧，请改用${name}，此模式还需要选择一张首帧图。 |
| `canvas-bridge/studio-video-prompt.ts:158` | 要照着图片出片，改用${name}，再选好这 ${intent.needed} 张图片。 | 如需按图片生成视频，请改用${name}并选择这 ${intent.needed} 张图片。 |
| `canvas-bridge/studio-video-prompt.ts:159` | 这个模型没有能放下 ${intent.needed} 张图、又锁定首帧尾帧的模式。改用${name}能用上这些图，但它们只作参考，不会锁定首帧或尾帧。 | 当前模型无法在使用 ${intent.needed} 张图片的同时锁定首帧和尾帧。改用${name}可使用这些图片，但仅作参考，不会锁定首帧或尾帧。 |
| `canvas-bridge/studio-video-prompt.ts:160` | 这个模型只能把图片当作${target.mode.needsLastFrame ? "首帧和尾帧" : "首帧"}用。改用${name}后，图片会成为视频的${target.mode.needsLastFrame ? "开头和结尾" : "第一帧"}。 | 当前模型只能将图片用作${target.mode.needsLastFrame ? "首帧和尾帧" : "首帧"}。改用${name}后，图片将作为视频的${target.mode.needsLastFrame ? "开头和结尾" : "第一帧"}。 |
| `canvas-bridge/studio-video-prompt.ts:163` | 写在描述里只是文字，模型看不到画布上的图片。 | 在描述中只是文字，模型无法看到画布上的图片。 |
| `canvas-bridge/studio-video-prompt.ts:164` | 画布上还没有图片，可以先上传，或从人物库里选。 | 画布中暂无图片，可上传或从人物库选择。 |
| `canvas-bridge/studio-video-prompt.ts:164` | 只想按文字出片，可以直接生成。 | 如只按文字生成视频，可直接生成。 |
| `canvas-bridge/studio-video-prompt.ts:165` | 去选择视频模式 | 选择视频模式 |
| `canvas-bridge/studio-video-upload.ts:11` | 视频文件是空的，请重新选择 | 视频文件为空，请重新选择 |
| `canvas-bridge/studio-video-upload.ts:20` | 当前节点正在生成，请等待任务完成后再替换视频 | 当前节点生成中，请等待任务完成后替换视频 |
| `canvas-bridge/studio-video.ts:16` | 所选视频模式已不在当前模型的开放范围，请重新选择 | 当前模型不支持所选视频模式，请重新选择 |
| `canvas-bridge/studio-video.ts:16` ×2 | 这个模型不支持所选视频模式，请重新选择 | 当前模型不支持所选视频模式，请重新选择 |
| `canvas-bridge/studio-video.ts:29` | 当前清晰度不在所选模型的开放范围，请在参数设置中重新选择 | 当前模型不支持所选清晰度，请在参数设置中重新选择 |
| `canvas-bridge/studio-video.ts:37` | 当前画幅不在所选模型的开放范围，请在参数设置中重新选择 | 当前模型不支持所选画幅，请在参数设置中重新选择 |
| `canvas-bridge/studio-video.ts:173` | 字，这个模型最多 ${max} 字，需删减 | 字，当前模型最多 ${max} 字，需删减 |
| `canvas-bridge/studio-video.ts:187` | 请先写提示词 | 请输入提示词 |
| `canvas-bridge/studio-video.ts:205` | 这个模式和清晰度尚未定价，暂不可生成 | 当前模式和清晰度暂不可用 |
| `canvas-bridge/studio-work-clips.ts:83` | 横屏画面，成片里上下会留黑边 | 横屏画面，成片上下将留黑边 |
| `canvas-bridge/studio-work-clips.ts:83` | 画面更宽，成片里上下会留黑边 | 画面较宽，成片上下将留黑边 |
| `canvas-bridge/studio-work-clips.ts:84` | 竖屏画面，成片里左右会留黑边 | 竖屏画面，成片左右将留黑边 |
| `canvas-bridge/studio-work-clips.ts:84` | 画面更窄，成片里左右会留黑边 | 画面较窄，成片左右将留黑边 |
| `canvas-bridge/studio-work-clips.ts:104` | 条字幕还没写内容 | 条字幕未填写内容 |
| `canvas-bridge/studio-work-clips.ts:106` | 字幕格式不对 | 字幕格式不正确 |
| `canvas-bridge/studio-work-clips.ts:109` | 条字幕结束在 ${captions[late].end} 秒，成片只有 | 条字幕结束于 ${captions[late].end} 秒，成片时长仅 |
| `canvas-bridge/video.ts:63` | 这次没有提交：描述里提到了${intent.mentions.map(m=>`「${m}」`).join("")}，但请求里没有这些图片。先把图片连到这个视频节点并选好视频模式，或者确认按文字生成。 | 本次未提交：描述中提到了${intent.mentions.map(m=>`「${m}」`).join("")}，但请求中没有这些图片。请将图片连接到此视频节点并选择视频模式，或确认按文字生成。 |
| `canvas-bridge/video.ts:115` | 画布还没打开，稍等一下再试 | 画布尚未打开，请稍后重试 |
| `canvas-bridge/video.ts:121` | 这条视频链现在只支持「首帧模式」——参考图会作为视频第一帧。请在参数面板把模式切回首帧 | 当前只支持首帧模式，参考图将作为视频第一帧。请在参数面板切换为首帧模式 |
| `canvas-bridge/video.ts:123` | 这个模型只支持一张首帧图，请选择支持首尾帧或全能参考的模型 | 当前模型只支持一张首帧图，请选择支持首尾帧或全能参考的模型 |
| `canvas-bridge/video.ts:127` | 没读到视频时长，请在参数面板里重新选一次时长后再发送 | 未获取到视频时长，请在参数面板中重新选择时长后发送 |
| `canvas-bridge/video.ts:140` | 这个模型只接 ${range}，当前是 ${params.durationSec} 秒。请在参数面板把时长调到区间内再发送 | 当前模型支持 ${range}，当前设置为 ${params.durationSec} 秒。请在参数面板调整时长后发送 |
| `canvas-bridge/video.ts:160` | 模型尚未定价，请重新加载模型后生成 | 模型暂不可用，请重新加载模型后生成 |
| `canvas-bridge/video.ts:191` | 任务说成了，但没有成片地址 | 任务已完成，但未返回视频地址 |
| `canvas-bridge/video.ts:200` | 视频生成失败，积分已退回 | 视频生成失败，未使用的积分将退回 |
| `canvas-bridge/video.ts:225` | 等太久了（任务号 ${task.id}）。这条任务在服务端还在跑 —— 刷新页面会接着等它；真卡住时冻结的积分由服务端释放 | 等待超时（任务号 ${task.id}）。任务仍在处理中，刷新页面后将继续等待结果；任务异常时，未使用的积分将自动退回。 |
| `canvas-bridge/video.ts:289` | 成片没有落到我方存储，请联系运维检查视频链的镜像配置 | 视频保存失败，请重试。多次失败时，可复制「错误详情」反馈给我们。 |
| `ip/api/ip-studio.ts:103` ×4 | 这张画布不存在，或者已经删了 | 画布不存在或已删除 |
| `ip/api/ip-studio.ts:121` | 请选择这张画布中的图片 | 请选择此画布中的图片 |
| `ip/api/ip-studio.ts:180` | 已停止等待这次生成 | 已停止等待本次生成 |
| `ip/api/ip-studio.ts:184` | 等了 10 分钟还没出结果，先去做别的，回头再来看这张画布 | 等待超过 10 分钟仍未完成，可稍后打开此画布查看结果 |
| `ip/api/ip-studio.ts:195` | 这张画布已经发布过了 | 此画布已发布 |
| `ip/api/ip-studio.ts:295` | 取素材失败 HTTP ${res.status} | 素材加载失败（HTTP ${res.status}） |
| `ip/audio-recorder-dialog.tsx:56` | 也可以上传音频文件 | 也可上传音频文件 |
| `ip/audio-recorder-dialog.tsx:123` | 读完后可以结束录音 | 朗读完成后可结束录音 |
| `ip/audio-recorder-dialog.tsx:123` | 跟着高亮往下读 | 请跟随高亮朗读 |
| `ip/audio-recorder-dialog.tsx:123` | 准备开口 | 准备开始 |
| `ip/audio-recorder-dialog.tsx:123` | 录好了，先听一听 | 录音完成，请试听 |
| `ip/audio-recorder-dialog.tsx:129` | 找个安静的地方，用平时说话的声音读一遍。只录你自己或已获授权的声音，不放背景音乐。 | 请在安静的环境中，用平时说话的声音朗读一遍。仅录制本人或已获授权的声音，不要播放背景音乐。 |
| `ip/audio-recorder-dialog.tsx:131` | 跟着读，约 15 秒 | 朗读以下文字，约 15 秒 |
| `ip/audio-recorder-dialog.tsx:139` | <span>准备开口</span> | <span>准备开始</span> |
| `ip/audio-recorder-dialog.tsx:157` | >再读 {Math.ceil( | >还需朗读 {Math.ceil( |
| `ip/canvas-conflict-dialog.tsx:28` | title: "另存一份，再换成最新内容", detail: "这里的改动存成一张新画布，这张画布换成别处存好的那份。两边都不丢。 | title: "另存为新画布并加载最新版本", detail: "此页面的改动另存为新画布，当前画布加载其他窗口保存的版本，两份内容都会保留。 |
| `ip/canvas-conflict-dialog.tsx:29` | title: "换成最新内容", detail: "用别处存好的那份。这里没存上的改动会丢掉。 | title: "加载最新版本", detail: "使用其他窗口保存的版本，此页面未保存的改动将丢失。 |
| `ip/canvas-conflict-dialog.tsx:30` | title: "以这里为准", detail: "把这里的改动存上去，别处刚存的那份会被覆盖。 | title: "保留此页改动", detail: "保存此页面的改动，其他窗口保存的版本将被覆盖。 |
| `ip/canvas-conflict-dialog.tsx:48` | setNote("刚才别处又存了一版。再选一次。") | setNote("其他窗口又保存了新版本，请重新选择。") |
| `ip/canvas-conflict-dialog.tsx:64` | />这张画布在别处被改过了</span> | />此画布已在其他窗口修改</span> |
| `ip/canvas-conflict-dialog.tsx:67` | 你可能在另一个窗口或另一台设备上也打开了这张画布，那边的改动已经存好。这里还有没存上的改动，两份内容不能自动合并，选一种处理方式： | 此画布可能已在其他窗口或设备上修改并保存。此页面还有未保存的改动，两份内容无法自动合并，请选择处理方式： |
| `ip/canvas-conflict-dialog.tsx:87` | 先关掉去画布上看一眼也行，顶栏的「处理冲突」能再打开这里。关掉之前这里的改动不会自动保存。 | 关闭后可点击顶栏「处理冲突」重新打开。处理冲突前，此页面的改动不会自动保存。 |
| `ip/canvas-host.tsx:42` | 没保存上，改动还在本地 | 保存失败，改动仍在此页面 |
| `ip/canvas-host.tsx:43` | 别处改过了，这里的改动没存上 | 保存冲突，此页面的改动未保存 |
| `ip/canvas-host.tsx:58` | 这张画布在别的窗口改过了，已经换成最新内容 | 此画布已在其他窗口修改，已加载最新版本 |
| `ip/canvas-host.tsx:85` | 画布尚未保存，已留在当前页面，请先处理保存问题 | 画布尚未保存，已留在当前页面。请重试保存后离开。 |
| `ip/canvas-host.tsx:124` | 平台还没配可用的模型，现在生成不了。找管理员在后台加一个。 | 平台暂无可用模型，暂时无法生成。请联系管理员配置。 |
| `ip/canvas-host.tsx:125` | 模型列表没加载上，刷新页面再试 | 模型列表加载失败，请稍后刷新重试。 |
| `ip/canvas-host.tsx:148` | 存为官方内容 | 保存为官方内容 |
| `ip/canvas-host.tsx:170` | 选一种处理方式：另存一份 / 换成最新内容 / 以这里为准 | 选择处理方式：另存为新画布 / 加载最新版本 / 保留此页改动 |
| `ip/canvas-host.tsx:183` | 再存一次。改动还在这个页面上，先别关 | 重新保存。改动仍在此页面，请勿关闭。 |
| `ip/canvas-host.tsx:195` | {`已发布为 ${publishedAvatarId}，点开去资产库看`} | 已发布，点击在资产中查看 |
| `ip/canvas-host.tsx:198` | <span className="truncate">已发布 · {publishedAvatarId}</span> | <span className="truncate">已发布 · 查看资产</span> |
| `ip/canvas-host.tsx:227` | >画布暂时无法打开</p> | >画布加载失败</p> |
| `ip/canvas-host.tsx:250` | <span>这里的改动已另存为新画布，<a href={`/projects/${copyId}`} target="_blank" rel="noreferrer">打开看看</a></span> | <span>此页面的改动已另存为新画布，<a href={`/projects/${copyId}`} target="_blank" rel="noreferrer">打开</a></span> |
| `ip/canvas-video-task.tsx:98` | error \|\| '正在读取任务 | error \|\| '正在加载任务… |
| `ip/common/toast.tsx:41` | 没成功 | 失败 |
| `ip/image-lightbox.tsx:4` | 回到整张图 | 适应窗口 |
| `ip/last-run-panel.tsx:24` | 看这次实际发给模型的提示词和参考图 | 查看实际发送给模型的提示词和参考图 |
| `ip/last-run-panel.tsx:38` | 上次实际发给模型的内容 | 上次实际发送给模型的内容 |
| `ip/last-run-panel.tsx:60` |  · 已送给模型 |  · 已发送 |
| `ip/last-run-panel.tsx:60` |  · 没用上${r.reason |  · 未使用${r.reason |
| `ip/last-run-panel.tsx:75` | （这次运行没有留下提示词） | （本次运行未记录提示词） |
| `ip/last-run-panel.tsx:78` | 你写的那段在中间，前后是系统按模板补的构图与负面词。参考图决定「像谁」， 提示词里对长相、发型、穿着的描述会覆盖参考图里的对应部分 —— 想保留参考图的样子，就别在提示词里把它重新描述一遍。 | 你写的内容在中间，前后是系统按模板补充的构图与负面词。参考图决定人物长相， 提示词中对长相、发型、穿着的描述会覆盖参考图的对应部分。 如需保留参考图的样子，请勿在提示词中重新描述。 |
| `ip/publish/publish-dialog.tsx:84` | 名片已建好（${card.regNo}），浏览器拦了新窗口，去「名片」页里补上公司 · 职务和联系方式 | 名片已创建（${card.regNo}），但浏览器拦截了新窗口。请前往「名片」页补充公司、职务和联系方式。 |
| `ip/publish/publish-dialog.tsx:86` | 建卡没成功，稍后再试 | 名片创建失败，请重试。 |
| `ip/publish/publish-dialog.tsx:110` | 给这个形象起个名字，发布后在资产库里就用它。 | 请输入形象名称，发布后资产库将使用此名称。 |
| `ip/publish/publish-dialog.tsx:114` | 先在画布上给主形象选一张定稿图，才能发布。 | 请在画布中为主形象选择一张定稿图后发布。 |
| `ip/publish/publish-dialog.tsx:153` | 去数字资产平台查看  | 在资产中查看  |
| `ip/publish/publish-dialog.tsx:201` | 形象与造型已经登记进数字资产库，可以在各条业务线里引用了。 | 形象与造型已存入数字资产库，可在创作中引用。 |
| `ip/publish/publish-dialog.tsx:216` | 可以直接做成一张 <b style={{ color: "var(--ink)" }}>数字名片</b> —— 名字和这 {result.lookIds.length} 套造型自动带过去，访客能点着换装看， 你只要再填联系方式。 | 可创建一张 <b style={{ color: "var(--ink)" }}>数字名片</b>： 名字和 {result.lookIds.length} 套造型将自动带入，访客可切换造型查看， 你只需填写联系方式。 |
| `ip/publish/publish-dialog.tsx:227` | cardBusy ? "建卡中" : "做成数字名片 | cardBusy ? "创建中" : "创建数字名片 |
| `ip/publish/publish-dialog.tsx:239` | 只有已经选好定稿图的形象才能发布。发布本身不花积分。 | 需为形象选择定稿图后才能发布。发布不消耗积分。 |
| `ip/publish/publish-dialog.tsx:245` | 还没有定稿的形象。先运行生成节点，在候选里点一张定稿，再回来发布。 | 还没有定稿的形象。请生成图片并在候选中选择一张定稿后发布。 |
| `ip/publish/publish-dialog.tsx:301` | >一起带上的造型< | >同时发布的造型< |
| `ip/scoped-credits-panel.tsx:30` | 暂时读不到模型赠款，请重试。 | 模型赠款加载失败，请稍后刷新重试。 |
| `ip/scoped-credits-panel.tsx:42` | 正在读取额度… | 正在加载额度… |
| `ip/studio-advanced-editor.tsx:46` | 画布里的视频 | 画布中的视频 |
| `ip/studio-advanced-editor.tsx:47` | 画布里的配音和音乐 | 画布中的配音和音乐 |
| `ip/studio-advanced-editor.tsx:48` | 加一段文字 | 添加文字 |
| `ip/studio-advanced-editor.tsx:49` | 加一条字幕 | 添加字幕 |
| `ip/studio-advanced-editor.tsx:61` | 素材读取失败 ${r.status} | 素材加载失败 ${r.status} |
| `ip/studio-advanced-editor.tsx:172` | kind === "video" ? "画布里的视频" : "画布里的音频 | kind === "video" ? "画布中的视频" : "画布中的音频 |
| `ip/studio-advanced-editor.tsx:173` | kind === "video" ? "画布上还没有视频" : "画布上还没有配音或音乐，先在画布上做一条配音 | kind === "video" ? "画布中暂无视频" : "画布中暂无配音或音乐，请在画布中生成配音 |
| `ip/studio-advanced-editor.tsx:174` | 从播放头位置加到时间线 | 从播放头位置添加到时间线 |
| `ip/studio-advanced-editor.tsx:177` | 点一下从播放头位置加到时间线，再拖动位置、拖两边调长短。 | 点击添加到播放头位置，可拖动调整位置，拖动两端调整时长。 |
| `ip/studio-advanced-editor.tsx:186` | <div className="panel-title">加文字</div> | <div className="panel-title">添加文字</div> |
| `ip/studio-advanced-editor.tsx:187` | 要加的文字 | 文字内容 |
| `ip/studio-advanced-editor.tsx:187` | 比如：限时优惠 | 例如：限时优惠 |
| `ip/studio-advanced-editor.tsx:188` | >加到画面</Button> | >添加到画面</Button> |
| `ip/studio-advanced-editor.tsx:189` | 在画面上拖动文字换位置，在右边改字号和颜色。 | 可在画面中拖动文字调整位置，在属性栏修改字号和颜色。 |
| `ip/studio-advanced-editor.tsx:197` | <div className="panel-title">加字幕</div> | <div className="panel-title">添加字幕</div> |
| `ip/studio-advanced-editor.tsx:198` | 要加的字幕 | 字幕内容 |
| `ip/studio-advanced-editor.tsx:198` | 这一句要说的话 | 例如：今天介绍一款新品 |
| `ip/studio-advanced-editor.tsx:199` | >加一条字幕</Button> | >添加字幕</Button> |
| `ip/studio-advanced-editor.tsx:200` | 从播放头位置开始显示 3 秒，拖两边调时长。字幕都放在同一条字幕轨上。 | 从播放头位置开始显示 3 秒，拖动两端调整时长。所有字幕位于同一字幕轨。 |
| `ip/studio-advanced-editor.tsx:225` | <h3>怎么剪</h3> | <h3>剪辑说明</h3> |
| `ip/studio-advanced-editor.tsx:227` | 拖动时间线上的片段换位置。 | 拖动时间线上的片段调整位置。 |
| `ip/studio-advanced-editor.tsx:228` | 拖片段的两边掐头去尾。 | 拖动片段两端裁剪首尾。 |
| `ip/studio-advanced-editor.tsx:229` | 把播放头放到要切的地方，点时间线上方的剪刀切开。 | 将播放头移到分割位置，点击时间线上方的剪刀分割。 |
| `ip/studio-advanced-editor.tsx:230` | 选中后点这里的「删除」，后面的片段会自动补上来。 | 选中后点击「删除」，后续片段将自动前移。 |
| `ip/studio-advanced-editor.tsx:231` | 左边加配音、文字和字幕，选中后在这里改。 | 在工具栏添加配音、文字和字幕，选中后可在此修改。 |
| `ip/studio-advanced-editor.tsx:235` | 在成片里 {fmt(el.getStart())} – {fmt(el.getEnd())}，共 | 成片中 {fmt(el.getStart())}–{fmt(el.getEnd())}，共 |
| `ip/studio-advanced-editor.tsx:238` | 这段的原声关掉了（选了配音时默认关掉）。 | 此片段原声已关闭（使用配音时默认关闭）。 |
| `ip/studio-advanced-editor.tsx:261` | 素材没有存储位置，加不进来 | 素材无法添加 |
| `ip/studio-advanced-editor.tsx:299` | 有 ${byKey.size - loaded.length} 个素材没取到，已从时间线去掉 | ${byKey.size - loaded.length} 个素材加载失败，已从时间线移除 |
| `ip/studio-advanced-editor.tsx:300` | 」读不出来，没有放进时间线 | 」加载失败，未加入时间线 |
| `ip/studio-advanced-editor.tsx:327` | 时间线上至少要有一段视频 | 时间线中至少需要一段视频 |
| `ip/studio-advanced-editor.tsx:330` | 已开始合成，完成后出现在「合成好的作品」里 | 已开始合成，完成后显示在「已合成的作品」中 |
| `ip/studio-advanced-editor.tsx:334` | 正在载入素材… | 正在加载素材… |
| `ip/studio-ai-icon.tsx:6` | AI 处理，会消耗积分 | AI 处理，将消耗积分 |
| `ip/studio-batch-panel.tsx:53` | 有镜头生成失败。检查错误后，可只重试失败步骤。 | 部分镜头生成失败。查看错误后，可仅重试失败步骤。 |
| `ip/studio-batch-panel.tsx:93` ×2 | AI 处理，会消耗积分 | AI 处理，将消耗积分 |
| `ip/studio-batch-panel.tsx:94` | 只重试失败步骤并继续 | 重试失败步骤并继续 |
| `ip/studio-batch-panel.tsx:95` | 已经受理的任务仍会完成 | 已提交的任务仍会完成 |
| `ip/studio-batch-panel.tsx:101` | >改成 {durationIssue.fix} 秒< | >改为 {durationIssue.fix} 秒< |
| `ip/studio-billing-dialog.tsx:49` | 企业功能暂未开放，可明确选择个人积分 | 企业功能暂未开放，可选择个人积分 |
| `ip/studio-billing-dialog.tsx:49` | 此模型未获企业授权，可更换模型或明确选择个人积分 | 此模型未获企业授权，可更换模型或选择个人积分 |
| `ip/studio-billing-dialog.tsx:49` | 企业余额或生成设置尚未读取 | 企业余额或生成设置尚未加载 |
| `ip/studio-billing-dialog.tsx:65` | \|\| "Studio 生成"} | \|\| "IP Studio 生成"} |
| `ip/studio-billing-dialog.tsx:65` | 下一步确认折扣、模型赠款抵扣和要付的积分。 | 下一步确认折扣、模型赠款抵扣和应付积分。 |
| `ip/studio-billing-dialog.tsx:65` | isText ? expected === undefined ? "按实际用量结算，完成后显示实际消耗积分。" : `本次最多冻结 ${n(expected)} 积分，按实际用量结算，未用部分退回。` : expected | isText ? "按实际用量结算，完成后显示实际消耗积分。" : expected |
| `ip/studio-billing-dialog.tsx:67` | <p>出图、视频、数字人、配音等所有生成都按这个账户付款，换电脑或手机也一样。想改回每次询问，去<a href="/studio#/settings">设置</a>。余额不足时不会自动换账户。</p> | <p>图片、视频、数字人、配音等所有生成均使用此账户付款，在其他设备上同样生效。如需改为每次询问，请前往<a href="/studio#/settings">设置</a>。余额不足时不会自动切换账户。</p> |
| `ip/studio-billing-dialog.tsx:68` | 默认账户没有保存 | 默认账户保存失败 |
| `ip/studio-billing-dialog.tsx:68` | ${preferenceError} 可以取消勾选，只用这一次。 | ${preferenceError} 可取消勾选，仅本次使用此账户。 |
| `ip/studio-billing-dialog.tsx:69` | <p>企业积分仍归企业，受企业允许模型与每人 {policy?.maxActiveJobs ?? "待读取"} 项在途任务限制。作品仍归个人。</p> | <p>企业积分归企业所有，使用时受企业允许的模型及每人 {policy?.maxActiveJobs ?? "待读取"} 项进行中任务的限制。作品归个人所有。</p> |
| `ip/studio-billing-dialog.tsx:70` | 请先充值或联系企业分配积分，也可以明确选择另一付款账户。系统不会自动切换或混合扣款。 | 请充值或联系企业分配积分，也可选择其他付款账户。系统不会自动切换或混合扣款。 |
| `ip/studio-billing-settings.tsx:19` | 暂时无法读取付款设置，请刷新后重试。 | 付款设置加载失败，请稍后刷新重试。 |
| `ip/studio-billing-settings.tsx:31` | ${caught.message}，没有保存。 | ${caught.message}，未保存。 |
| `ip/studio-billing-settings.tsx:31` | 没有保存，请重试。 | 保存失败，请重试。 |
| `ip/studio-billing-settings.tsx:38` | 改了就保存，出图、视频、数字人、配音等所有生成都按它付款，换电脑或手机也一样。余额不足时不会自动换账户；退出企业后会重新询问。 | 修改后自动保存。图片、视频、数字人、配音等所有生成均使用此账户付款，在其他设备上同样生效。余额不足时不会自动切换账户；退出企业后将重新询问。 |
| `ip/studio-canvas-guide.tsx:5` ×2 | 和助手开始 | 与助手对话 |
| `ip/studio-canvas-guide.tsx:12` | 写一句描述出图，可以加参考图 | 输入描述生成图片，可添加参考图 |
| `ip/studio-canvas-guide.tsx:13` | 用描述或一张首帧出视频 | 根据描述或首帧图生成视频 |
| `ip/studio-canvas-guide.tsx:14` | 选一个声音，把台词念出来 | 选择声音，为台词配音 |
| `ip/studio-canvas-guide.tsx:29` | 这张画布还是空的 | 画布还没有内容 |
| `ip/studio-canvas-guide.tsx:30` | 在助手里说想做什么，它会把每一步放进画布。也可以自己选一个开始： | 向助手描述需求，助手会把每一步放进画布。也可以从下方选择： |
| `ip/studio-canvas-guide.tsx:32` | 自己选一个开始 | 选择开始方式 |
| `ip/studio-canvas-guide.tsx:38` | 双击画布空白处也能添加 · | 双击画布空白处也可添加 · |
| `ip/studio-commerce.tsx:24` | 确认角色、商品与卖点，先生成可修改的脚本，再进入同一故事板制作。 | 确认角色、商品与卖点后生成可修改的脚本，并在故事板中继续制作。 |
| `ip/studio-commerce.tsx:27` | 先在画布引用或定稿 IP | 请在画布中引用或定稿 IP |
| `ip/studio-commerce.tsx:29` | 这张图片引用了多个人物，请选择一个明确的出镜 IP。 | 此图片引用了多个人物，请选择一个出镜 IP。 |
| `ip/studio-commerce.tsx:30` | 可在画布“口型同步”入口选择人物视频与配音。 | 可在画布「口型同步」入口选择人物视频与配音。 |
| `ip/studio-commerce.tsx:30` | 专属音色尚未配置，可在“配音”入口查看官方固定音色。 | 暂无专属音色，可在「配音」入口查看官方固定音色。 |
| `ip/studio-commerce.tsx:36` | 视频先使用图像驱动方式；模型自带音轨与专属声音分开。 | 视频使用图像驱动方式；模型自带音轨与专属声音相互独立。 |
| `ip/studio-composer-references.tsx:28` | 画布还没有素材，请先上传图片、视频或音频。 | 画布中暂无素材，请上传图片、视频或音频。 |
| `ip/studio-conversation-start.tsx:40` | 和助手开始创作 | 与助手开始创作 |
| `ip/studio-conversation-start.tsx:49` | 请先输入想做的内容 | 请输入想做的内容 |
| `ip/studio-effect-library.tsx:76` | 通用描述，可用于所有已配置视频模型 | 通用描述，适用于所有视频模型 |
| `ip/studio-effect-library.tsx:76` | 所有已配置视频模型 | 所有视频模型 |
| `ip/studio-effect-library.tsx:78` | 当前画布没有可用图片，可不填 | 当前画布暂无可用图片，此项选填 |
| `ip/studio-effect-library.tsx:98` | 还没有匹配的收藏 | 暂无匹配的收藏 |
| `ip/studio-effect-library.tsx:98` | 还没有匹配的使用记录 | 暂无匹配的使用记录 |
| `ip/studio-effect-library.tsx:98` | 还没有匹配的个人特效 | 暂无匹配的个人特效 |
| `ip/studio-effect-library.tsx:98` | 没有匹配的特效 | 暂无匹配的特效 |
| `ip/studio-effect-library.tsx:99` | 在特效条目上点击收藏，便可在这里再次找到。 | 收藏的特效会显示在这里。 |
| `ip/studio-effect-library.tsx:99` | 换个关键词，或取消“仅适用当前模型”查看其他特效。 | 请更换关键词，或取消「仅适用当前模型」查看其他特效。 |
| `ip/studio-effect-library.tsx:109` | 当前模型不适用。关闭特效库后选择适用模型，再应用此特效。 | 此特效不适用于当前模型。请关闭特效库，更换为适用模型后应用。 |
| `ip/studio-errors.tsx:106` ×2 | 这次操作 | 本次操作 |
| `ip/studio-errors.tsx:245` | 本次用量正在核对，请先查看原任务状态。 | 本次用量正在核对，请查看原任务状态。 |
| `ip/studio-errors.tsx:252` | 确认操作是否已生效后再决定是否重试。 | 确认操作是否已生效后决定是否重试。 |
| `ip/studio-flow-area.tsx:51` | 区域里有 | 区域内有 |
| `ip/studio-flow-area.tsx:56` | 把节点拖进来 | 将节点拖入此区域 |
| `ip/studio-flow-canvas.tsx:92` | {generating ? 'AI 正在生成' : 'AI 生成的'} | {generating ? 'AI 生成中' : 'AI 生成'} |
| `ip/studio-flow-canvas.tsx:97` | {data.uploading?'上传处理中…':'替换视频'} | {data.uploading?'上传中…':'替换视频'} |
| `ip/studio-flow-canvas.tsx:102` | <strong>没有生成出来</strong> | <strong>生成失败</strong> |
| `ip/studio-flow-canvas.tsx:105` | {data.uploading?'处理并上传中…':'上传图片'} | {data.uploading?'上传中…':'上传图片'} |
| `ip/studio-flow-canvas.tsx:106` | {data.uploading?'上传处理中…':'上传视频'} | {data.uploading?'上传中…':'上传视频'} |
| `ip/studio-flow-canvas.tsx:110` | <span>优化稿有需要留意的地方，选好再出片</span> | <span>优化稿有需要确认的地方，请选择后生成视频</span> |
| `ip/studio-flow-canvas.tsx:110` | onClick={edit}>去确认</button> | onClick={edit}>确认</button> |
| `ip/studio-flow-canvas.tsx:339` | 生成中的节点保留，请先在任务中心处理原任务 | 生成中的节点已保留，请在「创作任务」中处理原任务 |
| `ip/studio-flow-canvas.tsx:352` ×2 | 素材正在上传，请完成后再添加 | 素材正在上传，请上传完成后添加 |
| `ip/studio-flow-canvas.tsx:354` | 当前节点正在生成，请等待任务完成后再替换视频 | 当前节点生成中，请等待任务完成后替换视频 |
| `ip/studio-flow-canvas.tsx:360` | 当前节点正在生成，请等待任务完成后再替换图片 | 当前节点生成中，请等待任务完成后替换图片 |
| `ip/studio-flow-canvas.tsx:594` | 按住拖动，圈出一块区域 | 按住拖动，圈选区域 |
| `ip/studio-flow-canvas.tsx:648` | ；截出的图片已保留，可按 | ；截取的图片已保留，可按 |
| `ip/studio-flow-canvas.tsx:648` | 截出的图片已保留，请重试保存画布 | 截取的图片已保留，请重试保存画布 |
| `ip/studio-flow-image-tools.tsx:77` | 正在读取图片 | 正在加载图片… |
| `ip/studio-flow-image-tools.tsx:77` | 正在读取图片 | 正在加载图片… |
| `ip/studio-flow-image-tools.tsx:79` | 下一步：确认生成 | 下一步 |
| `ip/studio-flow-video-frames.tsx:55` | 视频正在生成，完成后再抽帧 | 视频生成中，完成后可抽帧 |
| `ip/studio-flow-video-frames.tsx:90` | 无法读取这条视频，请重试 | 视频加载失败，请重试 |
| `ip/studio-flow-video-frames.tsx:93` | 没能截出画面，请重试 | 截取画面失败，请重试 |
| `ip/studio-flow-video-frames.tsx:105` | 截取一帧画面，生成一张连着这条视频的图片。 | 截取一帧画面，生成一张与此视频相连的图片。 |
| `ip/studio-flow-video-frames.tsx:110` | 当前帧是画布上这条视频播放到的位置，可以先拖动进度条再提交。 | 当前帧为画布上此视频的播放位置，可拖动进度条调整。 |
| `ip/studio-flow-video-frames.tsx:111` | 演示模式不能抽帧，连上服务后可用。 | 演示模式不支持抽帧。 |
| `ip/studio-frame-crop-hint.tsx:27` ×2 | 改成 | 改为 |
| `ip/studio-generation-controls.tsx:95` | 正在读取模型… | 正在加载模型… |
| `ip/studio-generation-controls.tsx:95` | 尚未配置模型 | 暂无可用模型 |
| `ip/studio-lip-sync.tsx:39` | AI 处理，会消耗积分 | AI 处理，将消耗积分 |
| `ip/studio-lip-sync.tsx:39` | 先选择视频和配音 | 请选择视频和配音 |
| `ip/studio-lip-sync.tsx:42` | 选择画布里的单人人物视频和配音，让人物按这条音频说话。 | 选择画布中的单人视频和配音，让人物按此音频说话。 |
| `ip/studio-lip-sync.tsx:44` | 尚未配置口型模型，请在后台绑定「Studio 口型同步」。 | 口型同步暂不可用，请联系管理员配置口型模型。 |
| `ip/studio-lip-sync.tsx:48` | 先在画布生成 WAV 配音 | 请在画布中生成 WAV 配音 |
| `ip/studio-lip-sync.tsx:50` | 单人正脸，15–60fps。 | 单人正脸，帧率 15–60 fps。 |
| `ip/studio-model-quote-dialog.tsx:39` | 选中后，额度不足就停止生成，不扣普通积分。提交时会再次核对价格与额度。 | 勾选后，模型赠款不足时将停止生成，不扣除普通积分。提交时将再次核对价格与额度。 |
| `ip/studio-motion-prompt.tsx:52` | 没有匹配的运镜，请换个关键词。 | 暂无匹配的运镜，请更换关键词。 |
| `ip/studio-recharge-dialog.tsx:44` | 订单状态暂时无法读取，请稍后刷新 | 订单状态加载失败，请稍后刷新重试。 |
| `ip/studio-recreation.tsx:106` | 尚无可用的视频画面分析模型，请检查模型能力及积分售价配置。 | 暂无可用的视频分析模型，请联系管理员配置。 |
| `ip/studio-recreation.tsx:109` | AI 分析，会消耗积分 | AI 分析，将消耗积分 |
| `ip/studio-recreation.tsx:120` | 原参考视频已删除或替换。请从新的视频重新进入解析。 | 原参考视频已删除或替换，请选择新的视频重新解析。 |
| `ip/studio-script-editor.tsx:81` | 确认原改稿任务 | 确认原任务 |
| `ip/studio-script-editor.tsx:87` | 改稿任务已受理，请确认原任务继续获取结果 | 改稿任务已提交，请确认原任务继续获取结果 |
| `ip/studio-script-editor.tsx:95` | 请先采纳或放弃当前 AI 版本，再继续改稿 | 请采纳或放弃当前 AI 版本后继续改稿 |
| `ip/studio-script-editor.tsx:140` | 说说你的想法，AI 会基于当前剧本给出修改稿，由你决定是否采纳。 | 输入修改想法，AI 将基于当前剧本给出修改稿，由你决定是否采纳。 |
| `ip/studio-script-editor.tsx:145` | 正文在等待回复时有了新修改，请先比较两个版本。 | 等待回复期间正文有新的修改，请比较两个版本。 |
| `ip/studio-script-editor.tsx:151` | 尚未配置文本模型 | 暂无可用文本模型 |
| `ip/studio-script-editor.tsx:152` | AI 处理，会消耗积分 | AI 处理，将消耗积分 |
| `ip/studio-script-settings.tsx:15` | 可选，最多 3 种 | 选填，最多 3 种 |
| `ip/studio-speech.tsx:39` | 选择人物（可选） | 选择人物（选填） |
| `ip/studio-speech.tsx:46` | 声音风格（可选） | 声音风格（选填） |
| `ip/studio-speech.tsx:47` | 选中音频并点击“设为人物声音”，保存音色 | 选中音频并点击「设为人物声音」，保存音色 |
| `ip/studio-speech.tsx:47` | 专属声音克隆仍需接入。 | 暂不支持专属声音克隆。 |
| `ip/studio-speech.tsx:49` | 原配音任务正在生成，请等待结果。 | 原配音任务生成中，请等待结果。 |
| `ip/studio-speech.tsx:49` | AI 处理，会消耗积分 | AI 处理，将消耗积分 |
| `ip/studio-speech.tsx:50` | 配音费用未配置 | 配音暂不可用 |
| `ip/studio-speech.tsx:50` | 生成配音 · 预冻结 ${cost} 积分 | 生成配音 · ${rate} 积分/秒 |
| `ip/studio-speech.tsx:54` | <p role="status">{rate} 积分/秒，按生成音频的实际时长向上取整计费。预冻结 {cost} 积分，完成后退回差额，不会超出本次上限。</p> | <p role="status">按生成音频的实际时长计费，不足 1 秒按 1 秒计。</p> |
| `ip/studio-speech.tsx:57` | 尚未配置配音模型，请在后台绑定「Studio 配音」。 | 配音暂不可用，请联系管理员配置配音模型。 |
| `ip/studio-task-list.tsx:2` | import {StudioBillingBreakdown} from './studio-billing-breakdown'; | import {StudioBillingBreakdown} from './studio-billing-breakdown'; import { formatDateTime } from '@/lib/datetime'; |
| `ip/studio-task-list.tsx:29` | { id: 'done', label: '完成', | { id: 'done', label: '已完成', |
| `ip/studio-task-list.tsx:38` | 提交结果尚未确认，先查询原任务 | 提交结果尚未确认，请确认原任务 |
| `ip/studio-task-list.tsx:48` | timestamp = Number.isNaN(date.getTime()) ? run.createdAt : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); | timestamp = Number.isNaN(date.getTime()) ? run.createdAt : formatDateTime(run.createdAt); |
| `ip/studio-task-list.tsx:66` | 已读取最新状态，未重新生成或扣费。 | 已更新为最新状态，未重新生成或扣费。 |
| `ip/studio-task-list.tsx:69` | 当前没有进行中的任务 | 暂无进行中的任务 |
| `ip/studio-task-list.tsx:69` | 没有失败的任务 | 暂无失败的任务 |
| `ip/studio-task-list.tsx:69` | 还没有完成的任务 | 暂无已完成的任务 |
| `ip/studio-text-composer.tsx:30` | AI 处理，会消耗积分 | AI 处理，将消耗积分 |
| `ip/studio-text-composer.tsx:35` | 告诉 AI 你想怎么改，例如： | 描述修改要求，例如： |
| `ip/studio-video-controls.tsx:67` | （台词保留原文，会额外消耗少量积分） | （台词保留原文，按实际用量另计） |
| `ip/studio-video-controls.tsx:72` | {on?"生成前先按 H3 官方写法优化提示词，台词保留原文，会额外消耗少量积分。点一下关闭":"已关闭：按原文发给视频模型。点一下开启"} | {on?"生成前按 H3 官方写法优化提示词，台词保留原文。优化提示词按实际用量另计。点击关闭":"已关闭：按原文发送给视频模型。点击开启"} |
| `ip/studio-video-controls.tsx:84` | 提示词优化没成功 | 提示词优化失败 |
| `ip/studio-video-controls.tsx:84` | 优化稿太长，视频模型收不下 | 优化稿超出视频模型的长度上限 |
| `ip/studio-video-controls.tsx:84` | 优化稿有需要留意的地方 | 优化稿有需要确认的地方 |
| `ip/studio-video-controls.tsx:89` | 查看优化稿（发给模型的英文） | 查看优化稿（发送给模型的英文） |
| `ip/studio-video-prompt-notes.tsx:32` | 智能优化 · 没用上 | 智能优化 · 未使用 |
| `ip/studio-video-prompt-notes.tsx:32` | 智能优化 · 发给模型的英文 | 智能优化 · 发送给模型的英文 |
| `ip/studio-voice-adopt.tsx:20` | 将这段已完成配音的音色和风格保存为人物声音，设为默认。试听沿用真实音频，保存免费。 | 将此配音的音色和风格保存为人物声音，并设为默认。试听沿用此音频，保存免费。 |
| `ip/studio-voice-adopt.tsx:23` | 先将人物图片加入 IP，再为人物保存声音。 | 保存声音前，需将人物图片加入 IP。 |
| `ip/studio-work-editor.tsx:68` | 先勾选要放进成片的片段 | 请勾选要加入成片的片段 |
| `ip/studio-work-editor.tsx:69` | 选的配音已经不在画布上了，重新选一条或改回片段原声 | 所选配音已移出画布，请重新选择配音或保留片段原声 |
| `ip/studio-work-editor.tsx:70` | 配音比成片长，合成不了 | 配音长于成片，无法合成 |
| `ip/studio-work-editor.tsx:71` | 品牌、标题、结尾提示和字幕都没填，填一项或关掉文字 | 品牌、标题、结尾提示和字幕均未填写，请至少填写一项或取消添加文字 |
| `ip/studio-work-editor.tsx:97` | 在画布上传视频，或者先生成几段视频，再回来排顺序、配声音、合成。 | 在画布中上传或生成视频后，可在此排列顺序、添加声音并合成。 |
| `ip/studio-work-editor.tsx:98` | >去画布添加片段</Button> | >添加片段</Button> |
| `ip/studio-work-editor.tsx:98` | >生成一段视频</Button> | >生成视频</Button> |
| `ip/studio-work-editor.tsx:98` | >去故事板</Button> | >打开故事板</Button> |
| `ip/studio-work-editor.tsx:110` | 勾选的片段按这个顺序拼成成片，<span | 勾选的片段按此顺序合成，可<span |
| `ip/studio-work-editor.tsx:127` | 在左边预览里从这一段开始看 | 从此片段开始预览 |
| `ip/studio-work-editor.tsx:127` | 在左边单独看这一段 | 单独预览此片段 |
| `ip/studio-work-editor.tsx:135` | 其他片段是照着它做的，默认不放进成片。 | 其他片段据此生成，默认不加入成片。 |
| `ip/studio-work-editor.tsx:139` | 把「${label}」放进成片 | 将「${label}」加入成片 |
| `ip/studio-work-editor.tsx:139` | >放进成片</Checkbox> | >加入成片</Checkbox> |
| `ip/studio-work-editor.tsx:151` | >成片用哪条声音 | >成片音轨 |
| `ip/studio-work-editor.tsx:156` | 画布上还没有配音，成片会保留片段原声。 | 画布中暂无配音，成片将保留片段原声。 |
| `ip/studio-work-editor.tsx:156` | <Mic size={14}/>去做一条配音</button> | <Mic size={14}/>生成配音</button> |
| `ip/studio-work-editor.tsx:157` | 选的配音已经不在画布上了，重新选一条或改回片段原声。 | 所选配音已移出画布，请重新选择配音或保留片段原声。 |
| `ip/studio-work-editor.tsx:161` | ，比成片长 {formatStudioSeconds(voiceGap)}，合成不了。换一条短一点的配音，或者多放几段片段。 | ，长于成片 {formatStudioSeconds(voiceGap)}，无法合成。请更换较短的配音，或加入更多片段。 |
| `ip/studio-work-editor.tsx:162` | 配音比成片短 {formatStudioSeconds(-voiceGap)}，最后这一段没有声音。 | 配音短于成片 {formatStudioSeconds(-voiceGap)}，结尾部分将没有声音。 |
| `ip/studio-work-editor.tsx:163` | 换成配音后，片段原来的声音不再保留；人物口型不会跟着配音改。 | 使用配音后，片段原声将不再保留，人物口型不会随配音变化。 |
| `ip/studio-work-editor.tsx:175` | 比如：点击下方链接了解更多 | 例如：点击下方链接了解更多 |
| `ip/studio-work-editor.tsx:178` | {draft.captionText.trim() ? "清空字幕后可以按片段重新填时间" : known ? undefined : "片段时长还没读到"} onClick={() => p.onDraftChange({ captionText: studioCaptionTemplate(lengths as number[]) })}>按片段填好时间</button></span> | {draft.captionText.trim() ? "清空字幕后可按片段重新填写时间" : known ? undefined : "片段时长加载中"} onClick={() => p.onDraftChange({ captionText: studioCaptionTemplate(lengths as number[]) })}>按片段填写时间</button></span> {!captionTemplateReady && <p className="studio-work-note">{draft.captionText.trim() ? "清空字幕后可按片段重新填写时间。" : "片段时长加载中，完成后可按片段填写时间。"}</p>} |
| `ip/studio-work-editor.tsx:182` | 每行一条，写成「开始秒-结束秒: 字幕」 | 每行一条，格式为「开始秒-结束秒: 字幕」 |
| `ip/studio-work-editor.tsx:184` | 字幕不要超过这个时间。` : ""}字幕按你写的时间出现，不会自动识别台词。 | 字幕时间不能超过成片时长。` : ""}字幕按填写的时间显示，不会自动识别台词。 |
| `ip/studio-work-editor.tsx:186` | 品牌和标题在画面左上角，结尾提示在底部，整条成片都显示。左边预览能看到大概位置，合成后以成片为准。 | 品牌和标题显示在画面左上角，结尾提示显示在底部，全片持续显示。预览中的位置仅供参考，以合成后的成片为准。 |
| `ip/studio-work-editor.tsx:194` | 这份成片在高级编辑里改过 | 此成片已在高级编辑中修改 |
| `ip/studio-work-editor.tsx:195` | 上次保存 ${formatDateTime(draft.advanced.savedAt)}，在高级编辑里导出成片。上面的设置不再生效。` : "高级编辑要在电脑上打开 | 上次保存于 ${formatDateTime(draft.advanced.savedAt)}，请在高级编辑中导出成片，以上设置不再生效。` : "高级编辑仅支持电脑版 |
| `ip/studio-work-editor.tsx:199` | {p.advancedAvailable ? "掐头去尾、切开、加文字和字幕，再导出" : "高级编辑要在电脑上打开"} | {p.advancedAvailable ? "裁剪、分割、添加文字和字幕后导出" : "高级编辑仅支持电脑版"} |
| `ip/studio-work-editor.tsx:201` | included.length ? "时长读取中" : "还没选片段 | included.length ? "时长加载中" : "未选择片段 |
| `ip/studio-work-editor.tsx:202` | {blocked ? <span className="is-error">{blocked}</span> : <span>{p.mock ? "测试响应，不产生模型费用" : "合成不收模型积分"}</span>} | {blocked ? <span className="is-error">{blocked}</span> : <span>{p.mock ? "测试响应，不产生模型费用" : "合成不消耗积分"}</span>} {!p.advancedAvailable && <span>高级编辑仅支持电脑版</span>} |
| `ip/studio-work-editor.tsx:214` | 合成好的作品"><h3>合成好的作品</h3> | 已合成的作品"><h3>已合成的作品</h3> |
| `ip/studio-work-editor.tsx:216` | <p>正在合成，可以先回画布继续做。</p> | <p>合成中，可返回画布继续创作。</p> |
| `ip/studio-work-editor.tsx:273` | 勾选片段后，在这里连续看一遍 | 勾选片段后可在此连续预览 |
| `ip/studio-work-editor.tsx:282` | 正在单独看「{soloName}」，它不在成片里。 | 正在单独预览「{soloName}」，此片段未加入成片。 |
| `ip/studio-work-editor.tsx:282` | >回到成片预览</button> | >返回成片预览</button> |
| `ip/studio-work-editor.tsx:288` | 从第 ${i + 1} 段开始看 | 从第 ${i + 1} 段开始预览 |
| `ip/studio-work-editor.tsx:292` | 这里播的是一键成片的顺序。高级编辑里剪过的版本，请在高级编辑里播放。 | 此处按一键成片的顺序播放。高级编辑中剪辑的版本，请在高级编辑中播放。 |
| `ip/studio-work-editor.tsx:293` | 预览把勾选的片段按顺序连着放${voice ? "，配音跟着一起放" : ""}。合成后的画面和文字以成片为准。 | 预览按顺序连续播放勾选的片段${voice ? "，并同步播放配音" : ""}。画面和文字以合成后的成片为准。 |
| `ip/studio-workspace.tsx:563` | 原剧本正在生成，请等待完成后编辑 | 原剧本生成中，请等待完成后编辑 |
| `ip/studio-workspace.tsx:607` | 已按描述改好设置，请确认费用后再生成。 | 已按描述更新设置，请确认费用后生成。 |
| `ip/studio-workspace.tsx:693` | 上次用的模型已不可用，请换一个模型再生成。 | 上次使用的模型已不可用，请更换模型后生成。 |
| `ip/studio-workspace.tsx:814` | 还有一项操作在提交，稍等一下再导出 | 有操作正在提交，请稍后导出 |
| `ip/studio-workspace.tsx:817` | 高级编辑里的剪辑（裁剪、文字、音轨等）会丢掉，已经导出的作品不受影响。 | 高级编辑中的剪辑（裁剪、文字、音轨等）将被清除，已导出的作品不受影响。 |
| `ip/studio-workspace.tsx:886` | 上次用的模型已不可用，这次改用 | 上次使用的模型已不可用，已改用 |
| `ip/studio-workspace.tsx:947` | 这个模型只支持一张首帧图，请移除多余素材或切回支持首尾帧 / 全能参考的模型 | 当前模型只支持一张首帧图，请移除多余素材，或改用支持首尾帧 / 全能参考的模型 |
| `ip/studio-workspace.tsx:1017` | 这个模型不支持所选视频模式，请重新选择 | 当前模型不支持所选视频模式，请重新选择 |
| `ip/studio-workspace.tsx:1068` ×2 | AI 处理，会消耗积分 | AI 处理，将消耗积分 |
| `ip/studio-workspace.tsx:1107` | 口型片段已提取，原始对照视频保留在版本中；未再次扣积分 | 口型片段已提取，原始对照视频保留在版本中，未额外扣除积分。 |
| `ip/studio-workspace.tsx:1107` | ；未再次扣积分 | ，未额外扣除积分 |
| `ip/studio-workspace.tsx:1127` | 把这个节点带进对话，让助手修改或继续制作 | 将此节点加入对话，由助手修改或继续制作 |
| `ip/studio-workspace.tsx:1162` | <p>此次只改写{ | <p>本次仅改写{ |
| `ip/studio-workspace.tsx:1169` | >改成 {durationIssue.fix} 秒< | >改为 {durationIssue.fix} 秒< |
| `ip/studio-workspace.tsx:1202` | ${quote} 积分 · 优化另需少量积分 | ${quote} 积分。优化提示词按实际用量另计。 |
| `ip/studio-workspace.tsx:1202` | 模型计费未配置 | 模型暂不可用 |
| `ip/studio-workspace.tsx:1215` | 点击画布素材添加参考，完成后点击“完成参考选择”。 | 点击画布素材添加参考，完成后点击「完成参考选择」。 |
| `ip/studio-workspace.tsx:1240` | 和助手说一句，它会把每一步放进画布 | 描述需求，助手会把每一步放进画布 |
| `ip/studio-workspace.tsx:1358` | >按描述改设置< | >按描述修改设置< |
| `ip/studio-workspace.tsx:1359` | <p>描述里写的是 { | <p>描述中写的是 { |
| `ip/studio-workspace.tsx:1359` | ，现在的设置是 { | ，当前设置是 { |
| `ip/studio-workspace.tsx:1360` | 模型按设置出片，描述里的规格不会自动生效。改设置后费用可能变化，会先给你看新的费用。 | 模型按设置生成视频，描述中的规格不会自动生效。修改设置后费用可能变化，确认前会显示新费用。 |

### 同步改的测试（32 个文件，断言跟随新文字；按钮名、role 名直接换新名字）
`canvas-bridge/`：generation、project-sync、signed-media、studio-batch、studio-linked-inputs、studio-node-failure、studio-video-prompt、studio-video、studio-work-clips、video。
`ip/`：audio-recorder-dialog、canvas-conflict-dialog、canvas-conflict-wiring、studio-batch-panel、studio-billing-dialog（改为断言不出现冻结数字）、studio-canvas-guide、studio-effect-library、studio-failure-recovery、studio-flow-area.interaction、studio-flow-card-failure、studio-flow-card、studio-flow-video-frames、studio-flow-video-upload、studio-frame-crop-hint、studio-motion-prompt、studio-script-editor、studio-speech（改为断言显示单价、不出现「预冻结」）、studio-task-list、studio-video-prompt-notes、studio-video-prompt-wiring、studio-work-editor（加了可见原因的断言）、studio-workspace。

### 改了行为的（都是决定里写明的）
- `ip/studio-speech.tsx`：按秒计费按钮显示单价，状态行不再出现冻结上限；提交的 `maxCost` 不变。
- `ip/studio-billing-dialog.tsx:65`：文字任务不再显示「本次最多冻结 N 积分」，两个分支合成一句。余额校验仍用 `expected`，没动。
- `ip/studio-task-list.tsx`：时间改用 `formatDateTime()`，显示完整 `yyyy-MM-dd HH:mm:ss`（原来没有年份）。任务行变长一点。
- `ip/studio-work-editor.tsx`（#7）：「按片段填写时间」不能点时，输入框上方加一行 `studio-work-note`；「高级编辑」不可用时（只有手机形态）在操作栏说明里加一行。
- `canvas-bridge/project-sync.ts`：另存画布名后缀改「· 副本」。已 `git grep`，没有比较逻辑，只有一条测试断言。

## 存疑项选了哪种写法

1. **「上次发给模型」**：选 A，菜单项保留这个短名字（用户能看懂），弹窗标题改「上次实际发送给模型的内容」。
2. **按秒计费的配音按钮**：已由决定定了，照做。
3. **H3 价格后缀**：已由 #12 定了。按钮旁价格是「{quote} 积分。优化提示词按实际用量另计。」，开关悬停是「生成前按 H3 官方写法优化提示词，台词保留原文。优化提示词按实际用量另计。点击关闭」。
4. **局部重绘弹窗按钮**：选 A「下一步」。点了只是打开生成面板确认费用，不会直接生成。
5. **「改回一键成片」**：选 A，保留。「一键成片」是页面上真实的模式名，和「高级编辑」相对。
6. **发布弹窗里的库名**：选 A，标题保留「发布到数字资产库」；按钮按 #9 写「在资产中查看」。说明里「各条业务线」改成「可在创作中引用」，这句比原表的「可在各业务中引用」更贴近用户看到的东西。
7. **`ip/studio-frame-crop-hint.tsx`、时长修正按钮**：表里没写，一并把「改成 1:1」「改成 12 秒」改成「改为…」。文档有引用，见上。

---

# 第 4B 批 · 创作助手

路径相对 `apps/web-aiavatar/src/`。`{x}` 是插值。

| 位置 | 原文 | 改为 |
|---|---|---|
| `ip/studio-assistant.tsx:88` | 现在按「{x}」做。按你说的话自动选择；有制作在进行时保持不变，想换做法可以开一段新对话。 | 现在按「{x}」做。会按你说的内容自动选择做法。 |
| `ip/studio-assistant.tsx:89` | 按你说的话自动选择做法。 | 会按你说的内容自动选择做法。 |
| `ip/studio-assistant.tsx:102` | {names}都能做，选一个就按它发送 | {names}都适用，请选择一种做法后发送 |
| `ip/studio-assistant.tsx:102` | 选一种做法，就按它发送 | 请选择一种做法后发送 |
| `ip/studio-assistant.tsx:109` | 积分超出上限，还差 {n} 积分，提高上限后再发 | 积分超出上限，还差 {n} 积分，提高上限后可发送 |
| `ip/studio-assistant.tsx:109` | 积分超出上限，提高上限后再发 | 积分超出上限，提高上限后可发送 |
| `ip/studio-assistant.tsx:128`（注释） | 「换一个」 | 「返回」 |
| `ip/studio-assistant.tsx:302` | 附件已保存，可以发送了 | 附件已保存 |
| `ip/studio-assistant.tsx:308` | 先写下你想做的 | 请输入要做的内容 |
| `ip/studio-assistant.tsx:308` | 附件还在导入 | 附件导入中… |
| `ip/studio-assistant.tsx:309` | 附件还没保存好，保存后才能发送 | 附件未保存，保存后可发送 |
| `ip/studio-assistant.tsx:309` | 有引用已从画布删除，请先移除 | 部分引用已从画布删除，请移除后发送 |
| `ip/studio-assistant.tsx:325` | 对话计费配置已更新，原消息已保留，再点一次发送。 | 对话计费已更新，原消息已保留，请重新发送。 |
| `ip/studio-assistant.tsx:448` | 画布已变化，稍后重试 | 画布已更新，请稍后重试 |
| `ip/studio-assistant.tsx:566`（注释） | 「就用这版」/「重做这一段」 from check nodes | 「采用此版本」/「重新生成」 from check nodes |
| `ip/studio-assistant.tsx:574` | 找不到这一段的视频，请在画布上选中它再重新生成 | 找不到此片段的视频，请在画布上选中后重新生成 |
| `ip/studio-assistant.tsx:580` | 这一段不属于正在进行的制作，无法记下采用 | 此片段不属于当前制作，无法采用 |
| `ip/studio-assistant.tsx:583` | 找不到这一段对应的制作步骤，请刷新后重试 | 找不到此片段对应的制作步骤，请刷新后重试 |
| `ip/studio-assistant.tsx:585` | 已采用这一版 | 已采用此版本 |
| `ip/studio-assistant.tsx:596` | 这个节点正在生成或不能编辑，请稍后再采用 | 此节点正在生成或不可编辑，请稍后采用 |
| `ip/studio-assistant.tsx:599` | 你改过这段内容，没有覆盖 | 此内容已被修改，未覆盖 |
| `ip/studio-assistant.tsx:610` | 方案已更新，请看最新的报价 | 方案已更新，请查看最新报价 |
| `ip/studio-assistant.tsx:634` | 画布上已经有这段文字 | 画布上已有这段文字 |
| `ip/studio-assistant.tsx:661` | 请先完成前置内容，再继续这一步 | 请完成前置步骤后继续 |
| `ip/studio-assistant.tsx:672` | 请先填写修改后的内容 | 请填写修改后的内容 |
| `ip/studio-assistant.tsx:678` | 请先填写文字内容 | 请填写文字内容 |
| `ip/studio-assistant.tsx:686` | 文字已放入画布 | 文字已放进画布 |
| `ip/studio-assistant.tsx:698` | 对话未完成 | 对话失败 |
| `ip/studio-assistant.tsx:723`（注释） | 「换一个」: back to the four cards | 「返回」: back to the four cards |
| `ip/studio-assistant.tsx:771` | 连接中断，正在重连 | 连接已断开，正在重新连接… |
| `ip/studio-assistant.tsx:771` | 实时更新暂时不可用，每隔几秒刷新一次 | 实时更新暂不可用，将每隔几秒自动刷新。 |
| `ip/studio-assistant.tsx:781` | 按所选素材出一张新图 | 按所选素材生成一张新图 |
| `ip/studio-assistant.tsx:783` | 从这些节点往下搭 | 规划后续的文字、图片和视频 |
| `ip/studio-assistant.tsx:787` | 照参考视频的节奏，换成你的商品 | 按参考视频的节奏，换成你的商品 |
| `ip/studio-assistant.tsx:788` | 搭一套创作流程 / 从设定图一路做到视频 | 搭建创作流程 / 从人物设定到场景视频 |
| `ip/studio-assistant.tsx:793` | 说想法 / 一句话说清要做什么，用 @ 引用画布上的素材。 | 描述需求 / 一句话写明要做的内容，用 @ 引用画布上的素材。 |
| `ip/studio-assistant.tsx:794` | 看方案 / 我列出要生成的内容和要花的积分，等你确认。 | 确认方案 / 助手列出要生成的内容和所需积分，由你确认。 |
| `ip/studio-assistant.tsx:795` | 开始做 / 结果一步步放进画布，中途随时可以插话或停下。 | 开始制作 / 结果会逐步放进画布，制作中可随时补充要求或停止。 |
| `ip/studio-assistant.tsx:797` | 全能创作：按你说的话和素材自动选择做法。 | 全能创作：会按你说的内容和素材自动选择做法。 |
| `ip/studio-assistant.tsx:832` | 想改哪里，直接说 | 输入修改意见或新的需求 |
| `ip/studio-assistant.tsx:838` | 正在读取这张画布的对话 | 正在加载对话… |
| `ip/studio-assistant.tsx:839` | 对话没有读取成功。 | 对话加载失败。 |
| `ip/studio-assistant.tsx:839` | 重新读取 | 重试 |
| `ip/studio-assistant.tsx:828`（#7 新增可见原因，模型胶囊旁；回复进行中才显示） | （原因只在悬停说明） | 本轮结束后可切换 |
| `ip/studio-assistant-plan.tsx:64` | 为你准备好了 | 创作结果 |
| `ip/studio-assistant-plan.tsx:71` | 编辑生成描述 | 编辑提示词 |
| `ip/studio-assistant-plan.tsx:73` | 先完成「{names}」，再继续这一步。 | 请完成「{names}」后继续此步骤。 |
| `ip/studio-assistant-plan.tsx:74` | 这一步需要补选参考素材，打开后请选择实际节点。 | 此步骤缺少参考素材，打开后请选择对应节点。 |
| `ip/studio-assistant-plan.tsx:79` | 已放入画布 | 已放进画布 |
| `ip/studio-assistant-plan.tsx:79` | 已放入画布 / 放入画布 / 打开节点继续创作 | 已放进画布 / 放进画布 / 打开节点 |
| `ip/studio-assistant-plan.tsx:81` | 节点生成未完成，请打开查看原因。 | 节点生成失败，请打开查看原因。 |
| `ip/studio-assistant-plan.tsx:82` | 先创建节点并确认参数，生成时再扣积分。 | 创建节点后确认参数，生成时扣积分。 |
| `ip/studio-assistant-plan.tsx:131` | 查看描述 | 查看提示词 |
| `ip/studio-assistant-starters.tsx:47` | 还差照片 | 请添加照片 |
| `ip/studio-assistant-starters.tsx:48` | 正脸清晰、光线均匀、只有一个人，效果最好。只用本人或已获授权的照片。 | 建议使用正脸清晰、光线均匀的单人照片。仅限本人或已获授权的照片。 |
| `ip/studio-assistant-starters.tsx:50` | 要出的图 | 图片类型 |
| `ip/studio-assistant-starters.tsx:55` | 比如：外卖员送错一单，意外救了老板的女儿 | 例如：外卖员送错一单，意外救了老板的女儿 |
| `ip/studio-assistant-starters.tsx:55` | 先写一句梗概 | 请填写梗概 |
| `ip/studio-assistant-starters.tsx:61` | 比如：女孩在海边回头微笑，风吹起围巾 | 例如：女孩在海边回头微笑，风吹起围巾 |
| `ip/studio-assistant-starters.tsx:61` | 先写画面描述 | 请填写画面描述 |
| `ip/studio-assistant-starters.tsx:62` | 首帧图只要 1 张 | 首帧图仅限 1 张 |
| `ip/studio-assistant-starters.tsx:68` | 还差参考视频 / 参考视频只要 1 条 | 请添加参考视频 / 参考视频仅限 1 条 |
| `ip/studio-assistant-starters.tsx:69` | 换进去的商品或人物 | 替换的商品或人物 |
| `ip/studio-assistant-starters.tsx:69` | 还差商品或人物图 | 请添加商品或人物图 |
| `ip/studio-assistant-starters.tsx:74` | 要讲的卖点 / 比如：保温 12 小时，一键开盖 | 卖点 / 例如：保温 12 小时，一键开盖 |
| `ip/studio-assistant-starters.tsx:78` | 真人照片变成数字形象，出多角度设定图 | 用真人照片生成数字形象和多角度设定图 |
| `ip/studio-assistant-starters.tsx:83` | 一句梗概写成能拍的分场剧本 | 根据一句梗概写出可拍摄的分场剧本 |
| `ip/studio-assistant-starters.tsx:89` | 做个短视频 / 一句描述出视频，也可以从一张图动起来 | 生成短视频 / 根据描述生成视频，也可以用一张图作首帧 |
| `ip/studio-assistant-starters.tsx:96` | 照爆款的节奏和镜头，换成你的商品或人物 | 按爆款视频的节奏和镜头，换成你的商品或人物 |
| `ip/studio-assistant-starters.tsx:125` | 先写{x} | 请填写{x} |
| `ip/studio-assistant-starters.tsx:172` | 换一个 | 返回 |
| `ip/studio-assistant-starters.tsx:182` | 已选好 | 已选择 |
| `ip/studio-assistant-starters.tsx:183` | 还缺 / 选填 | 待补充 / 选填 |
| `ip/studio-assistant-starters.tsx:187` | 去掉 {x} / 去掉 | 移除 {x} / 移除 |
| `ip/studio-assistant-starters.tsx:208` | 还缺 | 待补充 |
| `ip/studio-assistant-starters.tsx:209`（注释） | 写剧本, 做个短视频 | 写剧本, 生成短视频 |
| `ip/studio-assistant-starters.tsx:217` | 点“按选项重写”可使用当前选择。 | 点击「按选项重写」可使用当前选择。 |
| `ip/studio-assistant-starters.tsx:223` | 用上面的选项重新写输入框里的话 | 按当前选项重写输入框中的内容 |
| `ip/studio-conversation-public.tsx:32` | 暂时无法打开对话 | 对话加载失败 |
| `ip/studio-conversation-public.tsx:32` | 进入 Studio | 进入 IP Studio |
| `ip/studio-conversation-public.tsx:36` | 正在复制对话 / 在 Studio 中继续创作 | 正在复制对话… / 在 IP Studio 中继续创作 |
| `ip/studio-conversation-public.tsx:36` | 进入 Studio | 进入 IP Studio |
| `app/shared/conversations/[token]/page.tsx:3` | 对话分享 · AI IP Studio | 对话分享 · IP Studio |
| `ip/studio-conversation-share.tsx:25` | 已撤销，原链接无法再查看 | 已撤销分享，原链接已失效 |
| `ip/studio-conversation-share.tsx:26` | 分享链接已创建，可复制后发送 | 分享链接已创建 |
| `ip/studio-conversation-share.tsx:32` | 预览并分享这次对话 | 预览并分享此对话 |
| `ip/studio-conversation-share.tsx:32`（#7 新增可见原因，分享按钮左侧） | （原因只在悬停说明） | 完成一轮对话后可分享 |
| `ip/studio-conversation-transcript.tsx:5` | Studio（作者标签） | IP Studio |
| `ip/studio-dialogue-approval.tsx:57` | 新的上限至少要 {x} 积分 | 新上限不能低于 {x} 积分 |
| `ip/studio-dialogue-approval.tsx:68` | 这次会做 | 本次制作内容 |
| `ip/studio-dialogue-approval.tsx:79` | 已有新的报价，见下方 | 已有新报价，请查看下方。 |
| `ip/studio-dialogue-approval.tsx:84` | 新的上限 | 新上限 |
| `ip/studio-dialogue-approval.tsx:89` | 方案还没到，稍等一下 | 正在加载方案… |
| `ip/studio-dialogue-approval.tsx:92` | 先改改 | 修改方案 |
| `ip/studio-dialogue-approval.tsx:95` | 现在再查一次 | 立即核对 |
| `ip/studio-dialogue-check.tsx:3`（注释） | Choosing 「就用这版」 records | Choosing 「采用此版本」 records |
| `ip/studio-dialogue-check.tsx:4`（注释） | never turns a 没通过 / 无法判断 into 通过; 「重做这一段」 opens | never turns a 未通过 / 无法判断 into 通过; 「重新生成」 opens |
| `ip/studio-dialogue-check.tsx:11` | 没通过 | 未通过 |
| `ip/studio-dialogue-check.tsx:18` | 正在检查，结果出来后显示在这里。 | 检查中，结果将显示在这里。 |
| `ip/studio-dialogue-check.tsx:22` | 看了 {times} 的画面 | 已检查 {times}处的画面 |
| `ip/studio-dialogue-check.tsx:32` | 采用这一版 | 采用此版本 |
| `ip/studio-dialogue-check.tsx:32` | 就用这版 | 采用此版本 |
| `ip/studio-dialogue-check.tsx:33` | 打开这一段的生成设置 | 打开此片段的生成设置 |
| `ip/studio-dialogue-check.tsx:33` | 重做这一段 | 重新生成 |
| `ip/studio-dialogue-composer.tsx:72` | 已删除的画布对象 | 已删除的节点 |
| `ip/studio-dialogue-composer.tsx:80` | 说说要做什么，输入 @ 引用画布内容 | 描述要做的内容，输入 @ 引用画布内容 |
| `ip/studio-dialogue-execution.tsx:14` | 等你确认 / 已完成 / 部分完成 / 没有完成 | 待确认 / 已完成 / 部分完成 / 失败 |
| `ip/studio-dialogue-execution.tsx:15` | 等前面做完 / 已提交 / 进行中 / 等你确认 / 已完成 / 已跳过 / 没有完成 | 等待中 / 已提交 / 进行中 / 待确认 / 已完成 / 已跳过 / 失败 |
| `ip/studio-dialogue-execution.tsx:19` | 没通过 {x} 项 | 未通过 {x} 项 |
| `ip/studio-dialogue-execution.tsx:20` | 没有检查项 | 无检查项 |
| `ip/studio-dialogue-execution.tsx:50` | 停止这次制作？ / 还没开始的会取消，已经在生成的会做完。 / 停止制作 / 再想想 | 停止制作？ / 未开始的步骤将取消，生成中的任务会继续完成。 / 停止制作 / 取消 |
| `ip/studio-dialogue-execution.tsx:68` | ，排在队列第 {x} 位 | · 排队第 {x} 位 |
| `ip/studio-dialogue-execution.tsx:69` | 已暂停，已经提交的任务会做完 | 已暂停，已提交的任务将继续完成 |
| `ip/studio-dialogue-execution.tsx:80` | 已经提交的任务会做完，之后不再提交新的 | 已提交的任务将继续完成，之后不再提交新任务 |
| `ip/studio-dialogue-execution.tsx:82` | 加入这次制作，重新编排 | 加入并重新编排 |
| `ip/studio-dialogue-execution.tsx:83` | 不用它，重新编排 | 不使用并重新编排 |
| `ip/studio-dialogue-execution.tsx:84` | 重新提交没完成的那一步 | 重新提交失败的步骤 |
| `ip/studio-dialogue-execution.tsx:84` | 重试这一步 / 继续制作 | 重试 / 继续制作 |
| `ip/studio-dialogue-execution.tsx:89` | 未命名的对象 | 未命名 |
| `ip/studio-dialogue-execution.tsx:90` | 在画布上看 | 在画布上查看 |
| `ip/studio-dialogue-execution.tsx:99` | 等前面做完 / 已提交 / 生成中 / 等你确认 / 已跳过 / 没有完成 | 等待中 / 已提交 / 生成中 / 待确认 / 已跳过 / 失败 |
| `ip/studio-dialogue-execution.tsx:102`（注释） | 结果在画布上的给「在画布上看」 | 结果在画布上的给「在画布上查看」 |
| `ip/studio-dialogue-execution.tsx:107`（注释） | 「在画布上看」 selects and scrolls | 「在画布上查看」 selects and scrolls |
| `ip/studio-dialogue-execution.tsx:119` | 在画布上看 | 在画布上查看 |
| `ip/studio-dialogue-legacy.tsx:30` | Studio（作者标签） | IP Studio |
| `ip/studio-dialogue-legacy.tsx:35` | 当时没确定的问题 | 未确定的问题 |
| `ip/studio-dialogue-legacy.tsx:36` | 填进输入框，可以改完再发 | 填入输入框，修改后发送 |
| `ip/studio-dialogue-legacy.tsx:38` | 正在确认原来的任务 / 这段对话的任务还没确认结果 | 正在确认原任务… / 此对话的任务结果待确认 |
| `ip/studio-dialogue-legacy.tsx:39` | 确认原对话任务 | 确认原任务 |
| `ip/studio-dialogue-message.tsx:79` | 你改过这段内容，这份修改稿不再适用 | 此内容已被修改，修改稿不再适用 |
| `ip/studio-dialogue-message.tsx:111` | 没有确认 | 未确认 |
| `ip/studio-dialogue-message.tsx:131` | 这一轮没有执行的操作原文 | 本轮未执行的操作原文 |
| `ip/studio-dialogue-message.tsx:205` | Studio 的回复 / 系统消息 | IP Studio 的回复 / 系统消息 |
| `ip/studio-dialogue-message.tsx:206` | Studio（作者标签） | IP Studio |
| `ip/studio-dialogue-message.tsx:212` | 去申请企业充值 / 去充值 | 申请企业充值 / 充值 |
| `ip/studio-dialogue-message.tsx:213` | 已删除的画布对象 | 已删除的节点 |
| `ip/studio-dialogue-message.tsx:218` | 没有完成，换个说法再试试 | 回复失败，请重试或调整描述。 |
| `ip/studio-dialogue-message.tsx:232` | 把这段回复放进画布，成为一个文字节点 | 将此回复作为文字节点放进画布 |
| `ip/studio-dialogue-message.tsx:236` | 从这条消息另开一段对话，原来的对话保留 | 从此消息新建一段对话，原对话保留 |
| `ip/studio-dialogue-question.tsx:9` | 直接发出这句 | 发送此回复 |
| `ip/studio-dialogue-session.tsx:70` | 这段对话还在进行，等它做完或先停止 | 当前对话进行中，完成或停止后可切换 |
| `ip/studio-dialogue-session.tsx:79` | 正在切换对话，请稍等 | 正在切换对话… |
| `ip/studio-dialogue-session.tsx:81` | 正在核对确认结果，请稍等 | 正在核对确认结果… |
| `ip/studio-dialogue-session.tsx:264` | 对话还没准备好，请稍后再发 | 正在加载对话，请稍后发送 |
| `ip/studio-dialogue-session.tsx:414` | 已离开这段对话，确认结果没有核对完 | 已离开此对话，确认结果尚未核对完成 |
| `ip/studio-dialogue-session.tsx:430` | 找不到这次报价对应的方案，请刷新后重试 | 找不到此报价对应的方案，请刷新后重试 |
| `ip/studio-dialogue-skill-draft.tsx:2`（注释） | // 「把这次制作整理成技能草稿」 under an execution | // 「整理成技能草稿」 under an execution |
| `ip/studio-dialogue-skill-draft.tsx:71` | 整理要用的模型还没有定价，请联系运营在后台配置后再试 | 整理所用的模型未定价，请在后台配置后重试。 |
| `ip/studio-dialogue-skill-draft.tsx:73` | 把这次制作整理成技能草稿？ | 将本次制作整理成技能草稿？ |
| `ip/studio-dialogue-skill-draft.tsx:74`（#2） | 会读这次制作的方案、步骤和检查结果，整理成一份做法草稿，素材和画布内容不会带进去。最多 {n} 积分。草稿要管理员在后台审阅、发布后才会生效。 | 将读取本次制作的方案、步骤和检查结果，整理成做法草稿，不包含素材和画布内容。按实际用量结算。草稿需管理员在后台审阅并发布后生效。 |
| `ip/studio-dialogue-skill-draft.tsx:75` | 开始整理 / 再想想 | 开始整理 / 取消 |
| `ip/studio-dialogue-skill-draft.tsx:79` | 只有运营账号可以把制作整理成技能草稿。 | 仅运营账号可整理技能草稿。 |
| `ip/studio-dialogue-skill-draft.tsx:84` | 已存成技能草稿 v{n}，去掉了 {m} 处素材引用。 | 已保存为技能草稿 v{n}，已移除 {m} 处素材引用。 |
| `ip/studio-dialogue-skill-draft.tsx:84` | 技能草稿已经整理好。 | 技能草稿已生成。 |
| `ip/studio-dialogue-skill-draft.tsx:85` | 要管理员在后台审阅、发布后才会生效，现在的对话不受影响。本次用了 {n} 积分。 | 需管理员在后台审阅并发布后生效，不影响当前对话。本次消耗 {n} 积分。 |
| `ip/studio-dialogue-skill-draft.tsx:87` | 没有整理成功 | 整理失败 |
| `ip/studio-dialogue-skill-draft.tsx:88` | 整理出的草稿要管理员审阅后才会发布，不会直接改变任何人的对话 | 草稿需管理员审阅后发布，不影响任何对话 |
| `ip/studio-dialogue-skill-draft.tsx:89` | 把这次制作整理成技能草稿 | 整理成技能草稿 |
| `ip/studio-dialogue-threads.tsx:18` | 现在就是新对话 | 当前已是新对话 |
| `ip/studio-dialogue-threads.tsx:81` | 开始一段新的对话，这一段留在历史里 | 新建对话，当前对话保留在历史对话中 |
| `ip/studio-dialogue-threads.tsx:85` | 正在读取对话列表 | 正在加载对话列表… |
| `ip/studio-dialogue-threads.tsx:86` | 对话列表没有读取成功。 | 对话列表加载失败。 |
| `ip/studio-dialogue-threads.tsx:94` | 正在看的这段对话 / 打开这段对话 | 当前对话 / 打开此对话 |
| `ip/studio-dialogue-threads.tsx:106` | 还没有别的对话 | 暂无其他对话。 |
| `ip/studio-dialogue-threads.tsx:112`（#7 新增可见原因，头部两个图标左侧） | （原因只在悬停说明） | 暂不可切换 / 已是新对话 |
| `ip/studio-dialogue-timeline.tsx:21` | 这是从一条消息新开的对话，原来的对话保持不变。查看原来的对话 | 此对话从一条消息重新开始，原对话保持不变。查看原对话 |
| `ip/studio-dialogue-timeline.tsx:22` | 正在读取 | 正在加载… |
| `ip/studio-dialogue-timeline.tsx:66` | 正在读取 / 查看更早的消息 | 正在加载… / 查看更早的消息 |
| `ip/studio-dialogue-timeline.tsx:77` | 没有确认送达 | 未确认送达 |
| `ip/studio-dialogue-timeline.tsx:78` | 重新发送这条消息，不会重复 | 重新发送此消息，不会重复发送 |
| `ip/studio-dialogue-tool.tsx:16` | 制作视频 / 制作图片 | 生成视频 / 生成图片 |
| `ip/studio-dialogue-tool.tsx:18` | 处理一项任务 | 处理任务 |
| `ip/studio-dialogue-tool.tsx:56` | 已停止 / 没有完成 / 没有完成 / 完成 | 已停止 / 失败 / 失败 / 已完成 |
| `ip/studio-dialogue-tool.tsx:59` | 这次没有整理出能用的方案，换个说法再试试。 | 未能生成可用方案，请调整描述后重试。 |
| `ip/studio-dialogue-tool.tsx:68` | 这一步没有完成，可以稍后重试 | 此步骤失败，请稍后重试。 |
| `ip/studio-dialogue-tool.tsx:75` | 这一步没有完成，可以稍后重试 | 此步骤失败，请稍后重试。 |
| `ip/studio-dialogue-tool.tsx:76` | 这一步没有完成 | 此步骤失败 |
| `canvas-bridge/studio-assistant-context.ts:26` | 暂时无法读取 PDF / Word，请稍后重试 | PDF / Word 文件读取失败，请稍后重试 |
| `canvas-bridge/studio-plan-execution.ts:276` | 这一段没有完成 | 生成失败 |
| `canvas-bridge/studio-plan-execution.ts:283`（注释） | the accept target for 「就用这版」 | the accept target for 「采用此版本」 |
| `canvas-bridge/studio-plan-execution.ts:288`（注释） | /** 「就用这版」/「重做这一段」 from a check node | /** 「采用此版本」/「重新生成」 from a check node |
| `ip/mocks/studio-dialogue.ts:142` | 这个技能已经停用了，换一个再发 | 该技能已停用，请选择其他做法 |
| `ip/mocks/studio-dialogue.ts:401` | 等你确认制作方案 | 待确认制作方案 |
| `ip/mocks/studio-dialogue.ts:415` | 制作第 {x} 段 | 生成第 {x} 段 |
| `ip/mocks/studio-dialogue.ts:416` | 已提交，等待出片 | 已提交，等待生成 |
| `ip/mocks/studio-dialogue.ts:418` | 第 {x} 段出片 1 条 | 第 {x} 段已生成 1 条 |
| `ip/mocks/studio-dialogue.ts:853` | 分析还没有完成，请先确认分析 | 分析尚未完成，完成后可确认制作 |
| `ip/mocks/studio-dialogue.ts:874` | 这个方案要先确认分析，再确认制作 | 此方案需确认分析后再确认制作 |
| `ip/mocks/studio-dialogue.ts:875` | 上一次制作还没结束，结束后再开始新的 | 上一次制作尚未结束，结束后可开始新制作 |
| `ip/mocks/studio-dialogue.ts:1036` | 找不到这次制作，刷新后再试 | 找不到本次制作，请刷新后重试 |
| `ip/mocks/studio-dialogue.ts:1037` | 这次制作还没做完，做完再整理 | 本次制作尚未完成，完成后可整理 |
| `ip/studio-assistant.tsx:308`、`:765` | 对话还在加载，请稍等 | 正在加载对话… |
| `ip/studio-assistant.tsx:308`、`:765` | 正在切换对话，请稍等 | 正在切换对话… |
| `ip/studio-assistant.tsx:833`（两处） | 部分引用已从画布删除，请移除后重新选择 | 部分引用已从画布删除，请移除后发送 |
| `ip/mocks/studio-dialogue.ts:960`、`:966`、`:978` | 找不到这次制作 | 找不到本次制作 |
| `ip/studio-conversation-public.tsx:30` | AI IP Studio | IP Studio |
| `ip/studio-conversation-public.tsx:33`（#10） | new Date(view.createdAt).toLocaleString('zh-CN') | formatDateTime(view.createdAt) |
| `ip/studio-dialogue-threads.tsx:84`（#7） | 历史对话弹层只写忙碌原因 | 同时写「当前已是新对话」 |
| `styles/ip-studio-workflow.css:989`、`:1036`、`:1048`（注释） | 在画布上看 / 先改改 | 在画布上查看 / 修改方案 |

### 测试同步（都已跑过）
按钮和 role 名直接改成新名字：`ip/studio-assistant.test.tsx`、`ip/studio-assistant-starters.test.ts`、`ip/studio-dialogue-check.test.tsx`、`ip/studio-dialogue-execution.test.tsx`、`ip/studio-dialogue-message.test.tsx`（核对提示改用常量 `DIALOGUE_VERIFYING`）、`ip/studio-dialogue-threads.test.tsx`、`ip/studio-dialogue-session.test.tsx`（用例名）、`ip/studio-dialogue-wiring.test.ts`、`ip/studio-conversation-public.test.tsx`、`ip/studio-conversation-share.test.tsx`。
新增断言：技能草稿确认框写「按实际用量结算」且不含上限数字；`暂不可切换`、`已是新对话`、`完成一轮对话后可分享` 真的显示。

### 逻辑依赖核查
改之前 `git grep` 过改动的字符串：没有 `===`、`.includes(`、正则、`startsWith` 依赖。`toolTitle` 的 `startsWith('正在')` 只判前缀，新工具名照常拼成「正在生成视频」。`DIALOGUE_*` 常量在代码和测试里都按常量引用。填空卡 `compose` 拼的句子、`phrase`、`startWith(...)` 的句子、快捷答复、mock 里的助手回复和 suggestions 都没动。`maxCost` 仍照发给服务端（只是确认框不显示），行为没变。

## 存疑项选了哪种写法

- **使用说明三步标题**：选 B，「描述需求 / 确认方案 / 开始制作」。和「开始制作」按钮一致。
- **填空卡标题**：选 A，「生成短视频」。文档要同步，见上。
- **方案标题悬停「按技能：X vN」**：选 A，保留。只在悬停里，用来查是哪一版技能。
- **作者标签**：选 A 保留「你 / 创作者」，单独的 Studio 按全站表改 IP Studio。
- **公开分享页品牌**：`AI IP Studio` 改 `IP Studio`（页面和 metadata 标题）。`components/hub/studio-home.tsx:84`、`:87` 也是 `AI IP Studio`，不归我。
- **旧表「需要核实」**：第 1 条按 #8 改；第 2 条按 #2 改；第 3 条按 #10 改；第 4 条见上面第 3 项；第 5 条（`studio-social-bind`）在 6-assets 的清单里，不归我。
- **新写的文字**（旧表没给或我改了写法）：`暂不可切换` / `已是新对话`（头部短原因，完整原因留在悬停）；`此对话从一条消息重新开始，原对话保持不变。查看原对话`（旧表写「分支而来」，界面上这个动作叫「从这里重新开始」）；`未能生成可用方案，请调整描述后重试。`；`首帧图仅限 1 张` / `参考视频仅限 1 条`；`已删除的节点`（原「已删除的画布对象」）；`编辑提示词` / `查看提示词`（按全站表，原「编辑生成描述 / 查看描述」）。

---

# 第 5 批 · 短剧导演台

#### ip/director/director-shared.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-shared.tsx | `这次操作是在作品删除期间发出的，没有生效。作品现在已恢复，请重新操作。` | `此操作在作品删除期间发出，未生效。作品现已恢复，请重新操作。` |
| ip/director/director-shared.tsx | `可以关闭页面，后台继续，完成后自动显示` | `可离开此页面，后台将继续处理，完成后自动显示` |

#### ip/director/director-pending.ts

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-pending.ts | `网络不稳定，发送状态还不确定。` | `网络不稳定，送达状态尚未确认。` |
| ip/director/director-pending.ts | `网络不稳定，这条消息的发送状态还不确定。内容已保留，再点发送会按原请求恢复，不会重复扣费。` | `网络不稳定，此消息的送达状态尚未确认。内容已保留，重新发送将按原请求恢复，不会重复扣费。` |

#### ip/director/director-asset-studio.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-asset-studio.tsx | `图片是空的，请重新选择` | `图片文件为空，请重新选择` |
| ip/director/director-asset-studio.tsx | `分镜图和视频直接用这张，不用 AI 生成、不扣积分` | `分镜图和视频将直接使用此图，不经 AI 生成，不消耗积分` |
| ip/director/director-asset-studio.tsx | `以后生成资产图时让 AI 参照它，现在不生成、不扣积分` | `生成资产图时由 AI 参照此图，上传时不生成，不消耗积分` |
| ip/director/director-asset-studio.tsx | `换用「${label}」的这版图` | `切换「${label}」的图片版本` |
| ip/director/director-asset-studio.tsx | `next: "资产图没有变。"` | `next: "资产图未更改。"` |
| ip/director/director-asset-studio.tsx | `"资产图没有变。换一张 PNG 或 JPG 图片再试。"` | `"资产图未更改，请更换 PNG 或 JPG 图片后重试。"` |
| ip/director/director-asset-studio.tsx | `原来的资产图留在历史版本里，随时可以点回去。` | `原资产图保留在历史版本中，可随时切换回来。` |
| ip/director/director-asset-studio.tsx | `已经生成的分镜图和视频不会自动重做，会标为「需更新」。` | `已生成的分镜图和视频不会自动重新生成，将标记为「需更新」。` |
| ip/director/director-asset-studio.tsx | `next: "图没有变。"` | `next: "图片未更改。"` |
| ip/director/director-asset-studio.tsx | `"图没有变。换一张 PNG 或 JPG 图片再试。"` | `"图片未更改，请更换 PNG 或 JPG 图片后重试。"` |
| ip/director/director-asset-studio.tsx | `改过的内容还在编辑框里，按原因调整后再点「保存」。` | `修改内容已保留，请按原因调整后点击「保存」。` |
| ip/director/director-asset-studio.tsx | `「${asset.name}」还用在 ${list.length} 个片段里，资产没有删除。` | `「${asset.name}」仍被 ${list.length} 个片段使用，资产未删除。` |
| ip/director/director-asset-studio.tsx | `点片段旁的「前往」，在打开的「关联资产」里点「{asset.name}」后面的「解除关联」。` | `点击片段旁的「前往」，在打开的「关联资产」中点击「{asset.name}」旁的「解除关联」。` |
| ip/director/director-asset-studio.tsx | `只在台词里出现的，在打开的「编辑镜头」里把这些台词的说话人换掉并保存。` | `仅在台词中出现的，请在打开的「编辑镜头」中更换这些台词的说话人并保存。` |
| ip/director/director-asset-studio.tsx | `都处理完后回到这里再删除。` | `处理完成后，返回此处删除。` |
| ip/director/director-asset-studio.tsx | `它的资产图版本会一起删除，不能恢复。` | `其资产图的所有版本将一并删除，删除后无法恢复。` |
| ip/director/director-asset-studio.tsx | `"这个形态还没有图"` | `"此形态暂无图片"` |
| ip/director/director-asset-studio.tsx | `"先生成主形象，形态照着它画"` | `"请先生成主形象，形态图将以其为参考"` |
| ip/director/director-asset-studio.tsx | `"这个视角还没有图"` | `"此视角暂无图片"` |
| ip/director/director-asset-studio.tsx | `"先生成主视图，其他视角照着它画"` | `"请先生成主视图，其他视角将以其为参考"` |
| ip/director/director-asset-studio.tsx | `ˋ${used} 个片段用这个形态ˋ` | `ˋ${used} 个片段使用此形态ˋ` |
| ip/director/director-asset-studio.tsx | `"还没有片段用这个形态"` | `"暂无片段使用此形态"` |
| ip/director/director-asset-studio.tsx | `ˋ${used} 个镜头用这个视角ˋ` | `ˋ${used} 个镜头使用此视角ˋ` |
| ip/director/director-asset-studio.tsx | `"还没有镜头用这个视角"` | `"暂无镜头使用此视角"` |
| ip/director/director-asset-studio.tsx | `"自己上传"` | `"已上传"` |
| ip/director/director-asset-studio.tsx | `再生成或上传一版后，可以在这里切换。` | `生成或上传新版本后，可在此切换。` |
| ip/director/director-asset-studio.tsx | `生成或上传后，每一版都留在这里。` | `生成或上传后，各版本保留在此。` |
| ip/director/director-asset-studio.tsx | `这项资产就是资产库里已有的那一项，直接用它的图` | `使用资产库中同一项资产的图片作为资产图` |
| ip/director/director-asset-studio.tsx | `"至少选一集"` | `"至少选择一集"` |
| ip/director/director-asset-studio.tsx | `还没指定出现的集，不改也能保存` | `尚未指定出现的集，可直接保存` |
| ip/director/director-asset-studio.tsx | `完善外观设定、出图提示词或音色，也能说说资产图哪里要改；生成新版本前会说清费用，原图保留` | `可完善外观设定、出图提示词或音色，也可说明资产图需修改之处；生成新版本前会显示费用，原图保留` |
| ip/director/director-asset-studio.tsx | `完善外观设定、出图提示词或音色，比如「更疲惫但别显老」` | `可完善外观设定、出图提示词或音色，例如「更疲惫但别显老」` |
| ip/director/director-asset-studio.tsx | `"没有片段在用"` | `"暂无片段使用"` |
| ip/director/director-asset-studio.tsx | `要删除这项资产，先在这些片段里解除关联（「前往」后在「关联资产」里操作）。` | `如需删除此资产，请先在这些片段中解除关联（点击「前往」，在「关联资产」中操作）。` |
| ip/director/director-asset-studio.tsx | `查看大图和这个视角的生成记录` | `查看大图和此视角的生成记录` |
| ip/director/director-asset-studio.tsx | `"还没有主视图"` | `"暂无主视图"` |
| ip/director/director-asset-studio.tsx | `填好的内容还在，按原因修改后再保存。` | `已填写的内容已保留，请按原因修改后保存。` |
| ip/director/director-asset-studio.tsx | `有 ${used} 个片段在用它，删除后这些片段回到主形象，已有的分镜图和视频会标为「需更新」。` | `有 ${used} 个片段正在使用此形态。删除后这些片段将改用主形象，已有的分镜图和视频将标记为「需更新」。` |
| ip/director/director-asset-studio.tsx | `它的图会一起删除，不能恢复。` | `其图片将一并删除，删除后无法恢复。` |
| ip/director/director-asset-studio.tsx | `"这个形态"` | `"此形态"` |
| ip/director/director-asset-studio.tsx | `换装、受伤、变身时用，不用另建一个角色` | `用于换装、受伤、变身等，无需另建角色` |
| ip/director/director-asset-studio.tsx | `next: "参考图没有变。"` | `next: "参考图未更改。"` |
| ip/director/director-asset-studio.tsx | `"参考图没有变。换一张 PNG 或 JPG 图片再试。"` | `"参考图未更改，请更换 PNG 或 JPG 图片后重试。"` |
| ip/director/director-asset-studio.tsx | `"已设置" : "可选"` | `"已设置" : "选填"` |
| ip/director/director-asset-studio.tsx | `ˋ生成资产图时照着它画${takes}ˋ` | `ˋ生成资产图时参照其${takes}ˋ` |
| ip/director/director-asset-studio.tsx | `ˋ生成资产图时让 AI 参照一张图（取${takes}）ˋ` | `ˋ生成资产图时由 AI 参照一张图（取${takes}）ˋ` |
| ip/director/director-asset-studio.tsx | `不会替换当前资产图。要按它出新图，点上面的「重新生成」。` | `不会替换当前资产图。如需按参考图生成新版本，请点击上方「重新生成」。` |
| ip/director/director-asset-studio.tsx | `现在不生成。点上面的「生成资产图」时会照着它画。` | `上传后不会立即生成。点击上方「生成资产图」时将参照此图。` |
| ip/director/director-asset-studio.tsx | `上传不会替换当前资产图，也不会自动生成、不扣积分。` | `上传不会替换当前资产图，也不会自动生成，不消耗积分。` |
| ip/director/director-asset-studio.tsx | `ˋ选资产库里的同一个${kindLabel[asset.kind]}，它选中版本的图直接作为资产图，分镜图和视频照着它画。名字保留剧本里的叫法。ˋ` | `ˋ从资产库选择同一个${kindLabel[asset.kind]}，所选版本的图片将直接作为资产图，用于生成分镜图和视频。名称保留剧本中的叫法。ˋ` |

#### ip/director/director-assets.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-assets.tsx | `每项一张，{costText(total, work.pricing.mock)}。生成后逐张确认，分镜图会照着确认过的资产图画。` | `每项一张，{costText(total, work.pricing.mock)}。生成后逐张确认，分镜图将以确认后的资产图为参考。` |
| ip/director/director-assets.tsx | `ˋ${missing.length} 项里有 ${failures.length} 项没有提交成功：${failures.join("；")}ˋ` | `ˋ${missing.length} 项中有 ${failures.length} 项提交失败：${failures.join("；")}ˋ` |
| ip/director/director-assets.tsx | `其余的已经开始生成。没提交成功的，按上面的原因处理后在那项资产上单独点「生成」。` | `其余资产图已开始生成。提交失败的，请按上述原因处理后，在对应资产上点击「生成」。` |
| ip/director/director-assets.tsx | `补上提取漏掉的角色、场景或道具，可以直接用自己的图` | `补充提取时遗漏的角色、场景或道具，可使用自己的图片` |
| ip/director/director-assets.tsx | `ˋ给还没有资产图的 ${missing.length} 项资产各生成一张，` | `ˋ为暂无资产图的 ${missing.length} 项资产各生成一张，` |
| ip/director/director-assets.tsx | `请确认后再继续。` | `请确认后继续。` |
| ip/director/director-assets.tsx | `暂无资产。点「提取全剧资产」，从正文识别角色、场景和道具。` | `暂无资产。点击「提取全剧资产」，从正文识别角色、场景和道具。` |
| ip/director/director-assets.tsx | `"这一类暂无资产。"` | `"此类暂无资产。"` |
| ip/director/director-assets.tsx | `>自己上传<` | `>已上传<` |
| ip/director/director-assets.tsx | `ˋ${asset.name}的音色已设置，点开修改ˋ` | `ˋ${asset.name}的音色已设置，点击修改ˋ` |
| ip/director/director-assets.tsx | `"音色已设置，点开修改"` | `"音色已设置，点击修改"` |
| ip/director/director-assets.tsx | `ˋ图片没有上传成功：${message}ˋ` | `ˋ图片上传失败：${message}ˋ` |
| ip/director/director-assets.tsx | `填好的内容和图片还在，按原因修改后再点「添加」。` | `已填写的内容和图片已保留，请按原因修改后点击「添加」。` |
| ip/director/director-assets.tsx | `图片（可选）` | `图片（选填）` |
| ip/director/director-assets.tsx | `"用自己的图"` | `"使用自己的图片"` |
| ip/director/director-assets.tsx | `支持手机照片。上传后选这张图怎么用。` | `支持手机照片，上传后选择用途。` |
| ip/director/director-assets.tsx | `aria-label="这张图怎么用"` | `aria-label="图片用途"` |
| ip/director/director-assets.tsx | `ˋ以后生成资产图时让 AI 参照它（${kind === "character" ? "取长相" : "取外观"}），现在不生成、不扣积分ˋ` | `ˋ生成资产图时由 AI 参照此图（${kind === "character" ? "取长相" : "取外观"}），上传时不生成，不消耗积分ˋ` |
| ip/director/director-assets.tsx | `{!episodeIds.length && <small className="director-muted">至少选一集</small>}` | `{(!name.trim() \|\| !episodeIds.length) && <small className="director-muted">{!name.trim() ? "请填写名称" : "至少选择一集"}</small>}` |

#### ip/director/director-styles.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-styles.tsx | `或者自己写，例如：九十年代文艺片写实` | `或自定义，例如：九十年代文艺片写实` |
| ip/director/director-styles.tsx | `样图由 AI 生成，实际效果还取决于所选的图片和视频模型。` | `样图由 AI 生成，实际效果取决于所选的图片和视频模型。` |
| ip/director/director-styles.tsx | `"使用这个风格"` | `"使用此风格"` |

#### ip/director/director-voice.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-voice.tsx | `"没有参考音频"` | `"无参考音频"` |
| ip/director/director-voice.tsx | `还没设置。不设置时按人物身份自然配音，各片段的声音可能不一样。` | `未设置。不设置时将按人物身份自然配音，各片段的声音可能不一致。` |
| ip/director/director-voice.tsx | `没有参考音频时，视频按这段描述配音；有参考音频时作为补充。` | `无参考音频时，视频按此描述配音；有参考音频时作为补充。` |
| ip/director/director-voice.tsx | `MP3、WAV 或 M4A，至少 2 秒、最多 25 MB；建议单人说话、没有背景音乐` | `MP3、WAV 或 M4A，至少 2 秒，最大 25 MB；建议使用单人说话、无背景音乐的音频` |
| ip/director/director-voice.tsx | `>换一段<` | `>更换音频<` |
| ip/director/director-voice.tsx | `Studio 中已保存的人物声音，将以试听音频作为参考。` | `IP Studio 中已保存的人物声音，将以试听音频作为参考。` |
| ip/director/director-voice.tsx | `<p className="director-dialog-note">加载中…</p>` | `<p className="director-dialog-note">正在加载声音…</p>` |

#### ip/director/director-trash.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-trash.tsx | `删除的作品在这里，可以恢复` | `已删除的作品，可在此恢复` |
| ip/director/director-trash.tsx | `」已恢复到作品列表，制作保持停止，需要时再开始。` | `」已恢复到作品列表。如需继续制作，请重新开始。` |
| ip/director/director-trash.tsx | `<h2>回收站是空的</h2>` | `<h2>回收站暂无作品</h2>` |
| ip/director/director-trash.tsx | `删除的作品会放在这里，可以随时恢复。` | `删除的作品会保留在这里，可随时恢复。` |

#### ip/director/director-works.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-works.tsx | `<p>把「<b` | `<p>将「<b` |
| ip/director/director-works.tsx | `移入后不在作品列表里显示，可以在回收站恢复。` | `移入后不再显示在作品列表中，可在回收站恢复。` |
| ip/director/director-works.tsx | `下一步：AI 先问一两个关键问题把故事定下来，再写剧本；也可以跳过，直接生成。` | `下一步：AI 提出一两个关键问题以确定故事，然后写剧本；也可跳过问答，直接生成。` |

#### ip/director/director-brief.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-brief.tsx | `上一条还没确认是否送达，请先点「按原请求重新发送」或「不发了」。` | `上一条消息的送达状态尚未确认，请点击「按原请求重新发送」或「放弃发送」。` |
| ip/director/director-brief.tsx | `和全能创作助手说说你想拍什么。已有剧本可以直接粘贴或上传。` | `在全能创作助手中描述你想拍的故事。已有剧本可直接粘贴或上传。` |
| ip/director/director-brief.tsx | `在全能创作助手里确认这些内容，也可以直接生成。` | `请在全能创作助手中确认以下内容，也可直接生成。` |
| ip/director/director-brief.tsx | `集数较多时，先写全剧大纲和前几集，后面的集可以继续写。` | `集数较多时，将先写全剧大纲和前几集，其余各集可继续写。` |
| ip/director/director-brief.tsx | `按你的想法和已经回答的内容生成，没说的由 AI 补齐` | `根据你的想法和已回答的内容生成，未提及的部分由 AI 补充` |
| ip/director/director-brief.tsx | `先确认这部作品的基本要素。` | `请确认作品的基本要素。` |
| ip/director/director-brief.tsx | `placeholder="其它"` | `placeholder="其他"` |
| ip/director/director-brief.tsx | `AI 正在看你的想法` | `AI 正在分析你的想法` |
| ip/director/director-brief.tsx | `"这一轮没有回复成功"` | `"本轮回复失败"` |
| ip/director/director-brief.tsx | `可以再发一次，或者直接生成剧本。` | `可重新发送，或直接生成剧本。` |
| ip/director/director-brief.tsx | `先说说你想拍什么，一句话就可以。` | `请用一句话描述你想拍的故事。` |
| ip/director/director-brief.tsx | `>不发了<` | `>放弃发送<` |
| ip/director/director-brief.tsx | `点上面的选项，或直接写。说「你决定」就开始写剧本` | `选择上方选项，或输入你的想法。输入「你决定」将直接开始写剧本` |
| ip/director/director-brief.tsx | `补充你的想法，或者说「直接写」` | `补充你的想法，或输入「直接写」` |
| ip/director/director-brief.tsx | `按全剧大纲继续写，完成后接在已有内容后面。` | `按全剧大纲继续写，完成后追加在已有内容之后。` |

#### ip/director/director-script.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-script.tsx | `"按你们聊定的要求"` | `"按对话确定的要求"` |
| ip/director/director-script.tsx | `设计人物、伏笔和反转，再分场写成剧本` | `设计人物、伏笔和反转，并分场写成剧本` |
| ip/director/director-script.tsx | `粘贴的剧本还在输入框里，按原因调整后再点保存。` | `粘贴的剧本已保留在输入框中，请按原因调整后点击「保存剧本」。` |
| ip/director/director-script.tsx | `>返回，用创意生成<` | `>改用创意生成<` |
| ip/director/director-script.tsx ×2 | `一键制作进行中，进度在上方` | `一键制作进行中，进度见页面上方` |
| ip/director/director-script.tsx | `改动还在编辑框里，按原因调整后再保存。` | `修改内容已保留，请按原因调整后点击「保存」。` |
| ip/director/director-script.tsx | `"还没拆分集"` | `"尚未拆分集"` |
| ip/director/director-script.tsx | `shortcutNote={dirty ? "先保存剧本" : undefined}` | `shortcutNote={dirty ? "请先保存剧本" : undefined}` |
| ip/director/director-script.tsx | `识别角色、场景和道具，完成后先给你确认，再保存。` | `识别角色、场景和道具，清单经你确认后保存。` |
| ip/director/director-script.tsx | `把后面的步骤连着自动做完，一直到成片，也可以只做到分镜脚本或分镜图。系统先算好推荐预算，你确认后开始。` | `自动完成后续步骤至成片，也可只完成至分镜脚本或分镜图。开始前显示推荐预算，确认后执行。` |
| ip/director/director-script.tsx | `已提取 ${work.assets.length} 项资产。到「资产」给角色、场景和道具生成资产图，分镜图和视频都照着它们画。改了正文可以重新提取，同一人物不会重复新建。` | `已提取 ${work.assets.length} 项资产。请在「资产」为角色、场景和道具生成资产图，分镜图和视频将以此为参考。修改正文后可重新提取，同一人物不会重复创建。` |
| ip/director/director-script.tsx | `AI 从全部集里识别角色、场景和道具，先给你确认清单再入库。之后生成资产图、写分镜脚本，每一步都能先看再改。` | `AI 从全部集中识别角色、场景和道具，清单经你确认后保存。之后生成资产图、写分镜脚本，每一步都可检查和修改。` |
| ip/director/director-script.tsx | `对全部集一起提取角色、场景和道具，同一人物不会在各集重复出现` | `从全部集中提取角色、场景和道具，同一人物不会在各集重复出现` |
| ip/director/director-script.tsx | `改动还在编辑框里，按原因调整后再点「保存」。` | `修改内容已保留，请按原因调整后点击「保存」。` |
| ip/director/director-script.tsx | `分镜脚本写好后正文又改过，片段可能和正文对不上。可在「分镜」重写分镜脚本（已有分镜图的片段要先删掉）。` | `分镜脚本写好后正文已修改，片段可能与正文不一致。可在「分镜」重写分镜脚本。` |
| ip/director/director-script.tsx | `title={scriptBusy ? "请等助手回复完成后再重新生成" : blocked ? "已有分镜图或视频的片段，先删除这些片段才能重新生成剧本" : "按创意让 AI 重新写一版剧本"} onClick={() => setOpen(true)}><RefreshCw size={14}/>重新生成剧本</button>` | `title={blocked ? regenBlock : "由 AI 按创意重新写剧本"} onClick={() => setOpen(true)}><RefreshCw size={14}/>重新生成剧本</button> ⏎     {blocked && <small className="director-muted">{regenBlock}</small>}` |
| ip/director/director-script.tsx | `  const writing = runningTask(work, "script"); ⏎   if (writing) return null; ⏎   return <> ⏎     <button type="button" className="ip-brand-secondary" disabled={blocked}` | `  const writing = runningTask(work, "script"); ⏎   if (writing) return null; ⏎   const regenBlock = scriptBusy ? "助手回复完成后可重新生成" : "请先删除已有分镜图或视频的片段"; ⏎   return <> ⏎     <button type="button" className="ip-brand-secondary" disabled={blocked}` |
| ip/director/director-script.tsx | `写明时长、集数、人物或「不要对白」等要求，会照做。` | `可写明时长、集数、人物或「不要对白」等要求。` |
| ip/director/director-script.tsx | `生成期间如果改了剧本或片段，新剧本不会替换当前内容。` | `生成期间如修改剧本或片段，新剧本不会替换当前内容。` |
| ip/director/director-script.tsx | `AI 正在处理这份正文，暂时不能编辑。回复完成或失败后即可继续修改。` | `AI 正在处理此正文，暂时不能编辑。回复结束后可继续修改。` |
| ip/director/director-script.tsx | `ˋ评价、续写、润色。正文很长，助手读光标附近约 ${budget.toLocaleString("zh-CN")} 字；只改某一段：先选中它，再点上方的「问 AI」ˋ` | `ˋ评价、续写、润色。正文较长，助手将读取光标附近约 ${budget.toLocaleString("zh-CN")} 字；如需修改某一段，请选中后点击上方的「问 AI」ˋ` |
| ip/director/director-script.tsx | `"评价、续写、润色。只改某一段：先选中它，再点上方的「问 AI」"` | `"评价、续写、润色。如需修改某一段，请选中后点击上方的「问 AI」"` |
| ip/director/director-script.tsx | `正文 {length.toLocaleString("zh-CN")} 字，超过 AI 一次能读的约 {budget.toLocaleString("zh-CN")} 字。正文照常保存；助手读光标或选中处附近的一段， ⏎     提取资产按集分批读，写分镜脚本要求每集在 {budget.toLocaleString("zh-CN")} 字以内（用「第1集」或「E01」这样的标题分集可免费拆分）。` | `正文 {length.toLocaleString("zh-CN")} 字，超过 AI 单次可读取的约 {budget.toLocaleString("zh-CN")} 字。正文可正常保存；助手读取光标或选中处附近的一段， ⏎     提取资产时按集分批读取，写分镜脚本要求每集不超过 {budget.toLocaleString("zh-CN")} 字（使用「第1集」或「E01」等标题分集可免费拆分）。` |
| ip/director/director-script.tsx | `{p.targetLabel} · 只替换这一段` | `{p.targetLabel} · 只替换此段` |
| ip/director/director-script.tsx | `原文已经改动，找不到这条建议要替换的段落。可以让助手按现在的正文重新给建议。` | `原文已修改，未找到此建议要替换的段落。可让助手按当前正文重新给出建议。` |
| ip/director/director-script.tsx | `（删掉这段）` | `（删除此段）` |
| ip/director/director-script.tsx | `只替换这一段，其余正文保留。采用后可以撤销。` | `只替换此段，其余正文保留。采用后可撤销。` |
| ip/director/director-script.tsx | `"采用这处修改"` | `"采用此修改"` |

#### ip/director/director-script-file.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-script-file.tsx | `文件超过 50 MB，请按章节拆分后上传。没有读取任何内容` | `文件超过 50 MB，请按章节拆分后上传` |
| ip/director/director-script-file.tsx | `文件没有可读取的文字，请检查正文或先识别扫描件` | `文件中没有可读取的文字。扫描件请先进行文字识别` |
| ip/director/director-script-file.tsx | `正文没有改动，可以继续编辑。` | `正文未改动，可继续编辑。` |
| ip/director/director-script-file.tsx | `文件最多 50 MB，正文不限字数` | `文件最大 50 MB，正文不限字数` |
| ip/director/director-script-file.tsx | `免费提取文字，可预览后导入正文；网页只取正文，不运行里面的脚本；扫描 PDF 请先识别文字。` | `免费提取文字，预览后导入正文。网页文件仅提取正文，不运行其中的脚本；扫描版 PDF 请先识别文字。` |
| ip/director/director-script-file.tsx | `，已用 {Math.max(0, Math.round((now - reading.since) / 1000))} 秒。` | `，已用时 {Math.max(0, Math.round((now - reading.since) / 1000))} 秒。` |
| ip/director/director-script-file.tsx | `这里只预览开头 {PREVIEW_CHARS.toLocaleString("zh-CN")} 字，导入时整份 {preview.text.length.toLocaleString("zh-CN")} 字都会放进正文，不截断。` | `此处仅预览开头 {PREVIEW_CHARS.toLocaleString("zh-CN")} 字，导入时将完整导入全部 {preview.text.length.toLocaleString("zh-CN")} 字。` |
| ip/director/director-script-file.tsx | `插到你刚才粘贴的位置，原有正文保留；点击保存才会存入作品。` | `插入到刚才粘贴的位置，原有正文保留；点击「保存」后存入作品。` |
| ip/director/director-script-file.tsx | `导入后仍可编辑，点击保存才会存入作品。` | `导入后仍可编辑，点击「保存」后存入作品。` |
| ip/director/director-script-file.tsx | `"正在读取文件…"` | `"正在提取文字…"` |
| ip/director/director-script-file.tsx | `>取消读取<` | `>取消提取<` |

#### ip/director/director-script-reference.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-script-reference.tsx | `正文改过，找不到这个片段的起始句；下面是本集全文。` | `正文已修改，未找到此片段的起始句，以下为本集全文。` |
| ip/director/director-script-reference.tsx | `这个片段没有记录对应的正文位置（旧片段或拆出来的片段），下面是本集全文。` | `此片段未记录对应的正文位置，以下为本集全文。` |
| ip/director/director-script-reference.tsx | `按写分镜时记下的起始句定位。` | `按写分镜脚本时记录的起始句定位。` |
| ip/director/director-script-reference.tsx | `按台词在正文里找到的大致位置。` | `按台词在正文中匹配到的大致位置。` |
| ip/director/director-script-reference.tsx | ` · 写分镜后正文改过` | ` · 写分镜脚本后正文已修改` |
| ip/director/director-script-reference.tsx | `评价、续写、润色这一集` | `评价、续写、润色本集` |
| ip/director/director-script-reference.tsx | `"只看这段"` | `"只看此段"` |
| ip/director/director-script-reference.tsx | `点片段卡上的「对照剧本」，这里会标出它对应的段落。` | `点击片段卡上的「对照剧本」，此处将标出对应段落。` |
| ip/director/director-script-reference.tsx | `上面还有 {from.toLocaleString("zh-CN")} 段` | `上方还有 {from.toLocaleString("zh-CN")} 段` |
| ip/director/director-script-reference.tsx | `本集还没有正文。` | `本集暂无正文。` |
| ip/director/director-script-reference.tsx | `从这里开始` | `从此处开始` |
| ip/director/director-script-reference.tsx | `下面还有 {(all.length - to).toLocaleString("zh-CN")} 段` | `下方还有 {(all.length - to).toLocaleString("zh-CN")} 段` |

#### ip/director/director-long-editor.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-long-editor.tsx | `字，放进一个编辑框会卡，分成 {sections.length} 段显示。点一段展开编辑，改完收起。` | `字，已分为 {sections.length} 段显示。点击某一段展开编辑。` |
| ip/director/director-long-editor.tsx | `太长，不在这里逐字编辑，{what}。整份都会保存，不截断。` | `篇幅较长，此处不逐字编辑，{what}。全文将完整保存，不截断。` |
| ip/director/director-long-editor.tsx | `>清空，重新输入<` | `>清空<` |

#### ip/director/director-split.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-split.tsx | `字）不在任何一集里</b>` | `字）不属于任何一集</b>` |
| ip/director/director-split.tsx | `>是设定资料，不拍<` | `>设定资料（不生成画面）<` |
| ip/director/director-split.tsx | `>是正片，并入第 1 集<` | `>正片内容（并入第 1 集）<` |
| ip/director/director-split.tsx | `保留在「设定资料」里，提取资产和写分镜脚本时作为参考。以后也可以并入第 1 集。` | `保留在「设定资料」中，提取资产和写分镜脚本时作为参考，之后也可并入第 1 集。` |
| ip/director/director-split.tsx | `放在第 1 集正文最前面，会被拍成画面。` | `放在第 1 集正文开头，将生成画面。` |
| ip/director/director-split.tsx | `>放弃拆分<` | `>放弃分集<` |
| ip/director/director-split.tsx | `改动还在编辑框里，按原因调整后再保存。` | `修改内容已保留，请按原因调整后点击「保存」。` |
| ip/director/director-split.tsx | `字 · 不拍成画面，提取资产和写分镜脚本时作为参考` | `字 · 不生成画面，提取资产和写分镜脚本时作为参考` |
| ip/director/director-split.tsx | `字，照常保存；提取资产和写分镜脚本时 AI 只参考前 {REFERENCE_PROMPT_MAX.toLocaleString("zh-CN")} 字，要紧的设定请放在前面。` | `字，可正常保存；提取资产和写分镜脚本时 AI 仅参考前 {REFERENCE_PROMPT_MAX.toLocaleString("zh-CN")} 字，重要设定请放在前面。` |
| ip/director/director-split.tsx | `title={dirty ? "先保存修改" : "这部分其实是正片：整段放到第 1 集最前面"} onClick={merge}>并入第 1 集</button>}` | `title={dirty ? "请先保存修改" : "将整段内容并入第 1 集正文开头"} onClick={merge}>并入第 1 集</button>} ⏎         {work.episodes.length > 0 && dirty && <small className="director-muted">请先保存修改</small>}` |
| ip/director/director-split.tsx | `回到拆分前的整份剧本，可以重新拆分` | `恢复为拆分前的完整剧本，可重新拆分` |
| ip/director/director-split.tsx | `剧本回到拆分前的样子，{work.episodes.length} 集合回一整份，可以重新拆分或作为一集。` | `剧本恢复为拆分前的状态，{work.episodes.length} 集合并为完整剧本，可重新拆分或作为一集。` |
| ip/director/director-split.tsx | `拆分后在各集里改过的内容{planned ? ˋ和已写好的 ${planned} 个片段ˋ : ""}会一起清掉。` | `拆分后在各集中修改的内容{planned ? ˋ及已写好的 ${planned} 个片段ˋ : ""}将一并清除。` |

#### ip/director/director-extract.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-extract.tsx | `ˋ正文太长，AI 一次读不完全剧，这次读了第 ${pending.batch.fromNo}–${pending.batch.toNo} 集（共 ${pending.batch.total} 集），识别到 ${pending.items.length} 项。保存后在「资产」里点「继续提取」读剩下的集。ˋ` | `ˋ正文较长，AI 无法一次读取全剧。本次读取第 ${pending.batch.fromNo}–${pending.batch.toNo} 集（共 ${pending.batch.total} 集），识别到 ${pending.items.length} 项。保存后可在「资产」中继续提取其余各集。ˋ` |
| ip/director/director-extract.tsx | `勾选要保存的，名字可以直接改；已有的同一项会合并，不重复新建。` | `勾选要保存的资产，名称可直接修改；与已有资产相同的将合并，不重复创建。` |
| ip/director/director-extract.tsx | `本作品里还没有，保存时新建` | `本作品中暂无此项，保存时新建` |
| ip/director/director-extract.tsx | `剧情里的其他形态` | `剧情中的其他形态` |
| ip/director/director-extract.tsx | `>不保存<` | `>丢弃清单<` |
| ip/director/director-extract.tsx | `>稍后再看<` | `>稍后查看<` |
| ip/director/director-extract.tsx | `aria-label="稍后再看"` | `aria-label="稍后查看"` |

#### ip/director/director-storyboard.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-storyboard.tsx | `} 正在重写，完成后再重写整集ˋ` | `} 正在重写，完成后可重写整集ˋ` |
| ip/director/director-storyboard.tsx | `title: ˋ现在不能重写第 ${ep.no} 集ˋ` | `title: ˋ暂时无法重写第 ${ep.no} 集ˋ` |
| ip/director/director-storyboard.tsx | `title: ˋ现在不能写第 ${ep.no} 集分镜脚本ˋ` | `title: ˋ暂时无法写第 ${ep.no} 集分镜脚本ˋ` |
| ip/director/director-storyboard.tsx | `title: ˋ现在不能重写片段 ${clip.order}ˋ` | `title: ˋ暂时无法重写片段 ${clip.order}ˋ` |
| ip/director/director-storyboard.tsx | `AI 重写本集的镜头，分镜图和视频提示词跟着更新；不出图、不生成视频` | `AI 重写本集的镜头，分镜图提示词和视频提示词随之更新，不生成图片和视频` |
| ip/director/director-storyboard.tsx | `片段时长要按视频模型来定，目前没有可用的视频模型。可以先去「资产」准备资产图，有可用模型后再写分镜脚本。` | `片段时长需按视频模型确定，当前没有可用的视频模型。可先在「资产」准备资产图，待有可用模型后写分镜脚本。` |
| ip/director/director-storyboard.tsx | `结合本集剧本看全部片段，只改你指定的片段和镜头` | `结合本集剧本查看全部片段，仅修改你指定的片段和镜头` |
| ip/director/director-storyboard.tsx | `把本集正文切成视频片段，写好每个镜头，以及每段的分镜图提示词和视频提示词。` | `将本集正文切分为视频片段，写出每个镜头及每段的分镜图提示词和视频提示词。` |
| ip/director/director-storyboard.tsx | `片段划分不变，逐段换一套新镜头，分镜图提示词和视频提示词跟着更新。不会出图，也不会生成视频。` | `片段划分不变，逐段重写镜头，分镜图提示词和视频提示词随之更新，不生成图片和视频。` |
| ip/director/director-storyboard.tsx | `分镜脚本写好后正文又改过，片段可能和正文对不上。` | `分镜脚本写好后正文已修改，片段可能与正文不一致。` |
| ip/director/director-storyboard.tsx | `写分镜脚本期间你改过片段，新写的版本（{pending.clips.length} 个片段）没有覆盖现有内容。要换成新版本吗？` | `写分镜脚本期间你修改过片段，新版本（{pending.clips.length} 个片段）未覆盖现有内容。是否换成新版本？` |
| ip/director/director-storyboard.tsx | `title={hasMedia ? "请先删除已有分镜图的片段" : undefined}` | `title={hasMedia ? "请先删除已有分镜图或视频的片段" : undefined}` |
| ip/director/director-storyboard.tsx | `failed(setError, "保留现有分镜脚本"))}>保留现有</button></div>}` | `failed(setError, "保留现有分镜脚本"))}>保留现有</button> ⏎             {hasMedia && <small>请先删除已有分镜图或视频的片段，才能换成新版本</small>}</div>}` |
| ip/director/director-storyboard.tsx | `分镜脚本把本集切成几个片段，每段写好镜头、分镜图提示词和视频提示词，一段对应一条视频。写之前先在「资产」准备好角色、场景和道具。` | `分镜脚本会将本集切分为若干片段，每段包含镜头、分镜图提示词和视频提示词，一段对应一条视频。写分镜脚本前，请在「资产」准备角色、场景和道具。` |
| ip/director/director-storyboard.tsx | `ˋ选中的片段都不能生成${what}ˋ` | `ˋ选中的片段均无法生成${what}ˋ` |
| ip/director/director-storyboard.tsx | `。已有分镜图的会生成新版本，原版本保留。` | `。已有分镜图的片段将生成新版本，原版本保留。` |
| ip/director/director-storyboard.tsx | `个（不扣积分）：` | `个（不消耗积分）：` |
| ip/director/director-storyboard.tsx | `ˋ${p.ok.length} 个片段里有 ${failures.length} 个没有提交成功：${failures.join("；")}ˋ` | `ˋ${p.ok.length} 个片段中有 ${failures.length} 个提交失败：${failures.join("；")}ˋ` |
| ip/director/director-storyboard.tsx | `其余的已经开始生成。没提交成功的，按上面的原因处理后在那个片段上单独生成。` | `其余片段已开始生成。提交失败的，请按上述原因处理后，在对应片段上单独生成。` |
| ip/director/director-storyboard.tsx | `return "还没有分镜图";` | `return "暂无分镜图";` |
| ip/director/director-storyboard.tsx | `"片段内的镜头和分镜图将一并移除。"` | `"片段内的镜头、分镜图和视频将一并删除，删除后无法恢复。"` |
| ip/director/director-storyboard.tsx | `在本集剧本里标出这个片段对应的正文` | `在本集剧本中标出此片段对应的正文` |
| ip/director/director-storyboard.tsx | `AI 重写这一段的镜头和提示词，不出图、不生成视频` | `AI 重写此片段的镜头和提示词，不生成图片和视频` |
| ip/director/director-storyboard.tsx | `ˋ缺 ${missing.length} 张资产图ˋ` | `ˋ缺少 ${missing.length} 张资产图ˋ` |
| ip/director/director-storyboard.tsx | `写好后这一段的镜头、分镜图提示词和视频提示词自动更新。不会出图，也不会生成视频。` | `完成后此片段的镜头、分镜图提示词和视频提示词将自动更新，不生成图片和视频。` |
| ip/director/director-storyboard.tsx | `重写期间你改过这一段，新写的版本（{pendingShots.shots.length} 个镜头）没有覆盖现有内容。要换成新版本吗？` | `重写期间你修改过此片段，新版本（{pendingShots.shots.length} 个镜头）未覆盖现有内容。是否换成新版本？` |
| ip/director/director-storyboard.tsx | `{generating ? "分镜图生成中" : "还没有分镜图"}` | `{generating ? "分镜图生成中" : "暂无分镜图"}` |
| ip/director/director-storyboard.tsx | `"分镜图 · 还没有视频"` | `"分镜图 · 暂无视频"` |
| ip/director/director-storyboard.tsx | `点一下换成第 ${i + 1} 版` | `点击切换到第 ${i + 1} 版` |
| ip/director/director-storyboard.tsx | `角色、场景、道具的标准照，用来锁定长相和环境` | `关联的角色、场景、道具资产图，用于保持长相和环境一致` |
| ip/director/director-storyboard.tsx | `视频按这张分镜图逐格生成，保证前后镜头一致` | `视频按此分镜图逐格生成，用于保持前后镜头一致` |
| ip/director/director-storyboard.tsx | `不影响生成。要调整就点「编辑镜头」，或重写本集分镜脚本。` | `不影响生成。如需调整，请点击「编辑镜头」或重写本集分镜脚本。` |
| ip/director/director-storyboard.tsx | `"，只用分镜首帧" : "，图1 是分镜图，图2 起是关联资产"` | `"，仅使用分镜首帧" : "，图 1 为分镜图，图 2 起为关联资产"` |
| ip/director/director-storyboard.tsx | `生成视频时按格逐镜参考，保证前后镜头的人物和环境一致。` | `生成视频时按格逐镜参考，用于保持前后镜头的人物和环境一致。` |
| ip/director/director-storyboard.tsx | `{generating ? "生成中…" : "还没有分镜图"}` | `{generating ? "生成中…" : "暂无分镜图"}` |
| ip/director/director-storyboard.tsx | `生成后出现在这里。` | `生成后显示在这里。` |
| ip/director/director-storyboard.tsx | `{busy === "adopt" ? "正在换成这一张…" : "点哪一张，这个片段就用哪一张。"}` | `{busy === "adopt" ? "切换中…" : "点击某一版，即设为此片段的分镜图。"}` |
| ip/director/director-storyboard.tsx | `不要改宫格数量、景别和镜头顺序；要改镜头请关掉后点「编辑镜头」` | `请勿修改宫格数量、景别和镜头顺序；如需修改镜头，请关闭此窗口后点击「编辑镜头」` |
| ip/director/director-storyboard.tsx | `说说哪里要改，比如「第三格改近景」，助手改提示词；生成新版本另外确认费用` | `说明需修改之处，例如「第三格改近景」，助手将修改提示词；生成新版本前会单独确认费用` |
| ip/director/director-storyboard.tsx | `只把「{a.name}」从片段 {clip.order} 的关联资产里去掉：不删除片段，不删除资产，其他片段不受影响。` | `仅将「{a.name}」从片段 {clip.order} 的关联资产中移除，不删除片段和资产，其他片段不受影响。` |
| ip/director/director-storyboard.tsx | `之后这一段出分镜图和视频不再参考「{a.name}」的资产图，提示词随之更新。` | `解除后，此片段生成分镜图和视频时不再参考「{a.name}」的资产图，提示词随之更新。` |
| ip/director/director-storyboard.tsx | `这一段已有的{made}不会删除；和新的关联对不上的会标成「需更新」，要不要重新生成由你决定。` | `此片段已有的{made}不会删除；与新关联不一致的将标记为「需更新」，是否重新生成由你决定。` |
| ip/director/director-storyboard.tsx | `「{a.name}」在这一段还有 {lines} 句台词，台词和说话人不变。要删除这个角色，还要在「编辑镜头」里把这些台词换成别的说话人。` | `「{a.name}」在此片段还有 {lines} 句台词，台词和说话人不变。如需删除此角色，请在「编辑镜头」中更换这些台词的说话人。` |
| ip/director/director-storyboard.tsx | `这一段手改过的提示词不会自动更新，写到「{a.name}」的地方需要自己改。` | `此片段手动修改过的提示词不会自动更新，涉及「{a.name}」的内容需手动修改。` |
| ip/director/director-storyboard.tsx | `角色、场景、道具的标准照，只用来锁定长相、服装和环境；镜头构图看分镜图。` | `资产图仅用于保持人物长相、服装和环境一致，镜头构图以分镜图为准。` |
| ip/director/director-storyboard.tsx | `」已不在这个片段的关联资产里。{` | `」已不在此片段的关联资产中。{` |
| ip/director/director-storyboard.tsx | `"其他片段还在用它，回到资产页可以看是哪些。" : "没有片段在用它了，回到资产页就可以删除。"` | `"其他片段仍在使用此资产，可在资产页查看。" : "已没有片段使用此资产，可在资产页删除。"` |
| ip/director/director-storyboard.tsx | `>回到资产页<` | `>返回资产页<` |
| ip/director/director-storyboard.tsx | `这个片段还没有关联资产，可在卡片上点「编辑镜头」调整。` | `此片段暂无关联资产，可在片段卡上点击「编辑镜头」添加。` |
| ip/director/director-storyboard.tsx | `ˋ换「${a.name}」在片段 ${clip.order} 的形态ˋ` | `ˋ切换「${a.name}」在片段 ${clip.order} 的形态ˋ` |
| ip/director/director-storyboard.tsx | `ˋ${a.name}在这一段的形态ˋ` | `ˋ${a.name}在此片段的形态ˋ` |
| ip/director/director-storyboard.tsx | `这一段还用到 {views.map(v => ˋ${v.label}${a.views?.[v.key]?.adoptedId ? "" : "（还没有图，先按主视图）"}ˋ).join("、")}` | `此片段还使用 {views.map(v => ˋ${v.label}${a.views?.[v.key]?.adoptedId ? "" : "（暂无图片，按主视图生成）"}ˋ).join("、")}` |
| ip/director/director-storyboard.tsx | `"正在解除…"` | `"解除中…"` |
| ip/director/director-storyboard.tsx | `>去资产页修改<` | `>前往资产页<` |
| ip/director/director-storyboard.tsx | `<span>还没有视频</span>` | `<span>暂无视频</span>` |
| ip/director/director-storyboard.tsx | `{switching ? "正在换成这一版…" : "点哪一版，这个片段就用哪一版。"}` | `{switching ? "切换中…" : "点击某一版，即设为此片段的视频。"}` |
| ip/director/director-storyboard.tsx | `改过的内容还在输入框里，按原因调整后再点「保存」。` | `修改内容已保留，请按原因调整后点击「保存」。` |
| ip/director/director-storyboard.tsx | `这一段选了按原文生成，中文提示词直接发给视频模型。` | `此片段已选择按原文生成，中文提示词将直接发送给视频模型。` |
| ip/director/director-storyboard.tsx | `生成视频时，会先把这段提示词改写成 H3 官方要求的英文格式（台词保留中文原文），改写会额外消耗少量积分。` | `生成视频前，将先把提示词改写为 H3 官方要求的英文格式（台词保留中文原文）。优化提示词按实际用量另计。` |
| ip/director/director-storyboard.tsx | `ˋ，花了 ${clip.videoPromptEn.cost.toLocaleString()} 积分ˋ` | `ˋ，消耗 ${clip.videoPromptEn.cost.toLocaleString()} 积分ˋ` |
| ip/director/director-storyboard.tsx | `"优化稿（还没发送）" : "发给模型的英文"` | `"优化稿（未发送）" : "已发送的英文提示词"` |
| ip/director/director-storyboard.tsx | `资产「{id}」不存在（取消勾选以移除）` | `该资产已不存在（取消勾选以移除）` |
| ip/director/director-storyboard.tsx | `未知角色（{l.speakerId}）` | `未知角色` |

#### ip/director/director-rewrite.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-rewrite.tsx | `"本集正在写分镜脚本，完成后再重写"` | `"本集正在写分镜脚本，完成后可重写"` |
| ip/director/director-rewrite.tsx | `"这一段正在重写"` | `"此片段正在重写"` |
| ip/director/director-rewrite.tsx | `"视频生成中，完成后再重写"` | `"视频生成中，完成后可重写"` |
| ip/director/director-rewrite.tsx | `"分镜图生成中，完成后再重写"` | `"分镜图生成中，完成后可重写"` |
| ip/director/director-rewrite.tsx | `"先保存或取消镜头修改"` | `"请先保存或取消镜头修改"` |
| ip/director/director-rewrite.tsx | `手改过的视频提示词会换成新写的` | `手动修改过的视频提示词将被替换` |
| ip/director/director-rewrite.tsx | `手改过的分镜图提示词会换成新写的` | `手动修改过的分镜图提示词将被替换` |
| ip/director/director-rewrite.tsx | `还有没保存的修改，开始重写后会丢掉` | `有未保存的修改，开始重写后将丢失` |
| ip/director/director-rewrite.tsx | `AI 按本集正文重写这一段的镜头，分镜图提示词和视频提示词跟着更新；这一段在本集里的位置和讲的剧情不变。` | `AI 按本集正文重写此片段的镜头，分镜图提示词和视频提示词随之更新；此片段在本集中的位置和剧情不变。` |
| ip/director/director-rewrite.tsx | `只改这一段的文字，不会出图、不会生成视频，其他片段不变。` | `只修改此片段的文字，不生成图片和视频，其他片段不变。` |
| ip/director/director-rewrite.tsx ×2 | `已有的分镜图和视频留在历史版本里，会标成「需更新」，要不要重新生成由你决定。` | `已有的分镜图和视频保留在历史版本中，将标记为「需更新」，是否重新生成由你决定。` |
| ip/director/director-rewrite.tsx | `AI 按本集正文重新写镜头，每个片段的分镜图提示词和视频提示词跟着更新。只改文字，不会出图、不会生成视频，其他集不受影响。只想换某一段，关掉这里，在那个片段上点「重写」。` | `AI 按本集正文重写镜头，各片段的分镜图提示词和视频提示词随之更新。只修改文字，不生成图片和视频，其他集不受影响。如只需重写某个片段，请关闭此窗口，在该片段上点击「重写」。` |
| ip/director/director-rewrite.tsx | `aria-label="怎么重写"` | `aria-label="重写方式"` |
| ip/director/director-rewrite.tsx | `<span>怎么重写</span>` | `<span>重写方式</span>` |
| ip/director/director-rewrite.tsx | `片段的数量和顺序不变，每段换一套新镜头。` | `片段的数量和顺序不变，每段重写镜头。` |
| ip/director/director-rewrite.tsx | `已有分镜图或视频，重新切分会丢掉它们，所以现在不能选。要重新切分，先删除这些片段。` | `已有分镜图或视频，重新切分会丢失这些内容，暂不可选。如需重新切分，请先删除这些片段。` |
| ip/director/director-rewrite.tsx | `片段的数量和时长可能变化，现有片段全部换成新写的。` | `片段的数量和时长可能变化，现有片段将全部替换。` |
| ip/director/director-rewrite.tsx | `现有镜头会换成新写的，包括你在「编辑镜头」里改过的内容。` | `现有镜头将被替换，包括你在「编辑镜头」中修改过的内容。` |
| ip/director/director-rewrite.tsx | `。写好后自动显示，关掉页面也不中断。` | `。完成后自动显示，关闭页面不影响进行。` |
| ip/director/director-rewrite.tsx | `只改文字，不出图、不生成视频。` | `只改文字，不生成图片和视频。` |

#### ip/director/director-output.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-output.tsx | `按实际用量另扣少量积分。 ⏎ ` | `优化提示词按实际用量另计。 ⏎ ` |
| ip/director/director-output.tsx | `"该片段暂不能生成视频"` | `"此片段暂无法生成视频"` |
| ip/director/director-output.tsx | `"先处理上面标出的问题"` | `"请先处理上方标出的问题"` |
| ip/director/director-output.tsx | `正在重新优化提示词，好了之后由你决定用哪一份` | `正在重新优化提示词，完成后可选择使用哪一份` |
| ip/director/director-output.tsx | `。约需数分钟，关闭页面不中断` | `。通常需要几分钟，关闭页面不影响生成` |
| ip/director/director-output.tsx | `优化稿太长，视频模型收不下` | `优化稿过长，超出视频模型限制` |
| ip/director/director-output.tsx | `优化稿有需要留意的地方` | `优化稿有需要注意的问题` |
| ip/director/director-output.tsx | `title="重新改写一版提示词，只出稿、不生成视频，按实际用量另扣少量积分"` | `title="只改写提示词，不生成视频。优化提示词按实际用量另计。"` |
| ip/director/director-output.tsx | `"去生成分镜图"` | `"生成分镜图"` |
| ip/director/director-output.tsx | `不优化，直接把中文提示词发给视频模型` | `不优化，直接将中文提示词发送给视频模型` |
| ip/director/director-output.tsx | `title="上一份优化稿太长用不了。重新改写一版，只出稿、不生成视频，按实际用量另扣少量积分"` | `title="上一份优化稿过长，无法使用。只改写提示词，不生成视频。优化提示词按实际用量另计。"` |
| ip/director/director-output.tsx | `title="先按 H3 官方写法优化提示词再生成，会额外消耗少量积分"` | `title="按 H3 官方写法优化提示词后生成视频。优化提示词按实际用量另计。"` |
| ip/director/director-output.tsx | `<span className="director-cost director-video-cost" title={reason \|\| (current?.refs?.length ? ˋ参考：${current.refs.map(r => ˋ${r.label} ${r.name}ˋ).join("、")}ˋ : undefined)}>{reason \|\| (quote?.credits != null ? ˋ${clip.durationSec} 秒，${costText(quote.credits, work.pricing.mock)}${rewrite === "needed" ? "，另需少量积分优化提示词" : rewrite === "original" ? "，按原文生成" : ""}ˋ : "报价中…")}</span>` | `<span className="director-cost director-video-cost" title={reason \|\| [priceText, current?.refs?.length ? ˋ参考：${current.refs.map(r => ˋ${r.label} ${r.name}ˋ).join("、")}ˋ : ""].filter(Boolean).join("\n") \|\| undefined}>{reason \|\| priceText \|\| "报价中…"}</span>` |
| ip/director/director-output.tsx | `  const setVoiceMode = (withoutVoice: boolean) =>` | `  const priceText = quote?.credits != null ? ˋ${clip.durationSec} 秒，${costText(quote.credits, work.pricing.mock)}${rewrite === "needed" ? "。优化提示词按实际用量另计。" : rewrite === "original" ? "，按原文生成" : ""}ˋ : ""; ⏎   const setVoiceMode = (withoutVoice: boolean) =>` |
| ip/director/director-output.tsx | `"（优化稿太长，没用上）"` | `"（优化稿过长，未使用）"` |
| ip/director/director-output.tsx | `"（优化没成功）"` | `"（优化失败）"` |
| ip/director/director-output.tsx | `"（你选的）"` | `"（手动选择）"` |
| ip/director/director-output.tsx | `"这条视频用的是优化后的提示词"` | `"此视频使用优化后的提示词"` |
| ip/director/director-output.tsx | `ˋ这条视频用的是中文原文${why}ˋ` | `ˋ此视频使用中文原文提示词${why}ˋ` |
| ip/director/director-output.tsx | `ˋ${head}，这份优化稿花了 ${v.rewriteCost.toLocaleString()} 积分ˋ` | `ˋ${head}，优化消耗 ${v.rewriteCost.toLocaleString()} 积分ˋ` |
| ip/director/director-output.tsx | `<AlertTriangle size={13}/>含需更新视频</span>} ⏎     {latest &&` | `<AlertTriangle size={13}/>含需更新视频</span>} ⏎     {exportReason && !exporting && <span className="director-output-count" title={exportReason}>{missing.length ? ˋ${missing.length} 个片段缺少视频ˋ : ˋ${unconfirmed.length} 个片段的视频待确认ˋ}</span>} ⏎     {latest &&` |

#### ip/director/director-settings.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-settings.tsx | `ˋ设置没有保存：${message}。改动还在，调整后再点「保存」。ˋ` | `ˋ设置保存失败：${message}。修改内容已保留，请调整后点击「保存」。ˋ` |
| ip/director/director-settings.tsx | `已生成的资产图和分镜图不会自动重做，会标为「需更新」。` | `已生成的资产图和分镜图不会自动重新生成，将标记为「需更新」。` |
| ip/director/director-settings.tsx | `原文本模型不在可选范围内，换一个模型才能继续写剧本和分镜。其他设置可以照常保存。` | `原文本模型已不可用，请更换模型后继续写剧本和分镜脚本。其他设置可正常保存。` |
| ip/director/director-settings.tsx | `原图片模型不在可选范围内，换一个模型才能继续出图。其他设置可以照常保存。` | `原图片模型已不可用，请更换模型后继续生成图片。其他设置可正常保存。` |
| ip/director/director-settings.tsx | `同时参考分镜图、角色 / 场景 / 道具图和角色声音。片段时长按模型支持的范围来定。` | `同时参考分镜图、资产图和角色声音，片段时长按模型支持的范围确定。` |
| ip/director/director-settings.tsx | `原图片模型已停用，资产图和分镜图暂时生成不了，换一个模型才能继续出图。其他设置可以照常保存。` | `原图片模型已停用，暂时无法生成资产图和分镜图，请更换模型。其他设置可正常保存。` |
| ip/director/director-settings.tsx | `ˋ${who}${name}不能出${missing}，${affected.join("、")}的图生成不了；其他画面照常${price}。换一个模型才能出全部画面，不换也可以保存其他设置。ˋ` | `ˋ${who}${name}不支持${missing}，无法生成${affected.join("、")}的图片；其他画面不受影响${price}。更换模型后可生成全部画面，不更换也可保存其他设置。ˋ` |
| ip/director/director-settings.tsx | `ˋ${who}${name}不能出${missing}，当前画幅下不影响出图${price}。ˋ` | `ˋ${who}${name}不支持${missing}，当前画幅下不影响生成${price}。ˋ` |
| ip/director/director-settings.tsx | `缺哪种就说哪类出不了` | `缺哪种就说哪类生成不了` |

#### ip/director/director-assistant.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-assistant.tsx ×2 | `ˋ${p.targetLabel}有没保存的修改，请先保存或撤销，再采用助手的建议ˋ` | `ˋ${p.targetLabel}有未保存的修改，请保存或撤销后采用助手的建议ˋ` |
| ip/director/director-assistant.tsx | `有镜头时长没填好，改好或撤销后再发送` | `有镜头时长未填写，请修改或撤销后发送` |
| ip/director/director-assistant.tsx | `选中的段落改过了，请在正文里重新选择要修改的地方` | `选中的段落已修改，请在正文中重新选择` |
| ip/director/director-assistant.tsx | `AI 正在处理这份正文，请等回复完成后再修改` | `AI 正在处理此正文，请在回复完成后修改` |
| ip/director/director-assistant.tsx | `<p>{p.status === "open" ? "先采用这条文字修改，再" : ""}按修改后的提示词、以当前这张为参考生成一张新图。</p>` | `<p>{p.status === "open" ? "将采用此文字修改，并" : ""}按修改后的提示词、以当前图片为参考生成新版本。</p>` |
| ip/director/director-assistant.tsx | `这不是局部精确修改，画面其他部分也可能有变化。原图保留，生成后可以对比再决定用哪张。` | `这不是局部精确修改，画面其他部分也可能变化。原图保留，生成后可对比并选择。` |
| ip/director/director-assistant.tsx ×2 | `"这个片段的镜头"` | `"此片段的镜头"` |
| ip/director/director-assistant.tsx | `"当前这张图" : "这张图的提示词（当前模型不能看图）"` | `"当前图片" : "此图的提示词（当前模型不支持看图）"` |
| ip/director/director-assistant.tsx | `"回复完成后再开新对话" : "开一段新对话，之前的对话留在历史里"` | `"回复完成后可新建对话" : "新建对话，之前的对话保留在历史对话中"` |
| ip/director/director-assistant.tsx | `{!briefing && <small>已关联：{linkedText(work, ctl.scope, canSee)}</small>}` | `{!briefing && <small>已关联：{linkedText(work, ctl.scope, canSee)}</small>} ⏎       {!briefing && !!replying && <small>回复完成后可新建对话</small>}` |
| ip/director/director-assistant.tsx | `回复完成后可以切换。` | `回复完成后可切换。` |
| ip/director/director-assistant.tsx | `有了剧本以后，在这里继续评价、续写和局部修改。` | `有剧本后，可在此继续评价、续写和局部修改。` |
| ip/director/director-assistant.tsx | `选中正文、点镜头或图片旁的「AI」按钮，我就知道你要改哪里。讨论的时候我只给分析和方向，你说「改」我才给修改建议，采用前都能先对比。` | `选中正文，或点击镜头、图片旁的「AI」按钮，指定要修改的内容。讨论时只给出分析和方向，你明确要求修改后才给出修改建议，采用前可先对比。` |
| ip/director/director-assistant.tsx | `"助手没有回复成功"` | `"回复失败"` |
| ip/director/director-assistant.tsx | `当前文字模型不能看图，以上意见只根据这张图的提示词。` | `当前文字模型不支持看图，以上意见仅依据此图的提示词。` |
| ip/director/director-assistant.tsx | `条建议对不上原文或超出这次的修改范围，已略过。` | `条建议与原文不符或超出本次修改范围，已忽略。` |
| ip/director/director-assistant.tsx | `分镜图提示词是你改过的，不会跟着镜头变；需要的话让助手一起改。` | `分镜图提示词已自定义，不会随镜头更新；如需修改，可让助手一并调整。` |
| ip/director/director-assistant.tsx | `视频提示词是你改过的，不会跟着镜头变；需要的话让助手一起改。` | `视频提示词已自定义，不会随镜头更新；如需修改，可让助手一并调整。` |
| ip/director/director-assistant.tsx | `已有的分镜图会标为「需更新」，不会自动重新生成。` | `已有的分镜图将标记为「需更新」，不会自动重新生成。` |
| ip/director/director-assistant.tsx ×2 | `已有的片段视频会标为「需更新」，不会自动重新生成。` | `已有的片段视频将标记为「需更新」，不会自动重新生成。` |
| ip/director/director-assistant.tsx | `已有的分镜图会标为「需更新」；要新图请点「生成新版本」。` | `已有的分镜图将标记为「需更新」；如需新图，请点击「生成新版本」。` |
| ip/director/director-assistant.tsx | `采用后这份提示词按「已自定义」保存，镜头再改时不会自动同步。` | `采用后此提示词按「已自定义」保存，修改镜头时不会自动同步。` |
| ip/director/director-assistant.tsx | `已有的资产图会标为「需更新」；要新图请点「生成新版本」。` | `已有的资产图将标记为「需更新」；如需新图，请点击「生成新版本」。` |
| ip/director/director-assistant.tsx | `（删掉这段）` | `（删除此段）` |
| ip/director/director-assistant.tsx | `采用文字后，以当前这张为参考生成一张新图（另外计费）` | `采用文字修改后，以当前图片为参考生成新版本（另行计费）` |
| ip/director/director-assistant.tsx | `>不用了<` | `>不采用<` |
| ip/director/director-assistant.tsx | `>没有采用<` | `>未采用<` |
| ip/director/director-assistant.tsx | `<b>删掉原第 {c.beforeNo} 镜</b>` | `<b>删除原第 {c.beforeNo} 镜</b>` |
| ip/director/director-assistant.tsx | `<b>第 {c.no} 镜 · 改了{c.fields.join("、")}</b>` | `<b>第 {c.no} 镜 · 修改了{c.fields.join("、")}</b>` |
| ip/director/director-assistant.tsx | `这部作品的文本模型，和「作品设置」里的是同一项：写剧本、拆分集、写分镜也用它。` | `即本作品的文本模型，与「作品设置」中的选项相同，也用于写剧本、拆分集和写分镜脚本。` |
| ip/director/director-assistant.tsx | `ˋ模型没有换成：${errorText(err)}ˋ` | `ˋ模型切换失败：${errorText(err)}ˋ` |
| ip/director/director-assistant.tsx | `上一条消息还没确认是否送达，请先按原请求核对送达状态，再发新的消息。` | `上一条消息的送达状态尚未确认，请点击「按原请求重新发送」，确认送达后可发送新消息。` |
| ip/director/director-assistant.tsx | `aria-label="没确认送达的消息"` | `aria-label="未确认送达的消息"` |
| ip/director/director-assistant.tsx | `>不发了<` | `>放弃发送<` |
| ip/director/director-assistant.tsx | `aria-label="换回当前页面的默认范围"` | `aria-label="恢复当前页面的默认范围"` |
| ip/director/director-assistant.tsx | `助手正在回复，你可以继续改内容，回复完成后再发送` | `助手正在回复，可继续编辑，回复完成后发送` |
| ip/director/director-assistant.tsx | `说说你的想法，或者要怎么改。Enter 发送，Shift+Enter 换行` | `输入你的想法或修改要求。Enter 发送，Shift+Enter 换行` |
| ip/director/director-assistant.tsx | `<small>{work.pricing.mock ? "测试模式，免费" : ˋ按实际用量结算，每轮最多 ${work.pricing.textMax.toLocaleString("zh-CN")} 积分ˋ}</small>` | `<small>{replying ? "回复完成后可发送" : work.pricing.mock ? "测试模式，免费" : "按实际用量结算"}</small>` |
| ip/director/director-assistant.tsx | `<small>{work.pricing.mock ? "测试模式，免费" : ˋ按实际用量结算，每轮最多 ${work.pricing.textMax.toLocaleString("zh-CN")} 积分ˋ} · Enter 发送，Shift+Enter 换行</small>` | `<small>{replying ? "回复完成后可发送" : ˋ${work.pricing.mock ? "测试模式，免费" : "按实际用量结算"} · Enter 发送，Shift+Enter 换行ˋ}</small>` |
| ip/director/director-assistant.tsx ×2 | `"等这条回复完成"` | `"请等待回复完成"` |
| ip/director/director-assistant.tsx | `（还是空的）` | `（暂无内容）` |
| ip/director/director-assistant.tsx | `按住标题栏可以拖动` | `按住标题栏可拖动` |
| ip/director/director-assistant.tsx | `会参考：{linked}` | `将参考：{linked}` |
| ip/director/director-assistant.tsx | `aria-label="在助手里继续"` | `aria-label="在助手中继续"` |
| ip/director/director-assistant.tsx | `转到侧边栏的创作助手，可以看历史对话` | `转到侧边栏的创作助手，可查看历史对话` |
| ip/director/director-assistant.tsx | `<span>在助手里继续</span>` | `<span>在助手中继续</span>` |
| ip/director/director-assistant.tsx | `说说你想怎么改，我先给建议，你看过对比再决定用不用。` | `输入修改要求，助手会给出建议，你可在对比后决定是否采用。` |
| ip/director/director-assistant.tsx | `"AI 正在回复，回复完成后再发送"` | `"AI 正在回复，回复完成后可发送"` |
| ip/director/director-assistant.tsx | `ˋ想怎么改？比如「${quick[0]}」ˋ` | `ˋ想如何修改？例如「${quick[0]}」ˋ` |
| ip/director/director-assistant.tsx | `按住标题栏可以拖到别处，拖四边或右下角可以调整大小` | `按住标题栏可拖动位置，拖动边缘或右下角可调整大小` |

#### ip/director/director-workbench.tsx

| 位置 | 原文 | 改为 |
|---|---|---|
| ip/director/director-workbench.tsx | `AI 正在看你的想法` | `AI 正在分析你的想法` |
| ip/director/director-workbench.tsx | `第一步：说说你的想法，或粘贴剧本` | `第一步：描述你的想法，或粘贴剧本` |
| ip/director/director-workbench.tsx | `下一步：信息够了，生成剧本` | `下一步：生成剧本` |
| ip/director/director-workbench.tsx | `片段视频生成中，完成后自动出现在片段卡` | `片段视频生成中，完成后将显示在片段卡上` |
| ip/director/director-workbench.tsx | `还是找不到这部作品。请先在回收站恢复，再重新加载。` | `仍未找到此作品。请在回收站恢复后重新加载。` |
| ip/director/director-workbench.tsx | `可能已在其他页面删除。删除的作品在回收站里，恢复后点「重新加载」。` | `可能已在其他页面删除。删除的作品可在回收站恢复，恢复后点击「重新加载」。` |
| ip/director/director-workbench.tsx | `<Loader2 size={22} className="ip-loading-icon"/>加载中…</>` | `<Loader2 size={22} className="ip-loading-icon"/>正在加载作品…</>` |
| ip/director/director-workbench.tsx | `"规划分镜"` | `"写分镜脚本"` |
| ip/director/director-workbench.tsx | `已停止后续处理，已提交模型的请求仍在等待用量结算。可另行确认生成，原请求按实际用量计费。` | `已停止后续处理。已提交给模型的请求正在等待用量结算，将按实际用量计费。` |
| ip/director/director-workbench.tsx | `停止后已有内容会保留；已提交模型的请求仍按实际用量计费。` | `停止后已有内容将保留；已提交给模型的请求仍按实际用量计费。` |
| ip/director/director-workbench.tsx | `名字已恢复成原来的，可以重新输入后再试。` | `作品名已恢复为原名称，请重新输入后重试。` |
| ip/director/director-workbench.tsx | `从剧本一路做到每集的成片：拆分集、提取资产、写分镜脚本、出资产图和分镜图、生成片段视频，最后导出整集。` | `从剧本制作到每集成片：拆分集、提取资产、写分镜脚本、生成资产图和分镜图、生成片段视频，最后导出整集。` |
| ip/director/director-workbench.tsx | `做到资产图和分镜图为止，不生成视频。` | `制作到资产图和分镜图为止，不生成视频。` |
| ip/director/director-workbench.tsx | `只做文字：拆分集、提取资产、写分镜脚本（每段的镜头、分镜图提示词和视频提示词），不出图。` | `只处理文字：拆分集、提取资产、写分镜脚本（每段的镜头、分镜图提示词和视频提示词），不生成图片。` |
| ip/director/director-workbench.tsx | `快捷方式：从剧本一路自动做到成片（也可以只做到分镜脚本或分镜图），后台执行，关掉页面不中断。想逐步检查每一步，就按剧本页的步骤来。` | `快捷方式：从剧本自动制作到成片（也可只制作到分镜脚本或分镜图），在后台执行，关闭页面不影响进行。如需逐步检查，请按剧本页的步骤操作。` |
| ip/director/director-workbench.tsx | `"关闭这条提示"` | `"关闭此提示"` |
| ip/director/director-workbench.tsx | `ˋ全部 ${work.episodes.length} 集ˋ : "这一集"` | `ˋ全部 ${work.episodes.length} 集ˋ : "本集"` |
| ip/director/director-workbench.tsx | `的分镜脚本都已写好。一键制作只补还没做的步骤，不会重写已有的分镜脚本；要重写，请到「分镜」点「重写分镜脚本」（整集），或在片段上点「重写」（单段）。` | `的分镜脚本均已写好。一键制作只补充未完成的步骤，不会重写已有的分镜脚本；如需重写，请在「分镜」点击「重写分镜脚本」（整集），或在片段上点击「重写」（单段）。` |
| ip/director/director-workbench.tsx | `这是快捷方式，后面几步会连着自动做完。想每一步先看再改，就关掉这个窗口，在剧本页按步骤来。` | `这是快捷方式，将自动连续完成后续步骤。如需逐步检查和修改，请关闭此窗口，按剧本页的步骤操作。` |
| ip/director/director-workbench.tsx | `<span>做到哪一步</span>` | `<span>制作到</span>` |
| ip/director/director-workbench.tsx | `{note}已经做好的不重做，已有内容不覆盖。` | `{note}已完成的步骤不重复执行，已有内容不会被覆盖。` |
| ip/director/director-workbench.tsx | `>只做第 {ep?.no} 集<` | `>仅第 {ep?.no} 集<` |
| ip/director/director-workbench.tsx | `关键步骤停下来让我确认` | `关键步骤暂停等我确认` |
| ip/director/director-workbench.tsx | `、片段视频" : ""}出来后先等你看过再继续。不勾就全自动，做完再看。` | `、片段视频" : ""}生成后暂停，确认后继续。不勾选则全自动完成。` |
| ip/director/director-workbench.tsx | `还没规划的部分按默认篇幅估算（每集约 75 秒）。` | `尚未规划的部分按默认篇幅估算（每集约 75 秒）。` |
| ip/director/director-workbench.tsx | `推荐值比估算多留约 15% 余量；用到上限会暂停，不会超支，没用完的不扣。` | `推荐预算在估算基础上预留约 15% 余量；达到上限会暂停，不会超支，未用完的部分不扣除。` |
| ip/director/director-workbench.tsx | `积分，做到一半会暂停。` | `积分，制作中途会暂停。` |
| ip/director/director-workbench.tsx | `剧本、图片和视频均为固定样例，不调用模型，不扣积分。` | `剧本、图片和视频均为固定样例，不调用模型，不消耗积分。` |

#### styles/director.css

| 位置 | 原文 | 改为 |
|---|---|---|
| styles/director.css `.director-video-cost` | `max-width: 220px` | `max-width: 360px`（价格说明变长后不被截掉；悬停 title 也改成完整价格 + 参考素材） |

#### 行为上的小改动（只为把原因写出来，都是决定 #7 / #2 / #12 / 表内要求）

| 位置 | 改动 |
|---|---|
| ip/director/director-script.tsx `RegenerateScript` | 「重新生成剧本」不可点时，按钮旁显示「请先删除已有分镜图或视频的片段」或「助手回复完成后可重新生成」 |
| ip/director/director-split.tsx `ReferenceNotes` | 「并入第 1 集」不可点时，旁边显示「请先保存修改」 |
| ip/director/director-storyboard.tsx 待替换分镜脚本条 | 「换成新版本」不可点时，显示「请先删除已有分镜图或视频的片段，才能换成新版本」；原 title 还漏了视频，一并改对（代码同时判断分镜图和视频） |
| ip/director/director-output.tsx `EpisodeOutput` | 「导出整集」不可点时，旁边显示「N 个片段缺少视频」或「N 个片段的视频待确认」，完整片段名放 title |
| ip/director/director-assistant.tsx 两个输入框 + 头部 | 回复中发送键不可点：输入框底部那行改显示「回复完成后可发送」；「新对话」不可点：上下文条多一行「回复完成后可新建对话」 |
| ip/director/director-assets.tsx 添加资产 | 「添加」不可点时显示「请填写名称」或「至少选择一集」（此前名称为空没有任何提示） |
| ip/director/director-assistant.tsx 两个输入框 | #2：去掉「每轮最多 N 积分」，`git grep -n 'pricing.textMax.toLocaleString' -- apps/web-aiavatar/src` 现为 0 命中 |
| ip/director/director-output.tsx | #12：`git grep -n 少量 -- apps/web-aiavatar/src/ip/director` 现为 0 命中 |

#### 测试同步

改了断言：`director-asset-studio` `director-assets-batch` `director-assets-link` `director-assistant` `director-brief` `director-deletion-state` `director-errors` `director-long-text` `director-oneclick` `director-own-image` `director-rewrite` `director-script-file` `director-settings` `director-storyboard` `director-trash` `director-video-rewrite` `director-voice` `director-works`（都在 `ip/director/*.test.tsx`）。

新增 4 条：不可点原因可见（`director-script.test` 重新生成剧本、`director-storyboard.test` 换成新版本、`director-video-rewrite.test` 导出整集），输入框不显示冻结上限（`director-assistant.test`）。

## 存疑项选了哪种写法

| 存疑 | 选择 | 说明 |
|---|---|---|
| 1. 价格前的「约」 | 保留「约 N 积分」 | 有折扣和赠款，实际可能更低 |
| 2. 「出图提示词」字段名 | 保留 | 服务端原因文案和 AGENTS 大量使用，这是字段名，不是按钮或状态。改成「资产图提示词」要带服务端一起改 |
| 3. 「先聊几句，再写剧本」 | 不适用 | 这句已不在代码里，创意对话已搬进助手 |
| 4. 「去生成分镜图」 | 「生成分镜图」 | 点了打开弹窗，不直接扣费 |
| 5. 「做到哪一步」 | 「制作到」 | 后面跟「成片 / 分镜图 / 分镜脚本」三个选项 |
| 6. 「自己上传」 | 「已上传」 | 资产卡片和详情两处都改 |
| 7. 「不保存」 | 「丢弃清单」 | 它丢弃整份清单，一键制作在此停止，「不保存」说轻了 |
| 另：「放弃拆分」 | 「放弃分集」 | 按叫法表，和操作名「放弃这次分集」一致 |
| 另：「正在读取文件…」「取消读取」 | 「正在提取文字…」「取消提取」 | 这是上传加提取，不是加载，所以没用叫法表的「正在加载」 |
| 另：`未知角色（{id}）`、`资产「{id}」不存在` | 「未知角色」「该资产已不存在（取消勾选以移除）」 | 决定里的写法，不露 id |

---

# 第 6 批 · 资产、发行、名片、授权

位置相对 `apps/web-aiavatar/src/`。同一条规则在文件里出现多次的只列一行。

#### 公开名片：写死的内容只在演示名片显示（改了行为，用户决定 #1）

| 位置 | 原来 | 现在 |
|---|---|---|
| `components/card/card-view.tsx` `Works` | `/card/demo-works.jpg` 图卡每张名片都显示 | 包 `card.demo &&`；真实名片左栏 `flex:1` 占满整行，标题和正文不塌 |
| `components/card/card-view.tsx` `Contact` | 「想聊门店线上化……」每张名片都显示 | 包 `card.demo &&`；标题下直接接联系方式（列表自带 `marginTop:16`）；破折号改逗号 |
| `components/card/card-view.tsx` `Contact` | 「关于这张名片」+ `ABOUT` 三条每张都显示 | 包 `card.demo &&` |
| `components/card/card-view.tsx` `Contact` 页脚 | 「形象为本人授权数字人 · 内容由本人确认」每张都显示 | 包 `card.demo &&`；REG 那行保留 |

#### 文字

| 位置 | 原文 | 改为 |
|---|---|---|
| `app/assets/page.tsx` | 人物、声音与创作素材，让每一次灵感有所承接。 | 人物、声音和创作素材，创作时可直接使用。 |
| `app/assets/page.tsx` | 人物、声音和素材，做什么都能直接拿来用 | 人物、声音和素材，创作时可直接使用。 |
| `app/assets/page.tsx` | 正在打开资产… | 正在加载资产… |
| `components/hub/assets-library.tsx` | 人物、声音与创作素材，让每一次灵感有所承接。 | 人物、声音和创作素材，创作时可直接使用。 |
| `components/hub/assets-library.tsx` | 人物、声音和素材，做什么都能直接拿来用 | 人物、声音和素材，创作时可直接使用。 |
| `components/hub/assets-library.tsx` | 正在打开资产… | 正在加载资产… |
| `app/assets/[id]/page.tsx` | 补齐标准图：还差 ${DATA.SHOTS.length - shotDone} 张，补完正面 / 侧面 / 全身出图会是同一张脸 | 补齐标准图：还差 ${DATA.SHOTS.length - shotDone} 张，补齐后正面、侧面、全身图保持同一张脸 |
| `app/assets/[id]/page.tsx` | 补多角度图集：转到侧面还是同一张脸 | 补充多角度图集：侧面角度也保持同一张脸 |
| `app/assets/[id]/page.tsx` | 补一组表情：出片时不会从头到尾一个表情 | 补充表情图：生成视频时表情更丰富 |
| `app/assets/[id]/page.tsx` | 补几张场景图：换背景不用每次重新生成 | 补充场景图：更换背景时无需重新生成 |
| `app/assets/[id]/page.tsx` | 补一套换装：换场景时衣服不会变来变去 | 补充换装：切换场景时服装保持一致 |
| `app/assets/[id]/page.tsx` | 补 3D 模型：可以换任意角度重新出图 | 补充 3D 模型：可从任意角度生成图片 |
| `app/assets/[id]/page.tsx` | 补一段运镜视频：名片首图就能动起来 | 补充运镜视频：名片首图可动态展示 |
| `app/assets/[id]/page.tsx` | 绑一个声音：视频里就用这个声线说话 | 绑定声音：视频将使用此声音配音 |
| `app/assets/[id]/page.tsx` | 写两句人设：AI 写台词时知道这个角色该怎么说话 | 填写人设：AI 写台词时会参照角色的说话方式 |
| `app/assets/[id]/page.tsx` | title="资产名片" | title="资产详情" |
| `app/assets/[id]/page.tsx` | actionLabel="回资产货架" | actionLabel="返回资产" |
| `app/assets/[id]/page.tsx` | title: "合成出片" | title: "合成视频" |
| `app/assets/[id]/page.tsx` | <LoadingBlock label="素材加载中" /> | <LoadingBlock label="正在加载素材…" /> |
| `app/assets/[id]/page.tsx` | <EmptyState text={`素材加载失败：${derivs.error}`} /> | <EmptyState text="素材加载失败，请稍后刷新重试。" /> |
| `app/assets/[id]/page.tsx` | 还没有可切换的素材。生成表情、换装或运镜视频后，这里就能换着看 | 还没有可切换的素材。生成表情、换装或运镜视频后，可在此切换查看。 |
| `app/assets/[id]/page.tsx` | actionLabel="去生成" | actionLabel="生成素材" |
| `app/assets/[id]/page.tsx` | >换一个样子看看</span> | >切换形象</span> |
| `app/assets/[id]/page.tsx` | >点一下切换</span> | >点击切换</span> |
| `app/assets/[id]/page.tsx` | 其余素材加载失败：{derivs.error} | 部分素材加载失败，请稍后刷新重试。 |
| `app/assets/[id]/page.tsx` | >换一个 ›</span> | >更换 ›</span> |
| `app/assets/[id]/page.tsx` | 授权状态加载中… | 正在加载授权状态… |
| `app/assets/[id]/page.tsx` | 授权状态加载失败：{licenses.error} | 授权状态加载失败，请稍后刷新重试。 |
| `app/assets/[id]/page.tsx` | 确认平台协议 + 本人刷脸后才能出片 | 确认平台协议并完成本人刷脸后，可生成视频 |
| `app/assets/[id]/page.tsx` | "去完成 ›" | "完成授权 ›" |
| `app/assets/[id]/page.tsx` | >去补 ›</span> | >补充 ›</span> |
| `app/assets/[id]/page.tsx` | title="被用在哪" | title="使用记录" |
| `app/assets/[id]/page.tsx` | <LoadingBlock label="使用记录加载中" /> | <LoadingBlock label="正在加载使用记录…" /> |
| `app/assets/[id]/page.tsx` | <EmptyState text={`使用记录加载失败：${refs.error \|\| compositions.error \|\| cards.error}`} /> | <EmptyState text="使用记录加载失败，请稍后刷新重试。" /> |
| `app/assets/[id]/page.tsx` | 还没有被使用的记录，出一条片就有了 | 暂无使用记录。 |
| `app/assets/[id]/page.tsx` | actionLabel="去创作" | actionLabel="开始创作" |
| `app/assets/[id]/page.tsx` | 去工作室创作 | 开始创作 |
| `app/assets/[id]/page.tsx` | 建卡没成功，稍后再试 | 名片创建失败，请重试。 |
| `app/assets/[id]/page.tsx` | 这个形象已经有名片了。访客打开就能点着切换装扮和表情。 | 此形象已有名片，访客打开后可切换查看装扮和表情。 |
| `app/assets/[id]/page.tsx` | 把这个形象做成一张名片：名字和它的整柜造型自动带过去，访客能点着换装看，你只要再填联系方式。 | 用此形象创建名片：名字和全部造型自动带入，访客可切换查看造型，你只需填写联系方式。 |
| `app/assets/[id]/page.tsx` | 去编辑名片 | 编辑名片 |
| `app/assets/[id]/page.tsx` | {busy ? "建卡中" : "做成数字名片"} | {busy ? "创建中" : "创建数字名片"} |
| `app/card/p/[slug]/page.tsx` | "名片打不开了" | "名片加载失败" |
| `app/card/p/[slug]/page.tsx` | "名片暂时打不开" | "名片加载失败" |
| `app/card/p/[slug]/page.tsx` | 链接可能已经失效，或者名片主人取消了发布。找他要一张新的吧。 | 链接可能已失效，或名片已取消发布。请联系名片主人获取新链接。 |
| `app/card/p/[slug]/page.tsx` | ${load.message}。稍后再试，或者直接联系名片主人。 | ${load.message}。请稍后重试，或联系名片主人。 |
| `app/card/p/[slug]/page.tsx` | 正在打开名片 | 正在加载名片… |
| `app/cards/page.tsx` | 名片列表没加载出来，刷新页面再试 | 名片列表加载失败，请稍后刷新重试。 |
| `app/cards/page.tsx` | 演示模式下不改状态 | 演示模式下无法修改发布状态 |
| `app/cards/page.tsx` | 已取消发布，链接立刻打不开了 | 已取消发布，链接已失效 |
| `app/cards/page.tsx` | 已发布，链接可以递出去了 | 已发布，可分享链接 |
| `app/cards/page.tsx` | "操作没成功" | "操作失败，请重试。" |
| `app/cards/page.tsx` | 复制没成功，长按地址栏手动复制 | 复制失败，请手动复制卡片上的链接。 |
| `app/cards/page.tsx` | 名片是数字资产的对外发布面 —— 形象直接引用你的数字人，换了形象名片自动跟着变。发布后拿到一条链接，见客户扫码就能打开，对方不用注册。 | 名片用于对外展示你的数字人，更换形象后名片同步更新。 发布后会生成一条链接，对方打开链接直接查看，无需注册。 |
| `app/cards/page.tsx` | 还没有名片。打开一个数字人形象，在「数字名片」那一节点「做成数字名片」，名字和整柜造型会自动带过来，你只要再填联系方式。 | 还没有名片。打开一个数字人形象，在「数字名片」中点击「创建数字名片」，名字和造型会自动带入，你只需填写联系方式。 |
| `app/cards/page.tsx` | actionLabel="去打开一个形象" | actionLabel="前往资产" |
| `app/cards/page.tsx` | 演示模式：这里只展示一张内置样例名片，改动不会保存。 | 演示模式：仅展示一张示例名片，修改不会保存。 |
| `app/cards/page.tsx` | 取消发布后链接立刻打不开；形象被删或授权撤销时，名片会回落到已缓存的图并通知你。 | 取消发布后链接立即失效。 |
| `app/cards/[id]/edit/page.tsx` | "名片读不出来" | "名片加载失败，请稍后刷新重试。" |
| `app/cards/[id]/edit/page.tsx` | say("先填个名字") | say("请填写名字") |
| `app/cards/[id]/edit/page.tsx` | 已发布，链接可以递出去了 | 已发布，可分享链接 |
| `app/cards/[id]/edit/page.tsx` | "保存没成功" | "保存失败，请重试。" |
| `app/cards/[id]/edit/page.tsx` | 形象和造型已经从数字资产带过来了，访客能在名片上点着换装看。 下面这些是机器猜不出来的。 | 形象和造型已从数字资产带入，访客可在名片上切换查看。 请补充以下信息。 |
| `app/cards/[id]/edit/page.tsx` | 名片打开时第一眼看到的东西。选图片时访客可以点着换装扮和表情；选视频会自动播一遍，播完可以重播。 | 访客打开名片时首先看到的内容。选择图片时，访客可切换装扮和表情；选择视频时自动播放一次，可重播。 |
| `app/cards/[id]/edit/page.tsx` | placeholder="对外用的名字" | placeholder="对外显示的名字" |
| `app/cards/[id]/edit/page.tsx` | 名片顶部那排大写拉丁字母。留空就不显示。 | 名片顶部的大写拉丁字母，留空则不显示。 |
| `app/cards/[id]/edit/page.tsx` | 见客户时你最想让对方记住的一句。可以换行分两行。 | 最希望对方记住的一句话，可换行分两行。 |
| `app/cards/[id]/edit/page.tsx` | placeholder="一行一条" | placeholder="每行一条" |
| `app/cards/[id]/edit/page.tsx` | addLabel="加一个作品" | addLabel="添加作品" |
| `app/cards/[id]/edit/page.tsx` | placeholder="做了什么" | placeholder="作品名称" |
| `app/cards/[id]/edit/page.tsx` | placeholder="一两句说清楚它解决了什么" | placeholder="用一两句话说明它解决的问题" |
| `app/cards/[id]/edit/page.tsx` | 行业 · 规模 · 成立年份这类。 | 例如行业、规模、成立年份。 |
| `app/cards/[id]/edit/page.tsx` | placeholder="在做什么、服务谁" | placeholder="公司业务和服务对象" |
| `app/cards/[id]/edit/page.tsx` | 名片上并排显示的那几个数（客户数、门店数、服务年限…）。 | 名片上并排显示的数字，例如客户数、门店数、服务年限。 |
| `app/cards/[id]/edit/page.tsx` | addLabel="加一个数字" | addLabel="添加数字" |
| `app/cards/[id]/edit/page.tsx` | 按时间排。名片上是一条竖线串起来的。 | 按时间排列，名片上以时间轴展示。 |
| `app/cards/[id]/edit/page.tsx` | addLabel="加一条" | addLabel="添加" |
| `app/cards/[id]/edit/page.tsx` | label="发生了什么" | label="事件" |
| `app/cards/[id]/edit/page.tsx` | placeholder="来源 · 时长 / 篇幅" | placeholder="来源、时长或篇幅" |
| `app/cards/[id]/edit/page.tsx` | addLabel="加一段经历" | addLabel="添加经历" |
| `app/cards/[id]/edit/page.tsx` | placeholder="2019 — 至今" | placeholder="例如：2019 年至今" |
| `app/cards/[id]/edit/page.tsx` | 有改动还没保存 —— 包括人设那块「采用」进来的内容。 | 有未保存的修改，包括人设中已采用的内容。 |
| `app/cards/[id]/edit/page.tsx` | `还差：${missing.join(" · ")}` | `请填写：${missing.join("、")}` |
| `app/cards/[id]/edit/page.tsx` | 发布后这张名片就能被任何拿到链接的人打开，不需要注册。随时可以取消发布。 | 发布后，任何人可通过链接打开此名片，无需注册。可随时取消发布。 |
| `app/cards/[id]/edit/page.tsx` | `还差 ${missing.join(" 和 ")} 才能发布，草稿可先保存。` | `请填写${missing.join("和")}后发布，草稿可先保存。` |
| `app/licenses/page.tsx` | >待补确认< | >待补充确认< |
| `app/licenses/page.tsx` | 平台协议确认 + 本人刷脸核验 | 平台协议确认、本人刷脸核验 |
| `app/licenses/page.tsx` | "去补确认 ›" | "补充确认 ›" |
| `app/licenses/page.tsx` | 还没有授权给你的明星形象。到 AI 明星带货里挑选明星并发起授权申请，通过后会出现在这里 | 还没有明星形象授权。在 AI 明星带货中选择明星并申请授权，审批通过后将显示在这里。 |
| `app/licenses/page.tsx` | 明星授权的申请与审批在带货线和「明星工作台」完成，这里只看结果和授权内容。 | 明星授权在 AI 明星带货和「明星工作台」中申请和审批，此处仅展示授权结果。 |
| `app/licenses/page.tsx` | 还没有授权记录。真人数字人完成协议确认与刷脸核验后，证书会出现在这里 | 还没有授权记录。真人数字人完成协议确认和刷脸核验后，证书将显示在这里。 |
| `app/licenses/page.tsx` | actionLabel="去真人授权" | actionLabel="发起真人授权" |
| `components/card/card-view.tsx` | 已生成联系人文件，按提示存入通讯录 | 联系人文件已下载，请按提示存入通讯录。 |
| `components/card/card-view.tsx` | 复制没成功，长按选中试试 | 复制失败，请手动选中复制。 |
| `components/card/card-view.tsx` | {hasWechat ? "加微信" : "复制信息"} | {hasWechat ? "复制微信号" : "保存联系人"} |
| `components/card/card-view.tsx` | 存到通讯录 | 保存到通讯录 |
| `components/card/card-view.tsx` | 存到通讯录 | 保存到通讯录 |
| `components/card/card-view.tsx` | <Mono color={ON_SLATE_3}>形象为本人授权数字人 · 内容由本人确认</Mono> | {card.demo && <Mono color={ON_SLATE_3}>形象为本人授权数字人 · 内容由本人确认</Mono>} |
| `components/card/card-view.tsx` | >存下 {card.name}</span> | >保存 {card.name} 的联系方式</span> |
| `components/card/card-view.tsx` | 微信里存不进系统通讯录。逐条复制，或右上角用浏览器打开再存。 | 微信内无法保存到通讯录。请逐条复制，或点击右上角在浏览器中打开后保存。 |
| `components/card/persona-studio.tsx` | "聊不通，稍后再试" | "人设对话失败，请重试。" |
| `components/card/persona-studio.tsx` | 已经填进上面的表单了（记得点页面底部的保存）。要不要按这个人设，把「一句话 / 能提供 / 在找」也顺一遍？ | 已填入上方表单，请点击页面底部的「保存草稿」保存。如需按此人设改写「一句话 / 能提供 / 在找」，可点击「按人设改写名片文案」。 |
| `components/card/persona-studio.tsx` | "改写没成功，稍后再试" | "改写失败，请重试。" |
| `components/card/persona-studio.tsx` | placeholder="这个人骨子里是谁" | placeholder="例如：做事较真、说到做到的实干派" |
| `components/card/persona-studio.tsx` | 一行一条。这些是访客在名片上看得到的。 | 每行一条，访客可在名片上看到。 |
| `components/card/persona-studio.tsx` | placeholder="一行一条" | placeholder="每行一条" |
| `components/card/persona-studio.tsx` | 逗号或换行分隔。 | 输入后按回车添加。 |
| `components/card/persona-studio.tsx` | placeholder="加一个特征" | placeholder="添加特征" |
| `components/card/persona-studio.tsx` | 「按人设改写文案」按这一条来写；将来数字人开口也按它。 | 「按人设改写名片文案」时参照此项。 |
| `components/card/persona-studio.tsx` | placeholder="例：句子短，先给结论，不铺垫" | placeholder="例如：句子简短，先说结论" |
| `components/card/persona-studio.tsx` | 一行一条。改写时会避开。 | 每行一条，改写时会避开。 |
| `components/card/persona-studio.tsx` | "接着聊，改改人设" | "继续对话" |
| `components/card/persona-studio.tsx` | 名片上现在写的是你**做过什么**。但见了面真正被记住的，是你在意什么、说话什么调子。 跟顾问聊几句 —— 它问的都是具体的小事，你照实说就行，价值观和性格由它替你提炼。 | 名片目前展示的是你做过什么。 与顾问对话几轮，它会从你的回答中提炼价值观、性格和说话风格。 |
| `components/card/persona-studio.tsx` | 随便从哪句开始都行。顾问会一次问一个具体的问题。 | 可从任意话题开始，顾问每次会问一个具体问题。 |
| `components/card/persona-studio.tsx` | 想一下… | 正在思考… |
| `components/card/persona-studio.tsx` | placeholder="照实说就行" | placeholder="输入你的回答" |
| `components/card/persona-studio.tsx` | >不用</Btn> | >不采用</Btn> |
| `components/card/persona-studio.tsx` | >换一版</Btn> | >重新改写</Btn> |
| `components/card/persona-studio.tsx` | >聊出来的人设</span> | >人设草稿</span> |
| `components/card/persona-studio.tsx` | >就它了</Btn> | >采用</Btn> |
| `components/card/persona-studio.tsx` | >再聊聊</Btn> | >继续对话</Btn> |
| `ip/asset-thumb.tsx` | '视频暂时读不到' | '视频加载失败' |
| `ip/asset-thumb.tsx` | '图片暂时读不到' | '图片加载失败' |
| `ip/assets-hub.tsx` | label: '从画布存的' | label: '从画布保存' |
| `ip/assets-hub.tsx` | description="人物、声音与创作素材，让每一次灵感有所承接。" | description="人物、声音和创作素材，创作时可直接使用。" |
| `ip/assets-hub.tsx` | nextDescription="上传的和 AI 做的都在这里，做视频、出图时直接拿来用" | nextDescription="上传和 AI 生成的素材都在这里，生成图片和视频时可直接使用。" |
| `ip/assets-hub.tsx` | '里面的东西不会删，会回到「全部」里。画布里已经用上的也不受影响。' | '库中的素材不会被删除，仍可在「全部」中找到。已在画布中使用的素材不受影响。' |
| `ip/assets-hub.tsx` | label: '改名' | label: '重命名' |
| `ip/assets-hub.tsx` | value?.id ? '改名' : '新建资产库' | value?.id ? '重命名资产库' : '新建资产库' |
| `ip/assets-hub.tsx` | >重新读取</button> | >重试</button> |
| `ip/assets-hub.tsx` | >重新读取</Button> | >重试</Button> |
| `ip/assets-hub.tsx` | <p>做出来的图片、视频和音频会自动放在这里，移到别的资产库就从这里拿走。</p> | <p>AI 生成的图片、视频和音频会自动保存在这里，移到其他资产库后不再显示在此处。</p> |
| `ip/assets-hub.tsx` | '正在读取…' | '正在加载…' |
| `ip/assets-hub.tsx` | aria-label="正在读取资产" | aria-label="正在加载资产" |
| `ip/assets-hub.tsx` | <h3>这里还是空的</h3><p>在 AI 图片、AI 视频或画布里做出来的东西会自动放进来。</p> | <h3>还没有 AI 生成的素材</h3><p>在 AI 图片、AI 视频或画布中生成的内容会自动保存在这里。</p> |
| `ip/assets-hub.tsx` | >去做一张图</Link> | >生成图片</Link> |
| `ip/assets-hub.tsx` | <h3>没有找到</h3><p>换个名称或来源试试。</p> | <h3>没有找到匹配的素材</h3><p>请尝试其他名称或来源。</p> |
| `ip/assets-hub.tsx` | <summary>生成时的描述</summary> | <summary>提示词</summary> |
| `ip/assets-hub.tsx` | >暂时读不到</span> | >加载失败</span> |
| `ip/assets-hub.tsx` | `把 ${item.title} 移到资产库` | `将 ${item.title} 移到资产库` |
| `ip/assets-hub.tsx` | />人物的声音</span> | />人物声音</span> |
| `ip/assets-people.tsx` | '还没有图' | '暂无图片' |
| `ip/assets-people.tsx` | <h3>AI 生成里没有人物</h3><p>这里只放做出来的图片、视频和音频。人物在「全部」里。</p> | <h3>AI 生成中没有人物</h3><p>此处仅保存 AI 生成的图片、视频和音频，人物请在「全部」中查看。</p> |
| `ip/assets-people.tsx` | '正在读取…' | '正在加载…' |
| `ip/assets-people.tsx` | >重新读取</Button> | >重试</Button> |
| `ip/assets-people.tsx` | />用照片建</button> | />使用照片创建</button> |
| `ip/assets-people.tsx` | />录一段视频建</Link> | />录制视频创建</Link> |
| `ip/assets-people.tsx` | <h3>没有找到</h3><p>换个名字或筛选试试。</p> | <h3>没有找到匹配的人物</h3><p>请尝试其他名字或筛选条件。</p> |
| `ip/assets-people.tsx` | `已建好「${o.name}」` | `已创建「${o.name}」` |
| `ip/assets-people.tsx` | '还没写设定' | '暂无设定' |
| `ip/assets-people.tsx` | '先写个名字' | '请填写名字' |
| `ip/assets-people.tsx` | '还差一张正脸' | '请添加正脸照片' |
| `ip/assets-people.tsx` | '勾选下面的确认' | '请勾选下方的确认' |
| `ip/assets-people.tsx` | `换一张${s.label}` | `更换${s.label}` |
| `ip/assets-people.tsx` | `从资产库选${s.label}` | `从资产库选择${s.label}` |
| `ip/assets-people.tsx` | >换一张</span> | >更换</span> |
| `ip/assets-people.tsx` | <i>可选</i> | <i>选填</i> |
| `ip/assets-people.tsx` | title={`选${SHOTS.find | title={`选择${SHOTS.find |
| `ip/assets-people.tsx` | intro="从资产库里选一张；新照片点「上传到这个库」。" | intro="从资产库中选择一张，新照片请点击「上传到此资产库」。" |
| `ip/ip-management.tsx` | "IP 列表没有读取成功" | "IP 列表加载失败" |
| `ip/ip-management.tsx` | "人物素材没有读取成功" | "人物素材加载失败" |
| `ip/ip-management.tsx` | "人物声音没有读取成功" | "人物声音加载失败" |
| `ip/ip-management.tsx` | 上一张画布已创建但引用尚未保存，请先打开已有画布继续。 | 上一张画布已创建，但引用尚未保存，请打开已创建的画布。 |
| `ip/ip-management.tsx` | 正在打开我的 IP… | 正在加载我的 IP… |
| `ip/ip-management.tsx` | '正在读取 IP…' | '正在加载 IP…' |
| `ip/ip-management.tsx` | '暂时无法读取 IP' | 'IP 加载失败' |
| `ip/ip-management.tsx` | 正在读取你的 IP… | 正在加载 IP… |
| `ip/ip-management.tsx` | >重新加载</button> | >重试</button> |
| `ip/ip-management.tsx` | "为你的第一个角色留一个位置" | "还没有 IP" |
| `ip/ip-management.tsx` | "换个关键词，或清除当前筛选。" | "请更换关键词或清除筛选。" |
| `ip/ip-management.tsx` | "在画布里创作并归档形象，就能在这里管理角色、视角与设定。" | "在画布中生成并归档形象后，可在此管理角色、视角和设定。" |
| `ip/ip-management.tsx` | >重新读取</button> | >重试</button> |
| `ip/ip-management.tsx` | "记录角色的第一句介绍" | "暂无简介" |
| `ip/ip-management.tsx` | "尚未填写角色描述。可以编辑设定，记录身份、性格与故事。" | "尚未填写角色描述。可在编辑设定中填写身份、性格和故事。" |
| `ip/ip-management.tsx` | >打开已创建的画布继续</Link> | >打开已创建的画布</Link> |
| `ip/ip-management.tsx` | "生成形象" | "新建画布" |
| `ip/ip-management.tsx` | <small>免费进入画布。生成前在节点里确认模型、参考与积分。</small> | <small>新建画布不消耗积分。生成前可在画布中确认模型、参考图和积分。</small> |
| `ip/ip-management.tsx` | saving ? "正在保存" : "保存设定" | saving ? "保存中" : "保存设定" |
| `ip/ip-management.tsx` | description="人物设定、形象版本与作品，在这里延续。" | description="管理人物设定、形象版本和作品。" |
| `ip/personal-asset-library.tsx` | '文件夹名称暂不可用' | '未知文件夹' |
| `ip/personal-asset-library.tsx` | 按作品或主题整理，下一次创作更好找。 | 按作品或主题整理，方便下次创作时查找。 |
| `ip/personal-asset-library.tsx` | 文件夹读取失败： | 文件夹加载失败： |
| `ip/personal-asset-library.tsx` | >重新读取文件夹</Button> | >重试</Button> |
| `ip/personal-asset-library.tsx` | '正在读取资产…' | '正在加载资产…' |
| `ip/personal-asset-library.tsx` | '暂时无法读取资产' | '资产加载失败' |
| `ip/personal-asset-library.tsx` | <h3>资产读取失败</h3> | <h3>资产加载失败</h3> |
| `ip/personal-asset-library.tsx` | >重新读取资产</Button> | >重试</Button> |
| `ip/personal-asset-library.tsx` | '从第一份素材开始' | '还没有资产' |
| `ip/personal-asset-library.tsx` | '试试其他名称或筛选条件。' | '请尝试其他名称或筛选条件。' |
| `ip/personal-asset-library.tsx` | '在剧本中提取角色、场景和道具，也可以从这里新建。' | '可在剧本中提取角色、场景和道具，也可在此新建。' |
| `ip/personal-asset-library.tsx` | '生成结果会自动入库，也可以上传自己的图片、视频、音频或文本。' | '生成结果会自动保存到这里，也可上传图片、视频、音频或文本。' |
| `ip/personal-asset-library.tsx` | >素材暂不可读取</p> | >素材加载失败</p> |
| `ip/personal-asset-library.tsx` | <summary>生成指令</summary> | <summary>提示词</summary> |
| `ip/personal-asset-library.tsx` | title="新建可复用资产" | title="新建资产" |
| `ip/supplementary-asset-library.tsx` | `正在读取${props.title}…` | `正在加载${props.title}…` |
| `ip/supplementary-asset-library.tsx` | `已读取 ${matches.length} 项，部分内容暂不可用` | `已加载 ${matches.length} 项，部分内容加载失败` |
| `ip/supplementary-asset-library.tsx` | >重新读取</Button> | >重试</Button> |
| `ip/supplementary-asset-library.tsx` | `${props.title}暂不可读取` | `${props.title}加载失败` |
| `ip/supplementary-asset-library.tsx` | '读取恢复后，这里的资产会重新显示。' | '请稍后刷新重试。' |
| `ip/supplementary-asset-library.tsx` | '试试其他名称或筛选条件。' | '请尝试其他名称或筛选条件。' |
| `ip/supplementary-asset-library.tsx` | >重新读取资产</Button> | >重试</Button> |
| `ip/supplementary-asset-library.tsx` | '授权信息读取中' | '正在加载授权信息' |
| `ip/supplementary-asset-library.tsx` | '授权信息暂不可用' | '授权信息加载失败' |
| `ip/supplementary-asset-library.tsx` | `自建形象读取失败：${avatars.error}` | `自建形象加载失败：${avatars.error}` |
| `ip/supplementary-asset-library.tsx` | `明星授权读取失败：${grants.error}` | `明星授权加载失败：${grants.error}` |
| `ip/supplementary-asset-library.tsx` | actionLabel="创建形象" | actionLabel="开始创作" |
| `ip/supplementary-asset-library.tsx` | emptyDescription="创建 AI 原创形象，或从一段视频开始建立自己的数字人。" | emptyDescription="可创建 AI 原创形象，或上传视频创建数字人。" |
| `ip/supplementary-asset-library.tsx` | hint="按音色来源分类，语言与音色特点可以直接搜索。" | hint="按音色来源分类，可直接搜索语言和音色特点。" |
| `ip/supplementary-asset-library.tsx` | `声音读取失败：${voices.error}` | `声音加载失败：${voices.error}` |
| `ip/supplementary-asset-library.tsx` | emptyDescription="录一段自己的声音，或创建适合角色的设计音色。" | emptyDescription="可录制声音，或创建适合角色的设计音色。" |
| `ip/studio-ip-library.tsx` | >{title}素材将在归档后显示</div> | >暂无{title}</div> |
| `ip/studio-ip-library.tsx` | 正在读取人物档案… | 正在加载人物… |
| `ip/studio-ip-library.tsx` | >重新加载</Button> | >重试</Button> |
| `ip/studio-ip-library.tsx` | 正在读取声音… | 正在加载声音… |
| `ip/studio-ip-library.tsx` | >重读声音</Button> | >重试</Button> |
| `ip/studio-ip-library.tsx` | 仅整理此素材的类别，保存免费。 | 仅修改素材类别，不消耗积分。 |
| `ip/studio-ip-library.tsx` | '整张设定图会作为角色参考。生成视频前，先用它生成一张单独的镜头画面。' | '整张设定图将作为角色参考。生成视频前，请用它生成一张单独的镜头画面。' |
| `ip/studio-ip-library.tsx` | `将“${selected.name}”添加为人物参考，保留所选形象版本。` | `将「${selected.name}」添加为人物参考，保留所选形象版本。` |
| `ip/studio-ip-library.tsx` | 点开查看设定和素材 | 点击查看设定和素材 |
| `ip/studio-ip-library.tsx` | '换个名称或素材类别试试。' | '请尝试其他名称或素材类别。' |
| `ip/studio-ip-library.tsx` | '在画布生成并采用主形象后，就能在这里管理和引用。' | '在画布中生成并采用主形象后，可在此管理和引用。' |
| `ip/library-asset-editor.tsx` | >一键生成缺图</Button> | >生成缺失主图</Button> |
| `ip/library-asset-editor.tsx` | <label>长期描述< | <label>描述< |
| `ip/library-asset-editor.tsx` | <label>本次生成提示词< | <label>提示词< |
| `ip/library-asset-editor.tsx` | >移除参考</Button> | >移除参考图</Button> |
| `ip/library-asset-editor.tsx` | >保存信息</Button> | >保存</Button> |
| `ip/library-asset-editor.tsx` | title="AI 处理，会消耗积分" | title="AI 处理，将消耗积分" |
| `ip/library-asset-editor.tsx` | title:"AI 处理，会消耗积分" | title:"AI 处理，将消耗积分" |
| `ip/library-asset-editor.tsx` | 新版本不会替换已有画布的引用。生成任务关闭后仍继续，所有候选自动入库。 | 新版本不会替换画布中已有的引用。关闭此窗口后生成仍会继续，结果自动存入资产库。 |
| `ip/library-asset-editor.tsx` | title="生成缺图资产" | title="生成缺失主图" |
| `ip/library-asset-editor.tsx` | 已有主图和正在生成的资产会跳过。提示词缺失的项目需先补充。 | 已有主图或生成中的资产将跳过，缺少提示词的资产需补充后生成。 |
| `ip/library-asset-editor.tsx` | '缺提示词' | '缺少提示词' |
| `ip/library-extraction-panel.tsx` | '剧本解析未完成，原文保留' | '剧本解析失败，原文未改动。' |
| `ip/library-extraction-panel.tsx` | `${value} 文件夹名称暂时无法读取，已保存资产仍可查看。` | `${value} 文件夹加载失败，已保存的资产仍可查看。` |
| `ip/library-extraction-panel.tsx` | `${value} 默认文件夹未能读取，保存位置暂设为未分类，请核对后保存。` | `${value} 默认文件夹加载失败，保存位置已设为「未分类」，请确认后保存。` |
| `ip/library-extraction-panel.tsx` | <h3>素材暂时无法读取</h3><p>请重新读取，已保存的资产仍会保留。</p> | <h3>素材加载失败</h3><p>请重试。已保存的资产不受影响。</p> |
| `ip/library-extraction-panel.tsx` | '正文分析中，可关闭后继续查看。' | '正在分析正文，可关闭此窗口，稍后查看结果。' |
| `ip/library-extraction-panel.tsx` | '核对下方结果，保存后即可在“已保存资产”中查看。'}提取不生成图片。 | '请核对下方结果，保存后可在「已保存资产」中查看。'}提取不会生成图片。 |
| `ip/library-extraction-panel.tsx` | title="AI 处理，会消耗积分" | title="AI 处理，将消耗积分" |
| `ip/library-extraction-panel.tsx` | >从正文分析提取</Button> | >提取资产 · 按实际用量结算</Button> |
| `ip/library-extraction-panel.tsx` | 或从正文分析提取。' | 或点击「提取资产」。' |
| `ip/library-extraction-panel.tsx` | '读取失败' | '加载失败' |
| `ip/library-extraction-panel.tsx` | >重新读取</Button> | >重试</Button> |
| `ip/library-media-picker.tsx` | title = '从资产库选' | title = '从资产库选择' |
| `ip/library-media-picker.tsx` | '上次用的' | '上次使用' |
| `ip/library-media-picker.tsx` | '上传到这个库' | '上传到此资产库' |
| `ip/library-media-picker.tsx` | '这里还没有带图的人物。' | '暂无带图的人物。' |
| `ip/library-media-picker.tsx` | `还没有 AI 做的${NOUN[mediaType]}。` | `还没有 AI 生成的${NOUN[mediaType]}。` |
| `ip/library-media-picker.tsx` | '没有找到，换个名称试试。' | '没有找到匹配的素材，请尝试其他名称。' |
| `ip/library-media-picker.tsx` | `这里还没有${NOUN[mediaType]}，可以上传一个。` | `暂无${NOUN[mediaType]}，可点击「上传」添加。` |
| `ip/library-media-picker.tsx` | `这里还没有${NOUN[mediaType]}。` | `暂无${NOUN[mediaType]}。` |
| `ip/library-media-picker.tsx` | aria-label={`选 ${a.title}`} | aria-label={`选择 ${a.title}`} |
| `ip/library-reference-picker.tsx` | 没有匹配的资产，可以切换到全部个人资产或换个名称。 | 没有匹配的资产，请切换到「全部个人资产」或更换名称。 |
| `ip/library-script-assets.tsx` | '文件夹名称暂不可用' | '未知文件夹' |
| `ip/studio-distribution.tsx` | description="让每一份作品，抵达它的观众。" | description="管理发布账号，查看发布记录。" |
| `ip/studio-distribution.tsx` | nextDescription="绑定账号，把做好的作品发出去" | nextDescription="管理发布账号，查看发布记录。" |
| `ip/studio-distribution.tsx` | <h2>把作品，带到更多人面前。</h2><p>管理发布账号，查看已有发布进度与结果。</p> | <h2>发布账号与记录</h2><p>管理发布账号，查看发布进度和结果。</p> |
| `ip/studio-distribution.tsx` | 从画布选择成片，编辑发布文案，再投递到目标账号。 | 从画布选择成片，编辑发布文案，发布到目标账号。 |
| `ip/studio-distribution.tsx` | 保存未完成的发布准备，随时回来继续。 | 保存未完成的发布内容，稍后继续编辑。 |
| `ip/studio-distribution.tsx` | <strong>先把作品打磨好</strong><p>画布里的下载与成片制作可以继续使用。新的发行入口接通后，再从这里发布。</p> | <strong>继续完善作品</strong><p>画布中的下载和成片合成可正常使用。发布功能上线后，可在此发布作品。</p> |
| `ip/studio-distribution.tsx` | <p>本人已绑定的发布账号，在这里统一管理。</p> | <p>管理已绑定的发布账号。</p> |
| `ip/studio-distribution.tsx` | '正在读取账号…' | '正在加载账号…' |
| `ip/studio-distribution.tsx` | '账号读取未完成' | '账号加载失败' |
| `ip/studio-distribution.tsx` | <p>绑定账号后，可在这里查看平台与授权状态。</p> | <p>绑定账号后，可在此查看平台和授权状态。</p> |
| `ip/studio-distribution.tsx` | 账号由本人统一管理，与已有带货应用共用。画布成片投递< | 账号与 AI 明星带货共用。画布成片发布< |
| `ip/studio-distribution.tsx` | 当前账号的全部发布批次，包含已有带货应用的记录。 | 当前账号的全部发布记录，包含 AI 明星带货中的发布。 |
| `ip/studio-distribution.tsx` | 平台实际受理的任务会出现在这里。下载作品不会被记为已发布。 | 已提交到平台的发布任务会显示在这里。下载作品不计为已发布。 |
| `ip/studio-distribution.tsx` | 草稿保存尚未接通，不会混入平台任务。 | 发布草稿功能暂未开放。 |
| `ip/studio-distribution.tsx` | 暂时没有可读取的发布任务。 | 暂无发布任务。 |
| `ip/studio-distribution.tsx` | 请在原发布入口完成平台验证。这里直接处理< | 请在 AI 明星带货中完成平台验证。在此直接处理< |
| `ip/studio-social-bind.tsx` | >继续查询本次绑定</Button> | >重新查询绑定状态</Button> |

#### 测试同步

| 文件 | 改法 |
|---|---|
| `ip/assets-people.test.tsx` | 缺项提示从断言整句改为断言 `.assets-person-missing` 有内容且随状态变化；`从资产库选X` → `从资产库选择X`；`换一张左侧脸` → `更换左侧脸`；mock 选择框按钮名 `选X·选好了` → `选择X·选好了` |
| `ip/ip-management.test.tsx` | 按钮名 `生成形象` → `新建画布` |
| `ip/library-extraction-panel.test.tsx` | 按钮名 → `提取资产 · 按实际用量结算`、`重试`；文案 → `素材加载失败`、`未知文件夹`、`文件夹加载失败` |
| `ip/library-media-picker.test.tsx` | `选 X` → `选择 X`；`上次用的` → `上次使用`；`上传到这个库` → `上传到此资产库` |
| `ip/personal-asset-library.test.tsx` | `未知文件夹`、`重试` |
| `ip/supplementary-asset-library.test.tsx` | `授权信息加载失败`、`明星授权加载失败`、`专属声音加载失败`、`重试`（全部失败时页面有两个重试，改 `getAllByRole`） |
| `ip/studio-social-bind.test.tsx` | `重新查询绑定状态` |

## 存疑项选了哪种写法

1. 「去 X」类链接：选 B，动词 + 对象。「去完成 ›」→「完成授权 ›」，「去补 ›」→「补充 ›」，「去创作」→「开始创作」，「去真人授权」→「发起真人授权」，「去补确认 ›」→「补充确认 ›」，「去生成」→「生成素材」。
2. 「去工作室创作」：选 A「开始创作」。它去的 `#/avatar/{id}` 是形象工作页，能生成素材也能编辑，「开始创作」和同页空态按钮一致。
3. 名片 Roll 卷标：按决定保留。
4. 「调整中 · 迭代 / 精修」：两种都没选，见存量问题 4。
5. 「归档」：选 A 保留。画布采用弹窗里同样叫归档（`ip/studio-workspace.tsx` 的「归档素材类别」）。人物库里的空态改成了「暂无 {类别}」，不再提归档。
6. 「原发布入口」：选 A「请在 AI 明星带货中完成平台验证。」

需要核实项的处理：「生成形象」不生成东西，按钮改「新建画布」，说明改「新建画布不消耗积分。生成前可在画布中确认模型、参考图和积分。」。旧版形象页的「创建形象」（去 `/create`）改「开始创作」。「本次生成提示词」按叫法表改「提示词」，「长期描述」改「描述」。人设「性格特征」说明改「输入后按回车添加。」，和实际输入方式一致。

---

# 第 7 批 · 我的、企业、邀请、登录

| 位置（相对 apps/web-aiavatar/src/，服务端相对仓库根） | 原文 | 改为 |
|---|---|---|
| `ip/enterprise-workspace.tsx` | title="数据刷新失败，当前显示上次读取的内容" | title="企业数据刷新失败，当前显示的是上次加载的内容" |
| `ip/enterprise-workspace.tsx` | title="暂时无法读取企业数据" | title="企业数据加载失败" |
| `ip/enterprise-workspace.tsx` | 创建企业后，主账号可将个人积分转入企业，也可申请企业充值，再分配给成员。每个人仍需按现有规则开通数字资产产品。 | 创建企业后，主账号可将个人积分转入企业或申请企业充值，并分配给成员。成员需各自开通 IP Studio。 |
| `ip/enterprise-workspace.tsx` | aria-label="我的两份积分" | aria-label="我的积分" |
| `ip/enterprise-workspace.tsx` | "读取中" | "加载中…" |
| `ip/enterprise-workspace.tsx` | 个人充值与消费，企业无权回收 | 个人充值与消费，企业不可回收 |
| `ip/enterprise-workspace.tsx` | "暂未读取" | "加载中…" |
| `ip/enterprise-workspace.tsx` | description="你仍可查看本人记录，并选择个人积分继续创作。企业在途任务按原账户结算。" | description="你仍可查看本人记录，并使用个人积分继续创作。已开始的企业积分任务仍按企业积分结算。" |
| `ip/enterprise-workspace.tsx` ×2 | 在途任务占用，不可回收 | 进行中的任务占用，不可回收 |
| `ip/enterprise-workspace.tsx` | 企业积分与个人积分独立。回收仅处理可用余额，冻结积分保留原任务结算。 | 企业积分与个人积分分开计算。回收仅针对可用余额，冻结积分仍用于原任务结算。 |
| `ip/enterprise-workspace.tsx` | "这里仅展示你发起的申请，核准后积分进入企业待分配余额。" | "仅显示你提交的申请。核准后，积分进入「企业待分配积分」。" |
| `ip/enterprise-workspace.tsx` | emptyText: "暂无充值申请，可先提交一笔充值申请" | emptyText: "暂无充值申请。" |
| `ip/enterprise-workspace.tsx` | render: value => new Date(value).toLocaleString("zh-CN") } | render: value => formatDateTime(value) } |
| `ip/enterprise-workspace.tsx` | "提交前会核对每人余额与本次总额。整批成功或整批失败，不会扣用个人积分。" | "提交前将核对每人余额与本次总额，全部成功或全部不执行。不会动用你的个人积分。" |
| `ip/enterprise-workspace.tsx` | 申请提交至平台财务，核准后积分进入“企业待分配积分”。此操作不会直接增加积分。 | 申请将提交至平台财务，核准后积分进入「企业待分配积分」。提交申请不会直接增加积分。 |
| `ip/enterprise-management.tsx` | const time = (value: string) => new Date(value).toLocaleString("zh-CN"); | const time = (value: string) => formatDateTime(value); |
| `ip/enterprise-management.tsx` | onClick={() => void load()}>重新读取 | onClick={() => void load()}>重试 |
| `ip/enterprise-management.tsx` | title="有一项主账号移交等待你接受" | title="你有一项主账号移交待接受" |
| `ip/enterprise-management.tsx` | 接受后你将负责企业成员、资金分配和设置。有效至 | 接受后你将负责企业成员、积分分配和设置。有效至 |
| `ip/enterprise-management.tsx` | 仅约束使用企业积分的 Studio 任务。个人积分仍按个人规则使用。 | 仅对使用企业积分的任务生效，包括画布、导演台、数字资产和声音克隆。不影响个人积分。 |
| `ip/enterprise-management.tsx` | 成员用企业积分时可以用哪些模型 | 成员使用企业积分时可用的模型 |
| `ip/enterprise-management.tsx` | "成员用企业积分时只能选这些模型，以后新上的模型要再加进来。已排队或已提交的任务按原来的模型和价格结算。" | "成员使用企业积分时只能选择以上模型，后续上线的模型需手动添加。声音克隆不按模型计费，不受此限制。已排队或已提交的任务按原模型和价格结算。" |
| `ip/enterprise-management.tsx` | "至少选一个模型才能保存。" | "请至少选择一个模型。" |
| `ip/enterprise-management.tsx` | Studio 里能用的模型都可以用企业积分付，包括以后新上的。 | 所有可用模型均可使用企业积分，包括后续上线的模型。 |
| `ip/enterprise-management.tsx` | 每位成员最多在途任务数 | 每位成员同时进行的任务上限 |
| `ip/enterprise-management.tsx` | 在途包括排队、运行，以及厂商已受理但结果待核对的任务。画布一次制作常会同时跑好几项，设得太小，后面的步骤会停下来等。 | 包括排队中、生成中，以及已提交、结果待确认的任务。画布一次制作常会同时运行多项任务，上限过低时后续步骤需要等待。 |
| `ip/enterprise-management.tsx` | 主账号须先将管理责任移交给另一位正常成员，才能退出。关闭企业前需要处理完在途任务、充值申请与剩余积分。 | 将主账号移交给一位状态正常的成员后，才能退出企业。关闭企业前，需处理完进行中的任务、充值申请和剩余积分。 |
| `ip/enterprise-management.tsx` | >核对关闭企业条件 | >关闭企业 |
| `ip/enterprise-management.tsx` | >核对并退出企业 | >退出企业 |
| `ip/enterprise-management.tsx` | 管理员只管理普通成员。积分授权不会开放成员的个人钱包、素材或画布。 | 管理员只能管理普通成员。积分相关授权不涉及成员的个人积分、素材和画布。 |
| `ip/enterprise-management.tsx` | "分享链接已创建，有效期内可供多人加入。" | "邀请链接已创建，有效期内可供多人加入。" |
| `ip/enterprise-management.tsx` | "邀请已创建；链接仅首次返回，如未保存可重新创建。" | "邀请已创建。链接只显示一次，如未保存，可重新创建。" |
| `ip/enterprise-management.tsx` | >创建分享链接 | >创建邀请链接 |
| `ip/enterprise-management.tsx` | 。对方需已登录并开通数字资产平台；未注册的同事可通过分享链接加入。 | 。对方需已登录并开通 IP Studio；未注册的同事可通过邀请链接加入。 |
| `ip/enterprise-management.tsx` | 接受邀请后仍需按原有规则开通数字资产产品；加入企业不会自动开通。 | 加入企业不会自动开通 IP Studio，成员需自行开通。 |
| `ip/enterprise-management.tsx` | : "无需操作" } | : "—" } |
| `ip/enterprise-management.tsx` | 将链接发给同事或企业群，大家验证手机号后可直接加入「 | 将链接发给同事或企业群，对方验证手机号后可加入「 |
| `ip/enterprise-management.tsx` | 链接只在本次创建后显示，请复制保存。加入不会自动开通产品或发放积分。 | 链接仅显示这一次，请复制保存。加入企业不会自动开通 IP Studio，也不会发放积分。 |
| `ip/enterprise-management.tsx` | okText="发起移交，等待对方接受" | okText="发起移交" |
| `ip/enterprise-management.tsx` | 将企业管理责任移交给 {ownershipTarget?.displayName}。对方需要登录并接受，接受后立即生效。充值订单和企业资金仍归本企业。 | 将主账号移交给 {ownershipTarget?.displayName}。对方登录并接受后立即生效。充值订单和企业积分仍归本企业。 |
| `ip/enterprise-management.tsx` | "企业关系已更新，余额与任务仍按原账户结算。" | "操作已完成。进行中的任务仍按原账户结算。" |
| `ip/enterprise-management.tsx` | 在途冻结积分 | 冻结积分 |
| `ip/enterprise-management.tsx` | 在途任务 | 进行中的任务 |
| `ip/enterprise-management.tsx` | "尚未受理任务" : "未受理，提交后取消" | "尚未开始的任务" : "尚未开始，确认后取消" |
| `ip/enterprise-management.tsx` | 已受理，继续原任务结算 | 已开始，按原任务结算 |
| `ip/enterprise-management.tsx` | "恢复后可接收分配并使用企业积分。此前退回并归集的积分不会自动重新分配。" | "恢复后可接收分配并使用企业积分。停用时回收的积分不会自动退回。" |
| `ip/enterprise-management.tsx` | "已受理任务继续结算，失败释放的积分归原企业；个人积分、画布与作品保留。" | "已开始的任务继续结算，失败退回的积分归原企业；个人积分、画布和作品不受影响。" |
| `ip/enterprise-reports.tsx` | const time = (value: string) => new Date(value).toLocaleString("zh-CN"); | const time = (value: string) => formatDateTime(value); |
| `ip/enterprise-reports.tsx` | dispatching: "生成或核对中" | dispatching: "生成中" |
| `ip/enterprise-reports.tsx` | released: "已结算，余款已退回" | released: "已结算，多余积分已退回" |
| `ip/enterprise-reports.tsx` | \|\| "等待核对"); | \|\| "待确认"); const usageTypes: Record<string, string> = { material_video_job: "视频生成", "ip-run": "创作任务", "dap-job": "数字资产生成", "dap-voice": "声音克隆" }; |
| `ip/enterprise-reports.tsx` | "points.recovery": "归集旧任务退款" | "points.recovery": "回收旧任务退回的积分" |
| `ip/enterprise-reports.tsx` | 个人付费账单可在我的账号查看。 | 个人积分的消费记录可在「我的账号」查看。 |
| `ip/enterprise-reports.tsx` | render: value => value === "material_video_job" ? "视频生成" : "Studio 生成" } | render: value => usageTypes[value] \|\| "创作任务" } |
| `ip/enterprise-reports.tsx` | "已变更允许模型或在途任务上限" | "已变更可用模型或任务上限" |
| `ip/enterprise-invitation-landing.tsx` | "你已加入其他企业。请先前往企业管理退出原企业，再回来接受邀请。" | "你已加入其他企业。请在企业管理中退出原企业后，重新打开此邀请链接。" |
| `ip/enterprise-invitation-landing.tsx` | setLoadError("暂时无法读取邀请或账号状态，请重试。") | setLoadError("请稍后重试。") |
| `ip/enterprise-invitation-landing.tsx` | 了解 Studio <ArrowUpRight | 了解 IP Studio <ArrowUpRight |
| `ip/enterprise-invitation-landing.tsx` | <h1 id="ei-title">让好想法，<br/>在这里成形。</h1> | <h1 id="ei-title">好想法，<br/>在这里成形。</h1> |
| `ip/enterprise-invitation-landing.tsx` | 接受企业邀请，用分配给你的积分，<br/>继续属于自己的创作。 | 接受企业邀请，<br/>使用企业分配的积分开始创作。 |
| `ip/enterprise-invitation-landing.tsx` ×2 | 返回 Studio <ArrowRight | 返回首页 <ArrowRight |
| `ip/enterprise-invitation-landing.tsx` | 正在读取企业邀请稍等片刻，马上就好。 | 正在加载企业邀请… |
| `ip/enterprise-invitation-landing.tsx` | 暂时无法读取邀请 | 邀请加载失败 |
| `ip/enterprise-invitation-landing.tsx` | >重新读取 <ArrowRight | >重试 <ArrowRight |
| `ip/enterprise-invitation-landing.tsx` | 邀请有效至 {expiry(preview.expiresAt)}（北京时间） | 邀请有效至 {formatDateTime(preview.expiresAt)} |
| `ip/enterprise-invitation-landing.tsx` | className="ei-primary">进入企业 <ArrowRight | className="ei-primary">进入企业管理 <ArrowRight |
| `ip/enterprise-invitation-landing.tsx` | 。每个账号同时只能属于一家企业，退出后可回来重新接受邀请。 | 。一个账号同时只能属于一家企业，退出原企业后可重新打开此链接接受邀请。 |
| `ip/enterprise-invitation-landing.tsx` | 前往企业管理 <ArrowRight | 进入企业管理 <ArrowRight |
| `ip/enterprise-invitation-landing.tsx` | 你已登录。开通数字资产产品后，将继续加入这家企业。 | 你已登录。开通 IP Studio 后，将自动加入该企业。 |
| `ip/enterprise-invitation-landing.tsx` | productLabel="数字资产产品" | productLabel="IP Studio" |
| `ip/enterprise-invitation-landing.tsx` | 请先登录，再继续接受企业邀请。 | 请登录后接受企业邀请。 |
| `ip/enterprise-invitation-landing.tsx` | 个人钱包与作品仍由你管理。 | 个人积分与作品仍归你所有。 |
| `ip/enterprise-invitation-landing.tsx` | 加入企业不自动开通产品，也不自动获得积分。 | 加入企业不会自动开通 IP Studio，也不会自动获得积分。 |
| `ip/invitation-registration.tsx` | title: "让想象，拥有自己的样子。", description: "角色写真、造型与场景，延展属于你的视觉表达。" | title: "给想象一个具体的样子。", description: "角色写真、造型与场景，形成你自己的视觉风格。" |
| `ip/invitation-registration.tsx` | title: "让角色，走进新的故事。", description: "从一张画面出发，延展为有情绪、有节奏的影像。" | title: "角色，走进新的故事。", description: "从一张画面出发，生成有情绪、有节奏的影像。" |
| `ip/invitation-registration.tsx` | title: "让一个想法，长成一个世界。", description: "故事设定、剧本与分镜，让灵感有处可去。" | title: "从一个想法，到一个世界。", description: "故事设定、剧本与分镜，把灵感写成完整的故事。" |
| `ip/invitation-registration.tsx` | "请先退出运营查看，再注册或登录本人账号。" | "请退出运营查看后，注册或登录本人账号。" |
| `ip/invitation-registration.tsx` | "这份邀请已失效，请重新读取后继续注册。" | "邀请已失效，你仍可继续注册。" |
| `ip/invitation-registration.tsx` | 认识 Studio <ArrowUpRight/> | 了解 IP Studio <ArrowUpRight/> |
| `ip/invitation-registration.tsx` | <span>邀请你加入 Studio</span> | <span>邀请你加入 IP Studio</span> |
| `ip/invitation-registration.tsx` | 正在读取邀请… | 正在加载邀请… |
| `ip/invitation-registration.tsx` | 这份邀请已失效，你仍可直接注册 Studio。 | 邀请已失效，你仍可直接注册 IP Studio。 |
| `ip/invitation-registration.tsx` | 暂时无法读取邀请，请检查网络后重试。 | 邀请加载失败，请检查网络后重试。 |
| `ip/invitation-registration.tsx` | >重新读取邀请 | >重试 |
| `ip/invitation-registration.tsx` | "正在进入 Studio…" : "注册并进入 Studio" | "正在进入 IP Studio…" : "注册并进入 IP Studio" |
| `ip/invitation-registration.tsx` | 未注册自动注册，已有账号直接登录。 | 未注册的手机号将自动注册，已有账号直接登录。 |
| `ip/invitation-registration.tsx` | aria-label="探索 Studio 创作方向" | aria-label="探索 IP Studio 创作方向" |
| `ip/invitation-registration.tsx` | 让角色成为可延展的 IP，<br/>让每次创作都成为下一次的起点。 | 角色可以反复使用，<br/>每次创作都是下一次的起点。 |
| `ip/invitation-registration.tsx` | 塑造形象、延展造型与场景，<br/>积累自己的角色与素材。 | 塑造形象，设计造型与场景，<br/>积累自己的角色与素材。 |
| `ip/invitation-registration.tsx` | 从故事设定、剧本到分镜，<br/>让角色拥有自己的世界。 | 从故事设定、剧本到分镜，<br/>为角色搭建自己的世界。 |
| `ip/invitation-registration.tsx` | 验证手机号后直接进入 IP Studio。新账号会记录这次邀请；各项创作能力仍按账号开通情况和具体使用规则提供。 | 验证手机号后进入 IP Studio，新账号会记录本次邀请。邀请不附带积分或奖励，各项功能按账号开通情况提供。 |
| `ip/invitation-registration.tsx` | 使用同一表单验证手机号即可登录，原有邀请关系保持不变。 | 可以。在上方验证手机号后登录，原有邀请关系不变。 |
| `ip/invitation-workspace.tsx` | {dateText(data.invitedAt)} | {formatDateTime(data.invitedAt)} |
| `ip/invitation-workspace.tsx` | {dateText(record.createdAt)} | {formatDateTime(record.createdAt)} |
| `ip/invitation-workspace.tsx` | "邀请链接已生成，可以发给朋友了。" | "邀请链接已生成。" |
| `ip/invitation-workspace.tsx` | "邀请链接已复制，可以发给朋友了。" | "邀请链接已复制。" |
| `ip/invitation-workspace.tsx` | 分享一个注册链接，在这里查看邀请记录。 | 分享注册链接，查看邀请记录。 |
| `ip/invitation-workspace.tsx` | "暂时无法读取邀请记录" | "邀请记录加载失败" |
| `ip/invitation-workspace.tsx` | " 当前仍显示上次读取的记录。" | " 当前显示的是上次加载的记录。" |
| `ip/invitation-workspace.tsx` | 正在读取邀请记录… | 正在加载邀请记录… |
| `ip/invitation-workspace.tsx` | 可选中链接手动复制。此链接用于统一账号注册，各应用的访问权限和权益分别管理。 | 可选中链接手动复制。此链接用于注册账号，各产品的使用权限与权益需另行开通。 |
| `ip/invitation-workspace.tsx` | <p className="invitation-field-hint">没有注册邀请记录。 | <p className="invitation-field-hint">暂无邀请人。 |
| `ip/invitation-workspace.tsx` | 这里记录直接邀请的注册账号，不代表各应用的开通或使用情况。 | 仅记录由你直接邀请注册的账号，不反映对方的开通或使用情况。 |
| `ip/invitation-workspace.tsx` | {data.total === 0 ? url ? "还没有邀请记录。把邀请链接发给朋友，邀请他们注册。" : data.canInvite ? "还没有邀请记录。生成邀请链接后，就可以发给朋友。" : "暂无邀请记录。" : "这一页没有记录，请返回上一页。"} | {data.total === 0 ? "暂无邀请记录。" : "此页暂无记录。"} |
| `ip/invitation-workspace.tsx` | 只记录注册时的邀请关系，已有账号不补绑。更换手机号或合并账号，不会改写原有记录。 | 只记录注册时的邀请关系，已有账号不会补记。更换手机号或合并账号，不会改变原有记录。 |
| `ip/invitation-workspace.tsx` | 分佣与奖励暂未开放。 | 邀请不产生分佣或奖励。 |
| `shell/account-workspace.tsx` | "手机号与登录方式可在账号与安全中管理" | "手机号与登录方式可在「账号与安全」中管理" |
| `shell/account-workspace.tsx` | <small>管理企业余额、积分分配与充值记录</small> | <small>查看企业积分、分配与充值记录</small> |
| `shell/test-account-banner.tsx` | 测试账号 · 企业权限、开通和积分按正常规则检查 | 测试账号 · 企业权限、开通和积分规则与正式账号相同 |
| `shell/ui-version-switch.tsx` | "回到旧版" | "返回旧版" |
| `app/me/page.tsx` | {next ? "回到旧版" : "体验新版"} | {next ? "返回旧版" : "体验新版"} |
| `app/me/page.tsx` | title="回到旧版" | title="返回旧版" |
| `app/auth/test-login/page.tsx` | "请先退出运营查看，再进入测试账号。" | "请退出运营查看后进入测试账号。" |
| `components/hub/auth.tsx` | productLabel="数字资产" | productLabel="IP Studio" |
| `components/hub/auth.tsx` | 账号已登录但没开通「数字资产」子产品时展示 | 账号已登录但没开通 IP Studio（子产品码 aiavatar）时展示 |
| `packages/types/src/account.ts`（相对仓库根） | aiavatar: "数字人资产平台", | aiavatar: "IP Studio", |
| `shell/app-chrome.tsx`、`shell/ui-version.ts`（注释） | 「回到旧版」 | 「返回旧版」 |

#### 测试同步
| 位置 | 原文 | 改为 |
|---|---|---|
| `ip/enterprise-workspace.test.tsx` | expect(screen.getByText("这里仅展示你发起的申请，核准后积分进入企业待分配余额。")).toBeDefined(); | expect(screen.getByRole("heading", { name: "我的充值申请" })).toBeDefined(); |
| `ip/enterprise-workspace.test.tsx` | await screen.findByText(/数据刷新失败，当前显示上次读取的内容/); | await screen.findByText(/余额刷新失败/); |
| `ip/enterprise-management.test.tsx` | getByLabelText("每位成员最多在途任务数") | getByLabelText("每位成员同时进行的任务上限") |
| `ip/enterprise-management.test.tsx` | { name: "核对关闭企业条件" } | { name: "关闭企业" } |
| `ip/enterprise-management.test.tsx` | { name: "创建分享链接" } | { name: "创建邀请链接" } |
| `ip/enterprise-management.test.tsx` | {name:"创建分享链接"} | {name:"创建邀请链接"} |
| `ip/enterprise-reports.test.tsx` | getAllByText("已结算，余款已退回") | getAllByText("已结算，多余积分已退回") |
| `ip/enterprise-invitation-landing.test.tsx` | vi.mock("@ai-star-eco/landing/EnrollmentGate" | // 页面经 @/lib/datetime 引 formatDateTime，它转自上面整个被 mock 掉的包根；这里换回真实实现，时间格式才测得到。 vi.mock("@/lib/datetime", () => import("@ai-star-eco/api-client/format")); vi.mock("@ai-star-eco/landing/EnrollmentGate" |
| `ip/enterprise-invitation-landing.test.tsx` | await screen.findByText("山海影像工作室"); await screen.findByLabelText("手机号");   expect(state.preview).toHaveBeenCalledWith(bearer, expect.any(AbortSignal));   enterCredentials(); | await screen.findByText("山海影像工作室"); await screen.findByLabelText("手机号");   expect(screen.getByText(/^邀请有效至 \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)).toBeDefined();   expect(state.preview).toHaveBeenCalledWith(bearer, expect.any(AbortSignal));   enterCredentials(); |
| `ip/enterprise-invitation-landing.test.tsx` | { name: "进入企业" } | { name: "进入企业管理" } |
| `ip/enterprise-invitation-landing.test.tsx` | { name: "重新读取" } | { name: "重试" } |
| `ip/invitation-registration.test.tsx` ×2 | { name: "注册并进入 Studio" } | { name: "注册并进入 IP Studio" } |
| `ip/invitation-registration.test.tsx` | { name: "重新读取邀请" } | { name: "重试" } |
| `ip/invitation-workspace.test.tsx` | vi.mock("@/components/hub/auth" | // 页面经 @/lib/datetime 引 formatDateTime，它转自上面整个被 mock 掉的包根；这里换回真实实现。 vi.mock("@/lib/datetime", () => import("@ai-star-eco/api-client/format")); vi.mock("@/components/hub/auth" |
| `ip/invitation-workspace.test.tsx` | await screen.findByText("邀请链接已复制，可以发给朋友了。"); | await screen.findByText("邀请链接已复制。"); |
| `ip/invitation-workspace.test.tsx` | await screen.findByText("暂时无法读取邀请记录"); | await screen.findByText("邀请记录加载失败"); |
| `ip/invitation-workspace.test.tsx` | screen.getByText(/当前仍显示上次读取的记录/) | screen.getByText(/上次加载的记录/) |
| `ip/invitation-workspace.test.tsx` | screen.queryByText("邀请链接已复制，可以发给朋友了。") | screen.queryByText("邀请链接已复制。") |
| `shell/desktop-top-bar.test.tsx`、`shell/ui-version-placement.test.tsx`、`app/me/me-page.test.tsx` | 回到旧版 | 返回旧版 |

## 存疑项选了哪种写法

1. 开通产品的统一名称：按决定 #9 用「IP Studio」。
2. 报错里的运维指引：服务端，不归本批。
3. 朋友邀请页场景卡：选改（写法 A），用了比旧表更顺的句子。「给想象一个具体的样子。」「角色，走进新的故事。」「从一个想法，到一个世界。」；下面一段改成「角色可以反复使用，每次创作都是下一次的起点。」，避免「让 A，让 B」。「延展」三处全部换掉。保留卡片标题「让画面开口说话」：三张卡只有这一张带「让」，且配音、口型确实存在。
4. 分享卡标题：选写法 A，保留「一份企业创作邀请 · IP Studio」「一份来自朋友的邀请 · IP Studio」。
5. 企业页右上角「我的账号」：保留，不改「返回我的账号」。这个页面也能从导航进入，不一定是从账号页来的，作为入口名比「返回」准确。

---

# 第 7S 批 · 服务端报错与场景目录

| 位置 | 原文 | 改为 |
|---|---|---|
| `config/PhoneVerificationGuard.java` | 请先绑定手机号后再操作 | 请绑定手机号后操作 |
| `enrollment/config/EnrollmentGuard.java` | 该接口尚未登记子产品归属，请联系平台运营 | 此功能暂不可用，请联系平台处理 |
| `enrollment/config/EnrollmentGuard.java` | 请求缺少子产品标识，请刷新页面后重试 | 请求缺少产品信息，请刷新页面后重试 |
| `enrollment/config/EnrollmentGuard.java`（2 处） | 尚未开通该子产品，请先使用激活码开通 | 尚未开通此产品，请使用激活码开通 |
| `enrollment/service/EnrollmentService.java` | 该激活码不能用于开通此子产品 | 该激活码不能用于开通此产品 |
| `enrollment/service/EnrollmentService.java` | 开通记录写入异常，请重试 | 开通失败，请重试 |
| `enrollment/service/EnrollmentService.java` | "未知的子产品：" + product | "未知的产品：" + product |
| `enrollment/service/EnrollmentService.java` | "该激活码已被使用或已失效（当前状态: " + key.getStatus() + "）" | "该激活码已被使用或已失效" |
| `enrollment/service/EnrollmentService.java` | "批次数据异常" | "该激活码暂不可用，请联系平台处理" |
| `enrollment/service/EnrollmentService.java` | "批次发放方租户不存在" | "该激活码暂不可用，请联系平台处理" |
| `service/AiModelGuardService.java` | 该模型今日额度已用完，请联系管理员调整配额 | 该模型今日用量已达上限，请明天再试或选择其他模型 |
| `service/AiModelGuardService.java` | 该模型今日成本额度已用完，请联系管理员调整配额 | 该模型今日用量已达上限，请明天再试或选择其他模型 |
| `enterprise/service/EnterpriseAccessService.java` | 请先开通数字资产平台 | 请先开通 IP Studio |
| `enterprise/service/EnterpriseService.java` | 未找到该手机号的产品账号，请让对方先登录并开通数字资产平台，或使用企业邀请链接 | 未找到该手机号对应的账号。请对方登录并开通 IP Studio 后再添加，或通过邀请链接加入 |
| `enterprise/service/EnterpriseService.java` | 该账号手机号尚未验证或已变更，请让对方登录更新后再添加 | 该账号手机号尚未验证或已变更，请对方登录更新后再添加 |
| `enterprise/service/EnterpriseService.java` | 角色或能力无效 | 角色或授权无效 |
| `enterprise/service/EnterpriseService.java` | 模型或在途上限无效 | 可用模型或任务上限设置无效 |
| `enterprise/service/EnterpriseService.java` | 企业策略已变化，请刷新 | 企业设置已变化，请刷新 |
| `enterprise/service/EnterpriseService.java` | "企业不可使用" | "该企业已关闭或暂不可用" |
| `enterprise/service/EnterpriseService.java` | 同一请求不能更改企业名称 | 请求已失效，请刷新页面后重试 |
| `enterprise/service/EnterpriseService.java` | 同一请求不能修改邀请有效期 | 请求已失效，请刷新页面后重试 |
| `enterprise/service/EnterpriseService.java` | 同一请求不能更改接收人 | 请求已失效，请刷新页面后重试 |
| `enterprise/service/EnterpriseBillingService.java` | 企业积分只用于工作台创作 | 此功能不支持使用企业积分 |
| `enterprise/service/EnterpriseBillingService.java` | 此企业尚未开放企业积分付款，请联系平台管理员 | 此企业尚未开放企业积分付款，请联系平台处理 |
| `enterprise/service/EnterpriseBillingService.java`（2 处） | 已达到企业设定的在途任务上限，请等待已有任务完成 | 已达到企业设定的同时进行任务上限，请等待进行中的任务完成后重试 |
| `enterprise/service/EnterpriseBillingService.java` | 成员企业账户不存在，请联系管理员 | 成员企业账户不存在，请联系平台处理 |
| `enterprise/service/EnterpriseLifecycleService.java` | 成员、余额或在途任务已变化，请重新预览确认 | 成员、余额或进行中的任务已变化，请重新预览确认 |
| `enterprise/service/EnterpriseLifecycleService.java` | 仍有在途任务或冻结积分，请先完成结算 | 仍有进行中的任务或冻结积分，请等待任务结算后操作 |
| `enterprise/service/EnterpriseLifecycleService.java` | 同一请求不能更改成员操作 | 请求已失效，请刷新页面后重试 |
| `enterprise/service/EnterprisePointsService.java` | 请求编号使用了系统保留前缀 | 请求已失效，请刷新页面后重试 |
| `enterprise/service/EnterprisePointsService.java` | 同一请求不能更改积分操作 | 请求已失效，请刷新页面后重试 |
| `enterprise/service/EnterprisePointsService.java`（2 处） | "企业不可使用" | "该企业已关闭或暂不可用" |
| `enterprise/service/EnterpriseFundRecoveryService.java` | "原成员任务释放后归集："+hold.getReferenceType()+":"+hold.getReferenceId() | "原成员任务的未用积分已回收至企业" |
| `dap/service/DapAccountService.java` | 数字人资产平台 · 月度赠送算力 | IP Studio · 月度赠送算力 |
| `dap/service/DapRealAuthService.java`（2 处） | 请重新打开数字资产平台发起本人确认。 | 请重新打开 IP Studio 发起本人确认。 |
| `dap/service/DapRealAuthService.java` | 正在返回数字资产平台查看最终结果。 | 正在返回 IP Studio 查看最终结果。 |
| `dap/service/DapRealAuthService.java` | 本次结果未能送达，请返回数字资产平台重新发起。 | 本次结果未能送达，请返回 IP Studio 重新发起。 |
| `dap/service/DapRealAuthService.java` | 正在返回数字资产平台核验最终状态。 | 正在返回 IP Studio 核验最终状态。 |
| `dap/service/DapRealAuthService.java` | 正在返回数字资产平台，你可以重新发起。 | 正在返回 IP Studio，你可以重新发起。 |
| `dap/service/DapRealAuthService.java` | 返回数字资产平台</a> | 返回 IP Studio</a> |
| `dap/service/DapRealAuthService.java` | "DAP_CAPTURE_NOT_FOUND", "捕获会话不存在或无权访问" | "DAP_CAPTURE_NOT_FOUND", "拍摄记录不存在或无权访问" |
| `dap/service/DapCaptureService.java` | 捕获会话不存在或无权访问 | 拍摄记录不存在或无权访问 |
| `dap/service/DapMaterialService.java` | 捕获会话不存在或无权访问 | 拍摄记录不存在或无权访问 |
| `dap/controller/DapRealAuthController.java` | 缺少捕获会话 id | 缺少拍摄记录，请重新录制或上传 |
| `dap/controller/DapRealAuthController.java` | 缺少送审对象 id | 缺少送审对象，请刷新后重试 |
| `dap/controller/DapRealAuthController.java` | "未知送审对象类型：" + refType | "送审对象类型不正确" |
| `dap/service/DapAvatarRefResolver.java` | 该数字人已在回收站，请先在 AiAvatar 中恢复 | 该数字人已在回收站，请在回收站中恢复后使用 |
| `dap/service/DapAvatarRefResolver.java` | 该数字人还没有定妆照，请先在 AiAvatar 完成形象生成 | 该数字人还没有定妆照，请完成形象生成后使用 |
| `dap/service/DapAvatarRefResolver.java` | 展示图指针格式应为 look:<id> / deriv:<id> / variant:<idx> / shot:<name> | 所选展示图无效，请重新选择 |
| `dap/service/DapCompositionService.java` | 该人物还没有定妆形象，先完成创建再合成 | 该人物还没有定妆形象，请完成创建后合成 |
| `dap/service/DapCompositionService.java` | 该场景还没有图片，等生成完成后再合成 | 该场景还没有图片，请等待生成完成后合成 |
| `dap/service/DapCompositionService.java` | 需要生效中的肖像授权才能出片。 | 需要生效中的肖像授权才能生成视频。 |
| `dap/service/DapMaterialService.java` | 缺少查询条件（refType + refId） | 缺少查询条件，请刷新后重试 |
| `dap/service/DapMaterialService.java` | 该数字人还没有定妆形象，先完成创建再送审 | 该数字人还没有定妆形象，请完成创建后送审 |
| `dap/service/DapWorkflowService.java` | 数字人还没有定妆形象，先完成创建再设计造型 | 数字人还没有定妆形象，请完成创建后设计造型 |
| `dap/service/DapWorkflowService.java` | 数字人还没有定妆形象，先完成创建再生成衍生 | 数字人还没有定妆形象，请完成创建后生成衍生 |
| `dap/service/DapWorkflowService.java` | 精调结果图过大（上限 15MB） | 精调结果图过大（上限 15 MB） |
| `dap/service/DapAssetService.java` | 场景还没有主图，先上传或等待生成完成 | 场景还没有主图，请上传或等待生成完成 |
| `dap/service/DapAssetService.java` | 产品还没有主图，先上传或等待生成完成 | 产品还没有主图，请上传或等待生成完成 |
| `dap/service/DapAssetService.java` | 图片过大（上限 30MB） | 图片过大（上限 30 MB） |
| `dap/service/DapLicenseService.java` | 真人形象不能通过声明式接口直接授权，请完成当前协议确认与本人刷脸核验 | 真人形象需完成授权协议确认和本人刷脸核验后才能授权 |
| `dap/service/DapModelBilling.java` | 请在原模型价格配置中设置文本模型的 Token 售价 | 生成服务暂不可用，请联系平台处理 |
| `dap/service/DapModelBilling.java` | 已受理任务的模型接入点已变化，请重新提交 | 任务使用的模型已变化，请重新提交 |
| `dap/service/DapModelBilling.java` | 此任务没有已定价的文本处理阶段 | 此任务暂未定价，请重新提交 |
| `dap/service/DapModelBilling.java` | 原任务的模型接入点不可用，不能换模型重试 | 原任务使用的模型已不可用，不能更换模型重试 |
| `dap/service/DapModelBilling.java` | 请在后台为数字人用途绑定模型接入点 | 生成服务暂不可用，请联系平台处理 |
| `dap/service/DapMultimodalClient.java` | 模型接入点与已确认费用不一致 | 模型与已确认的费用不一致，请重新提交 |
| `dap/service/DapMultimodalClient.java` | "未配置生成引擎(" + channel + "):请在管理后台「AI 模型与 Key + AI 应用绑定」为对应用途绑定启用端点" | "生成服务暂不可用，请联系平台处理" |
| `dap/service/DapMultimodalClient.java` | "请求体序列化失败: " + e.getMessage() | "生成请求准备失败，请重试" |
| `dap/service/DapVideoBridge.java` | 运镜视频模型未配置 | 运镜视频暂不可用，请联系平台处理 |
| `dap/service/DapJobRunner.java` | "出图 " + s[1] | "生成图片 " + s[1] |
| `dap/service/DapJobRunner.java`（5 处） | "落库…" | "保存结果…" |
| `dap/service/DapAssetJobs.java`（2 处） | "落库…" | "保存结果…" |
| `dap/service/DapAssetJobs.java` | "合成出片（" | "合成画面（" |
| `dap/service/modelink/HttpModelinkGateway.java` | 该素材分组当前不可删除（未到终态或组内仍有素材） | 该素材分组仍在处理中或仍有素材，暂时无法删除 |
| `card/controller/CardController.java` | 说点什么才能接着聊 | 请输入内容后发送 |
| `card/controller/CardController.java` | "一次说太多了（超过 " + CardPersonaService.MAX_MSG_CHARS + " 字），分几句说。" | "单次内容不能超过 " + CardPersonaService.MAX_MSG_CHARS + " 字，请分次发送" |
| `card/controller/CardController.java` | 对话太长了，重新开一段。 | 对话内容已达上限，请新建对话 |
| `card/controller/CardController.java` | 先把人设聊出来，才能按它改写文案 | 请完成人设对话后改写文案 |
| `card/service/CardPersonaService.java` | "AI 返回的" + shape.what() + "结果格式不对，请重试。" | "AI 返回的" + shape.what() + "结果格式有误，请重试" |
| `card/service/CardPersonaService.java` | "AI 返回的" + shape.what() + "结果缺了「" + k + "」，请重试。" | "AI 返回的" + shape.what() + "结果不完整，请重试" |
| `card/service/CardPersonaService.java` | AI 返回的内容无法解析，请重试。 | AI 返回的内容无法解析，请重试 |
| `card/service/CardPersonaService.java` | 人设对话调用失败，请稍后重试。 | 人设对话失败，请稍后重试 |
| `card/service/CardService.java`（2 处） | "这个形象不存在" | "形象不存在" |
| `card/service/CardService.java` | 先选一个数字人形象 | 请选择数字人形象 |
| `card/service/CardService.java` | 名片还没有名字，先把基础信息填上 | 名片还没有姓名，请填写基础信息 |
| `card/service/CardService.java` | 名片还没有身份（公司 · 职务），先补上再发布 | 名片还没有公司和职务，请填写后发布 |
| `card/service/CardService.java` | 」是保留短链，换一个 | 」是保留短链，请更换 |
| `card/service/CardService.java` | 这个短链被占用了，换一个 | 此短链已被占用，请更换 |
| `card/service/CardService.java` | 名片内容存不下来，检查一下格式 | 名片内容保存失败，请检查格式后重试 |
| `card/service/CardService.java` | 名片内容读不出来了 | 名片内容加载失败，请稍后重试 |
| `ipstudio/controller/IpStudioController.java` | 存为官方内容会出现在所有人的「新建画布」里，只有超级管理员能做。 | 保存为官方内容后，所有人都能在「新建画布」中看到，仅超级管理员可操作 |
| `ipstudio/controller/IpStudioController.java` | 只有平台运营能看官方内容管理。 | 仅平台运营可查看官方内容管理 |
| `ipstudio/controller/IpStudioController.java` | 只有平台运营能改官方内容。 | 仅平台运营可修改官方内容 |
| `ipstudio/controller/IpStudioController.java` | 删除会把素材副本一起清掉，删了找不回来，只有超级管理员能做。只是想让别人看不到的话，「下线」就够了。 | 删除后素材副本将一并清除且无法恢复，仅超级管理员可操作。如只需隐藏，请使用「下线」 |
| `ipstudio/controller/IpStudioController.java` | 只有平台运营能下线官方内容。 | 仅平台运营可下线官方内容 |
| `ipstudio/dialogue/StudioDialogueService.java` | 新对话的请求编号无效 | 请求已失效，请刷新页面后重试 |
| `ipstudio/dialogue/StudioDialogueService.java`（2 处） | 同一请求的内容已改变，请重新提交 | 请求已失效，请刷新页面后重试 |
| `ipstudio/dialogue/StudioDialogueService.java` | 同一条消息的内容已改变，请重新发送 | 消息内容已变化，请刷新后重新发送 |
| `ipstudio/dialogue/StudioDialogueService.java` | 控制请求编号无效 | 请求已失效，请刷新页面后重试 |
| `ipstudio/dialogue/StudioDialogueService.java` | "消息编号无效" | "请求已失效，请刷新页面后重试" |
| `ipstudio/dialogue/StudioDialogueService.java` | "这次制作已确认由" + ("enterprise".equals(fixedPayer.mode()) ? "企业" : "个人") + "积分付款，制作期间的对话也由它付；要换付款账户，请先结束这次制作" | "本次制作已确认使用" + ("enterprise".equals(fixedPayer.mode()) ? "企业" : "个人") + "积分付款，制作期间的对话也使用该账户。如需更换付款账户，请结束本次制作" |
| `ipstudio/dialogue/StudioDialogueService.java` | 此模型尚未配置按量积分售价 | 此模型暂未定价，请选择其他模型 |
| `ipstudio/dialogue/StudioDialogueService.java` | 现在有不止一张待确认的方案，请说明确认的是哪一张，或直接点卡片上的按钮 | 当前有多张待确认的方案，请说明确认哪一张，或点击卡片上的按钮 |
| `ipstudio/dialogue/StudioDialogueTurnWorker.java` | 现在回复的人太多，请稍后再发一次 | 当前使用人数较多，请稍后重新发送 |
| `ipstudio/dialogue/StudioDialogueTurnWorker.java` | 这一轮回复中断了（服务重启或连接丢失），冻结积分已退回，可以再发一次 | 本轮回复已中断（服务重启或连接断开），冻结积分已退回，请重新发送 |
| `ipstudio/dialogue/StudioDialogueTurnWorker.java` | 这一轮没有完成，请再发一次 | 本轮未完成，请重新发送 |
| `ipstudio/dialogue/StudioDialogueTurnWorker.java` | 对话模型已停用或不再是默认模型，请联系管理员 | 当前对话模型已停用，请重新选择或联系平台处理 |
| `ipstudio/director/DirectorService.java` | 一键制作正在进行，请先停止制作，等进行中的任务结束后再删除 | 一键制作进行中，请停止制作，并在进行中的任务结束后删除 |
| `ipstudio/director/DirectorService.java` | 片段视频的受理结果还在核对，核对完成后再删除 | 片段视频的提交结果还在核对，核对完成后再删除 |
| `ipstudio/director/DirectorService.java` | "」还用在 " + refs.size() + " 个片段里（" | "」仍被 " + refs.size() + " 个片段使用（" |
| `ipstudio/director/DirectorService.java` | "），先在这些片段里解除关联再删除" | "），请在这些片段中解除关联后删除" |
| `ipstudio/director/DirectorService.java` | 请求编号无效，请刷新后重试 | 请求已失效，请刷新页面后重试 |
| `ipstudio/director/DirectorService.java`（2 处） | 暂无支持片段生成的视频模型，无法确定片段时长。请联系管理员开通 | 暂无可用于片段生成的视频模型，请联系平台处理 |
| `ipstudio/director/DirectorService.java` | 暂无支持片段生成的视频模型，请联系管理员开通 | 暂无可用于片段生成的视频模型，请联系平台处理 |
| `ipstudio/director/DirectorService.java` | 」的主形象，形态照着它画 | 」的主形象，形态图将以它为参考 |
| `ipstudio/director/DirectorService.java` | 」的主视图，其他视角照着它画 | 」的主视图，其他视角将以它为参考 |
| `ipstudio/director/DirectorService.java` | 字符，H3 收不下。请重新优化，或按原文生成 | 字符，超出模型上限。请重新优化或按原文生成 |
| `ipstudio/director/DirectorService.java` | 」的提示词优化没成功，已按原文生成 | 」的提示词优化失败，已按原文生成 |
| `ipstudio/director/DirectorService.java` | 视频已生成，文件读取失败。请联系管理员处理，勿重复生成。 | 视频已生成，但文件读取失败。请联系平台处理，请勿重复生成。 |
| `ipstudio/director/DirectorService.java` | 模型因输出额度停止，已保留返回内容，可能尚未写完；请核对后继续 | 模型输出已达上限，已保留返回内容，可能尚未写完。请核对后继续 |
| `ipstudio/director/DirectorService.java` | "（这次读了第 " | "（本次提取第 " |
| `ipstudio/director/DirectorService.java` | " 集；剩下的集再点一次提取）" | " 集；其余各集请再次提取）" |
| `ipstudio/director/DirectorService.java` | 剧本正在写，请稍候 | 剧本生成中，请稍候 |
| `ipstudio/director/DirectorService.java` | 这段对话太长了，请开一段新对话 | 对话内容已达上限，请新建对话 |
| `ipstudio/director/DirectorService.java` | " 字，超过当前文本模型一次能读的约 " + chars(budget) + " 字，AI 会读不全，所以没有提交、没有扣积分。" | " 字，超过当前文本模型单次可读取的约 " + chars(budget) + " 字。本次未提交，未扣积分。" |
| `ipstudio/director/DirectorService.java` | 选中的正文和当前正文对不上，请重新选择要修改的段落 | 选中的内容与当前正文不一致，请重新选择 |
| `ipstudio/director/DirectorService.java` | 」的出图提示词在助手回复后又改过，这条建议没有写入 | 」的提示词在助手回复后又改过，这条建议没有写入 |
| `ipstudio/director/DirectorService.java`（2 处） | "描述或出图提示词已修改" | "描述或提示词已修改" |
| `ipstudio/director/DirectorService.java` | "」不能出 " + ratioNames(missing) | "」不支持生成 " + ratioNames(missing) |
| `ipstudio/director/DirectorService.java` | "，短剧导演台的道具、角色场景和分镜要用方图、横图和竖图。请选择其他图片模型" | "。短剧导演台的道具、角色、场景和分镜需要方图、横图和竖图，请选择其他图片模型" |
| `ipstudio/director/DirectorService.java` | 默认图片模型暂不可用，请在作品设置里选择其他图片模型，或联系管理员 | 默认图片模型暂不可用，请在作品设置中选择其他图片模型，或联系平台处理 |
| `ipstudio/director/DirectorService.java` | 作品设置里选的图片模型已停用或不再开放，请在作品设置里换一个图片模型 | 作品设置中所选的图片模型已停用，请在作品设置中更换图片模型 |
| `ipstudio/director/DirectorService.java` | "作品设置里选的图片模型「" | "作品设置中所选的图片模型「" |
| `ipstudio/director/DirectorService.java` | "」不能出 " + ratioName(ratio) + "，" | "」不支持生成 " + ratioName(ratio) + "，" |
| `ipstudio/director/DirectorService.java` | 道具资产图要用方图。请在作品设置里换一个能出方图的图片模型 | 道具资产图需要方图。请在作品设置中更换支持方图的图片模型 |
| `ipstudio/director/DirectorService.java` | 角色资产图要用横图。请在作品设置里换一个能出横图的图片模型 | 角色资产图需要横图。请在作品设置中更换支持横图的图片模型 |
| `ipstudio/director/DirectorService.java` | 场景资产图要用横图。请在作品设置里换一个能出横图的图片模型 | 场景资产图需要横图。请在作品设置中更换支持横图的图片模型 |
| `ipstudio/director/DirectorService.java` | 分镜图跟作品画幅走。请在作品设置里换一个画幅，或换一个图片模型 | 分镜图跟随作品画幅。请在作品设置中更换画幅或图片模型 |
| `ipstudio/director/DirectorService.java` | 四视图没有切分成功，请重新生成 | 四视图切分失败，请重新生成 |
| `ipstudio/director/DirectorService.java` | "分镜脚本没写成。可点「重试失败项」，或在「分镜」中单独写" | "分镜脚本生成失败。可点击「重试失败项」，或在「分镜」中单独生成" |
| `ipstudio/director/DirectorService.java` | 没能自动拆分，已作为一集继续；可以在「剧本」中撤销拆分后重新拆分 | 自动拆分失败，已作为一集继续；可在「剧本」中撤销拆分后重新拆分 |
| `ipstudio/director/DirectorService.java` | 有一份新写的分镜脚本等你决定要不要换，请到「分镜」处理 | 有一份新的分镜脚本待确认，请在「分镜」中处理 |
| `ipstudio/director/DirectorService.java` | " 段放进了设定资料，不会拍成画面，如果是正片可在「剧本」中并入第 1 集" | " 段放进了设定资料，不会生成画面；如果是正片，可在「剧本」中并入第 1 集" |
| `ipstudio/director/DirectorService.java` | 」还没有这张图，先按主视图参考。可在「资产」里生成四视图 | 」还没有这张图，暂按主视图参考。可在「资产」中生成四视图 |
| `ipstudio/h3/H3PromptRewrite.java` | "视频提示词优化没成功（" + message + "），本次未扣积分，请重试或按原文生成" | "视频提示词优化失败（" + message + "），本次未扣积分。请重试或按原文生成" |
| `ipstudio/h3/H3PromptRewrite.java` | 优化稿缺少主体说明（subject_definitions），人物可能对不上参考图 | 优化稿缺少主体说明，人物可能与参考图不一致 |
| `ipstudio/h3/H3PromptRewrite.java` | 优化稿缺少概述（summary） | 优化稿缺少概述 |
| `ipstudio/execution/StudioNaturalApprovals.java` | "你说的重做额度是 " + saidFix.iterator().next() + " 积分，确认时只能用这个数；要改请直接说新的额度，或在卡片上修改" | "你在消息中提到的重做额度为 " + saidFix.iterator().next() + " 积分，确认时将按此金额执行。如需调整，请在消息中说明新的额度，或在确认卡上修改" |
| `ipstudio/execution/StudioNaturalApprovals.java` | "你说的上限是 " + saidTotal.iterator().next() + " 积分，确认时只能用这个数；要改请直接说新的上限，或在卡片上修改" | "你在消息中提到的上限为 " + saidTotal.iterator().next() + " 积分，确认时将按此金额执行。如需调整，请在消息中说明新的上限，或在确认卡上修改" |
| `ipstudio/execution/StudioNaturalApprovals.java` | " 积分不同，需要你在消息里说出新的上限，或在卡片上修改" | " 积分不同，请在消息中说明新的上限，或在确认卡上修改" |
| `ipstudio/execution/StudioNaturalApprovals.java` | 重做额度与确认卡上的不同，需要你在消息里说出这个数，或在卡片上修改 | 重做额度与确认卡上的不同，请在消息中说明新的额度，或在确认卡上修改 |
| `ipstudio/execution/StudioPlanExecutionBridge.java` | "请求编号无效" | "请求已失效，请刷新页面后重试" |
| `ipstudio/execution/StudioPlanExecutionService.java`（3 处） | "请求编号无效" | "请求已失效，请刷新页面后重试" |
| `ipstudio/execution/StudioPlanExecutionService.java` | 同一请求的内容已改变，请刷新后重新提交 | 请求已失效，请刷新页面后重试 |
| `ipstudio/execution/StudioPlanExecutionService.java`（2 处） | 这张画布已经有一项连续制作在进行，请先结束它 | 这张画布已有进行中的连续制作，请先结束 |
| `ipstudio/execution/StudioPlanExecutionService.java` | 付款账户与这次制作已确认的不一致；要换付款人，请结束这次制作后重新开始 | 付款账户与本次制作已确认的不一致。如需更换付款账户，请结束本次制作后重新开始 |
| `ipstudio/execution/StudioPlanExecutionService.java` | 上限不能低于已花费和在途的  | 上限不能低于已花费和进行中的  |
| `ipstudio/execution/StudioPlanExecutionService.java` | 已暂停：不会再提交新的步骤，已受理的任务会继续完成和结算。 | 已暂停：不再提交新的步骤，已提交的任务会继续完成并结算。 |
| `ipstudio/execution/StudioPlanExecutionService.java` | 已停止：不会再提交新的步骤；还在排队的任务会取消，已交给生成引擎的任务按原链完成和结算。 | 已停止：不再提交新的步骤。排队中的任务将取消，已提交的任务会继续完成并结算。 |
| `ipstudio/execution/StudioPlanExecutionService.java` | 原任务的受理结果还没有确认，请先核对原任务，不能重复生成 | 原任务的提交结果尚未确认，不能重复生成。请先确认原任务 |
| `ipstudio/execution/StudioPlanExecutionService.java` | 这一步已尝试 3 次，请先在问题节点完成修复，再继续生成 | 此步骤已尝试 3 次，请在画布上修复后继续生成 |
| `ipstudio/execution/StudioPlanExecutionService.java` | "预算不够，还差 "+shortfall+" 积分。可以追加预算或缩小计划后再继续" | "预算不足，还差 "+shortfall+" 积分。请追加预算或缩小计划后继续" |
| `ipstudio/execution/StudioPlanExecutionService.java` | 计划还没有服务端报价，暂时不能确认 | 计划尚未报价，暂时无法确认 |
| `ipstudio/execution/StudioPlanExecutor.java` | 。已受理的任务会继续结算。 | 。已提交的任务会继续结算。 |
| `ipstudio/execution/StudioPlanExecutor.java` | "。可以把它加入这次制作重新编排，或者不用它重新编排。" | "。可将它加入本次制作并重新编排，或不使用它并重新编排。" |
| `ipstudio/execution/StudioPlanExecutor.java` | "。可以不用它重新编排，或结束本次制作。" | "。可不使用它并重新编排，或结束本次制作。" |
| `ipstudio/execution/StudioPlanExecutor.java` | "预算不够：本阶段已花 "+spent+" 积分、在途 "+inFlight+" 积分，下一步「" | "预算不足：本阶段已花费 "+spent+" 积分，进行中 "+inFlight+" 积分，下一步「" |
| `ipstudio/execution/StudioPlanExecutor.java` | " 积分 "+shortfall+" 积分。可以追加预算或缩小计划。" | " 积分 "+shortfall+" 积分。请追加预算或缩小计划。" |
| `ipstudio/execution/StudioPlanSteps.java` | 这一步现在还不能自动做 | 此步骤暂不支持自动执行 |
| `ipstudio/execution/StudioVideoTaskService.java` | "请求编号无效" | "请求已失效，请刷新页面后重试" |
| `ipstudio/execution/StudioVideoTaskService.java` | 这次请求的内容已变化，请新建一次制作 | 请求已失效，请刷新页面后重试 |
| `ipstudio/execution/StudioVideoTaskService.java` | 请先放入参考视频 | 请添加参考视频 |
| `ipstudio/execution/StudioVideoTaskService.java` | 参考视频不在草稿里，请重新放入 | 参考视频不在草稿中，请重新添加 |
| `ipstudio/segmented/SegmentedVideoService.java` | "请求编号无效" | "请求已失效，请刷新页面后重试" |
| `ipstudio/segmented/SegmentedVideoService.java` | 素材类型不对 | 素材类型不正确 |
| `ipstudio/segmented/SegmentedVideoService.java` | "」不在这张画布上了，请重新放一次" | "」已不在画布上，请重新添加" |
| `ipstudio/segmented/SegmentedVideoService.java` | "价格有变化，这条最多要 " + price.cap() + " 积分。请看一眼新价格再点一次" | "价格已变化，请确认新价格后重试" |
| `ipstudio/segmented/SegmentedVideoService.java` | "视频时长要在 " + MAX_TOTAL_SECONDS + " 秒以内" | "视频时长不能超过 " + MAX_TOTAL_SECONDS + " 秒" |
| `ipstudio/segmented/SegmentedVideoService.java` | "」用不了分镜图，做不了长视频。请换一个视频模型" | "」不支持分镜图，无法生成长视频。请更换视频模型" |
| `ipstudio/segmented/SegmentedVideoService.java` | " 秒要分 " + segments.size() + " 段，太多了。请缩短时长或换单段更长的模型" | " 秒需要分 " + segments.size() + " 段，超出上限。请缩短时长或更换单段更长的模型" |
| `ipstudio/segmented/SegmentedVideoService.java` | "」出不了 " + ratio + " 的分镜图，请换一个画面比例" | "」不支持生成 " + ratio + " 的分镜图，请更换画面比例" |
| `ipstudio/segmented/SegmentedVideoService.java` | "开拍前审一遍分镜脚本" | "生成前检查分镜脚本" |
| `ipstudio/segmented/SegmentedVideoService.java` | "按分镜脚本出分镜图" | "按分镜脚本生成分镜图" |
| `ipstudio/segmented/SegmentedVideoService.java` | "按分镜脚本出片" | "按分镜脚本生成视频" |
| `ipstudio/scene/StudioSceneCatalog.java`（4 处） | 这个场景不存在，请刷新后重选 | 该场景已下架，请刷新后重新选择 |
| `ipstudio/scene/StudioSceneCatalog.java` | "写一句想要的画面" | "请描述想要的画面" |
| `ipstudio/scene/StudioSceneCatalog.java` | 这个场景的素材位变了，请刷新后重选 | 该场景的素材要求已变化，请刷新后重新选择 |
| `ipstudio/scene/StudioSceneCatalog.java`（4 处） | bad("先放" +  | bad("请添加" +  |
| `ipstudio/scene/StudioSceneCatalog.java`（2 处） | "最多放 " | "最多 " |
| `ipstudio/scene/StudioSceneCatalog.java`（2 处） | 这个选项已经下架，请刷新后重选 | 该选项已下架，请刷新后重新选择 |
| `ipstudio/scene/StudioSceneCatalog.java` | "先写一句要求" | "请填写要求" |
| `ipstudio/service/IpProjectService.java` | 这个场景不存在，请刷新后重选 | 该场景已下架，请刷新后重新选择 |
| `ipstudio/service/IpProjectService.java`（2 处） | 这张画布不存在，或者已经删了 | 画布不存在或已删除 |
| `ipstudio/service/IpProjectService.java` | "工作流不存在或已下线：" + templateId | "模板不存在或已下线" |
| `ipstudio/service/IpProjectService.java` | "画布数据过大（" + (bytes / 1024) + "KB），请精简节点或参考图后重试" | "画布内容过大（" + (bytes / 1024) + " KB），请删除部分节点或参考图后重试" |
| `ipstudio/service/IpProjectService.java` | "MB 上限，请压缩后重试" | " MB 上限，请压缩后重试" |
| `ipstudio/service/IpProjectService.java` | 这个素材取不到了，可能已被清理 | 素材已不可用，可能已被清理 |
| `ipstudio/service/IpProjectService.java` | 选中的那次生成不存在或不属于本项目，请重新生成并选图 | 所选生成结果不存在或不属于此画布，请重新生成并选择图片 |
| `ipstudio/service/IpProjectService.java` | "一次最多重签 " + MAX_SIGN_KEYS + " 张图，请分批" | "一次最多刷新 " + MAX_SIGN_KEYS + " 张图片，请分批操作" |
| `ipstudio/service/IpProjectService.java` | 这张画布已经有一份更新的内容了。现在保存会把那份覆盖掉，刷新一下再改。 | 这张画布已有更新的版本，继续保存将覆盖该版本。请刷新后再修改 |
| `ipstudio/service/IpProjectService.java` | 画布数据无法序列化 | 画布内容保存失败，请重试 |
| `ipstudio/service/IpProjectService.java` | 生成服务响应异常，受理结果待核对。请联系运营核对原任务，请勿重复生成；冻结积分待核实后结算。 | 生成服务响应异常，提交结果待核对。请联系平台核对原任务，请勿重复生成；冻结积分将在核实后结算。 |
| `ipstudio/service/IpDemoTemplateService.java` | 画布数据无法序列化 | 画布内容保存失败，请重试 |
| `ipstudio/service/IpDemoTemplateService.java` | 请先完成素材上传，再保存画布模板 | 请完成素材上传后保存模板 |
| `ipstudio/service/IpDemoTemplateService.java` | 请从发布为模板入口新增版本，不能覆盖已发布配方 | 请通过「保存为模板」新增版本，不能覆盖已发布的模板 |
| `ipstudio/service/IpDemoTemplateService.java` | "这张画布的素材太多（" + referenced + " 个），先精简到 " + MAX_ASSETS + " 个以内" | "这张画布的素材过多（" + referenced + " 个），请减少到 " + MAX_ASSETS + " 个以内" |
| `ipstudio/service/IpDocs.java` | 画布内容格式不对 | 画布内容格式不正确，请刷新后重试 |
| `ipstudio/service/IpDocs.java` | 画布内容缺 nodes / connections | 画布内容不完整，请刷新后重试 |
| `ipstudio/service/IpPublishService.java` | "该项目已发布为数字资产 " + project.getPublishedAvatarId() + "，暂不支持追加发布" | "这张画布已发布为数字资产 " + project.getPublishedAvatarId() + "，暂不支持再次发布" |
| `ipstudio/service/IpPublishService.java` | 请先选择要发布的主形象节点 | 请选择要发布的主形象图片 |
| `ipstudio/service/IpPublishService.java` | "画布上找不到节点 " + nodeId | "画布上找不到所选内容，请刷新后重试" |
| `ipstudio/service/IpPublishService.java` | 这张还没出图，先生成再发布 | 这张图片还没有生成，请生成后发布 |
| `ipstudio/service/IpRunService.java` | 画布上找不到该节点，请刷新后重试 | 画布上找不到所选内容，请刷新后重试 |
| `ipstudio/service/IpRunService.java` | 这个节点不用运行 | 此内容无需生成 |
| `ipstudio/service/IpRunService.java` | 该节点正在生成中，请等它完成后再运行 | 正在生成中，请等待完成后重试 |
| `ipstudio/service/IpRunService.java` | 这张正在生成中，等它完成再跑 | 该图片正在生成中，请等待完成后重试 |
| `ipstudio/service/IpRunService.java` | 同一请求的创作方式已改变，请重新提交 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/IpRunService.java` | 缺少请求编号，请刷新后重试 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/IpRunService.java`（2 处） | 同一请求的内容已改变，请重新提交 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/IpRunService.java` | 视频任务没建齐，请稍后再试 | 视频任务创建失败，请重试。 |
| `ipstudio/service/IpRunService.java` | 选择的出图模型不可用，请在下拉里重新选一个 | 所选图片模型不可用，请重新选择 |
| `ipstudio/service/IpRunService.java`（2 处） | "选择的出图模型不可用" | "所选图片模型不可用，请重新选择" |
| `ipstudio/service/IpRunService.java` | "请选择图片节点" | "请选择一张图片" |
| `ipstudio/service/IpRunService.java` | 图片已交给生成引擎，请等待原任务结果 | 图片已提交生成，暂时无法停止，请等待生成结果 |
| `ipstudio/service/IpRunService.java` | 生成已交给引擎，暂时不能停止。请等待原任务结果 | 已提交生成，暂时无法停止。请等待生成结果 |
| `ipstudio/service/IpRunService.java` | 视频已交给生成引擎，暂时不能停止。可以继续编辑并等待原任务结果 | 视频已提交生成，暂时无法停止。你可以继续编辑，并等待生成结果 |
| `ipstudio/service/IpRunService.java` | 企业积分创作需要请求编号，请刷新后重试 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/IpRunService.java` | "请求编号无效" | "请求已失效，请刷新页面后重试" |
| `ipstudio/service/IpRunService.java` | 所选模型暂未开放该分辨率，请重新选择模型或联系运营 | 所选模型暂不支持该分辨率，请选择其他模型 |
| `ipstudio/service/IpRunWorker.java` | 读取不到照片，请重新上传后再抽取 | 照片加载失败，请重新上传后抽取 |
| `ipstudio/service/IpRunWorker.java` | "看图抽取特征卡失败：当前形象引擎可能不支持图片输入。" | "特征卡抽取失败，当前模型可能不支持读取图片。" |
| `ipstudio/service/IpRunWorker.java` | "请在后台给「数字人 · 人设」用途绑定支持看图的模型，或手动填写特征卡" | "请手动填写特征卡或联系平台处理" |
| `ipstudio/service/IpRunWorker.java` | 读取不到主形象图，无法锁定同一个人的样貌；已退回冻结积分，请重新生成主形象并选图 | 主形象图加载失败，无法保持人物样貌一致。冻结积分已退回，请重新生成主形象并选择图片 |
| `ipstudio/service/IpRunWorker.java` | 读取不到原照片，无法锁定同一个人的样貌；已退回冻结积分，请重新上传照片 | 原照片加载失败，无法保持人物样貌一致。冻结积分已退回，请重新上传照片 |
| `ipstudio/service/JusuanImageClient.java` | 图片模型的调用地址必须是有效的 HTTPS 地址 | 当前图片模型暂不可用，请选择其他模型或联系平台处理 |
| `ipstudio/service/JusuanImageClient.java` | 当前图片模型尚未配置合法请求规格 | 当前图片模型暂不可用，请选择其他模型 |
| `ipstudio/service/JusuanImageClient.java` | 图片模型未配置可用的请求协议 | 当前图片模型暂不可用，请选择其他模型 |
| `ipstudio/service/JusuanImageClient.java` | 图片受理结果尚未确认，请联系运营核对原请求；请勿重新生成 | 图片提交结果尚未确认，请联系平台核对；请勿重新生成 |
| `ipstudio/service/JusuanImageClient.java`（2 处） | 参考图格式不支持或超过端点配置的大小上限 | 参考图格式不支持或超过大小上限 |
| `ipstudio/service/JusuanImageClient.java`（2 处） | 参考图超过端点配置的大小上限 | 参考图超过大小上限 |
| `ipstudio/service/JusuanImageClient.java` | 图片编辑的表单参数必须是简单字段 | 当前图片模型暂不可用，请选择其他模型 |
| `ipstudio/service/JusuanImageClient.java` | 参考图没有可供供应商读取的 HTTPS 地址 | 参考图暂时无法读取，请重新上传 |
| `ipstudio/service/JusuanImageClient.java` | 图片引擎返回成功，但结果里没有图片，请重试；多次出现请联系运营核对模型配置 | 生成服务未返回图片，请重试；多次出现请联系平台处理 |
| `ipstudio/service/JusuanImageClient.java` | 图片结果超过端点配置的大小上限 | 图片结果超过大小上限 |
| `ipstudio/service/JusuanImageClient.java` | 图片结果地址不在端点允许的 HTTPS 域名内 | 图片结果不可用，请重试 |
| `ipstudio/service/JusuanImageClient.java` | 图片结果不可用或超过端点配置的大小上限 | 图片结果不可用或超过大小上限 |
| `ipstudio/service/JusuanImageClient.java` | 图片生成接口返回的数据无法解析，请联系运营核查 | 生成服务返回的数据无法解析，请联系平台处理 |
| `ipstudio/service/JusuanImageClient.java` | 聚算图片任务或产物编号无效 | 生成服务返回的任务编号无效，请联系平台处理 |
| `ipstudio/service/StudioPlatformPricing.java` | 配音定价暂不可用，请检查运营平台成本与定价配置 | 配音暂不可用，请联系平台处理 |
| `ipstudio/service/StudioPlatformPricing.java` | 配音定价配置与模型不匹配，请联系运营核对 | 配音暂不可用，请联系平台处理 |
| `ipstudio/service/StudioPointPricing.java` | 模型用户积分售价尚未正确配置 | 此模型暂未定价，请选择其他模型 |
| `ipstudio/service/StudioPointPricing.java` | 模型积分换算尚未正确配置 | 此模型暂未定价，请选择其他模型 |
| `ipstudio/service/StudioTokenBilling.java` | 请先配置文本模型标准售价。想免费送用户体验，请发放模型赠款 | 此模型暂未定价，请选择其他模型 |
| `ipstudio/service/StudioTokenBilling.java` | 文本模型渠道已变更，请重新确认后再生成 | 文本模型已更新，请重新确认后生成 |
| `ipstudio/service/StudioTokenBilling.java` | 模型未返回有效 Token 用量，本次未扣积分 | 生成服务未返回用量信息，本次未扣积分，请重试 |
| `ipstudio/service/StudioRecreation.java` | 拆解报告不完整或画面引用无效，请核对模型输出 | 拆解报告不完整，请重试 |
| `ipstudio/service/StudioRunBilling.java` | 同一请求的付款账户已改变，请重新提交 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/StudioSpeechService.java` | 同一配音请求的内容已改变，请重新提交 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/StudioLipSyncService.java` | 同一口型请求的素材已改变，请重新提交 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/StudioLipSyncService.java` | 口型任务不属于当前项目 | 口型任务不属于当前画布 |
| `ipstudio/service/StudioLipSyncMedia.java` | 口型素材过大：视频最多 128MB，音频最多 25MB | 口型素材过大：视频最多 128 MB，音频最多 25 MB |
| `ipstudio/service/StudioLipSyncMedia.java` | 人物视频需为 15–60fps | 人物视频需为 15–60 fps |
| `ipstudio/service/StudioSpeechWorker.java` | label+"引擎未完成本次生成，冻结积分已释放" | label+"未能完成，冻结积分已退回" |
| `ipstudio/service/StudioSpeechWorker.java` | 生成准备失败，任务未提交，冻结积分已释放。请检查素材后重试 | 生成准备失败，任务未提交，冻结积分已退回。请检查素材后重试 |
| `ipstudio/service/StudioTemplateExecutionService.java` | "请求编号无效" | "请求已失效，请刷新页面后重试" |
| `ipstudio/service/StudioTemplateExecutionService.java` | 请求已用于另一个步骤 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/StudioTemplateExecutionService.java` | 同一请求内容已改变，请查询原任务 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/StudioTemplateExecutionService.java` | 此步骤已受理，请查询原任务 | 此步骤已提交，请等待生成结果 |
| `ipstudio/service/StudioTemplateExecutionService.java` | 创作指令应为 1 到 16000 字 | 提示词应为 1 到 16000 字 |
| `ipstudio/service/StudioTemplateExecutionService.java` | 请填写创作指令 | 请填写提示词 |
| `ipstudio/service/StudioTemplateService.java` | 视频指令不能为空值 | 视频提示词不能为空 |
| `ipstudio/service/StudioTemplateService.java` | "图片指令" | "图片提示词" |
| `ipstudio/service/StudioTemplateService.java` | 填入后的创作指令超过长度限制 | 填入后的提示词超过长度限制 |
| `ipstudio/service/StudioConversationShareService.java` | 复制请求缺少有效标识，请刷新后重试 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/StudioConversationShareService.java` | 该请求已用于另一份对话 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/StudioVoiceService.java` | 请使用当前项目已完成的真实配音 | 请使用当前画布已完成的配音 |
| `ipstudio/service/StudioVoiceService.java` | 配音文件暂时不可读取，请稍后重试 | 配音文件加载失败，请稍后重试 |
| `ipstudio/service/IpSavedAssetService.java` | 素材地址暂时无法读取，请重试 | 素材加载失败，请稍后重试 |
| `ipstudio/service/StudioVideoService.java` | "首帧图读不出来，没法按 "+aspectRatio.strip()+" 裁剪。请换一张 PNG 或 JPG 图片，或把画幅改成和首帧图一致" | "首帧图无法读取，无法按 "+aspectRatio.strip()+" 裁剪。请更换 PNG 或 JPG 图片，或将画幅改为与首帧图一致" |
| `ipstudio/service/StudioVideoService.java` | label+"读不出来，请重新选择" | label+"无法读取，请重新选择" |
| `ipstudio/service/StudioVisionFallback.java` | 分批读取所需Token超出本次预算，请减少素材或调整后台预算 | 素材过多，超出本次用量上限，请减少素材后重试 |
| `ipstudio/service/StudioVisionFallback.java` | 分批画面记录不完整，请核对模型输出 | 画面记录不完整，请重试 |
| `ipstudio/service/StudioVisionFallback.java` | "提示词库缺少「stage-vision-batch」：请在后台「提示词与技能」里启用或补齐后重试" | "看图功能暂不可用，请联系平台处理", null, "提示词库缺少「stage-vision-batch」：请在后台「提示词与技能」里启用或补齐" |
| `ipstudio/service/StudioWorkflowService.java`（2 处） | 同一请求的内容已改变，请重新提交 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/StudioWorkflowService.java`（4 处） | 此模型尚未配置按量积分售价 | 此模型暂未定价，请选择其他模型 |
| `ipstudio/service/StudioWorkflowService.java`（2 处） | 模型计费配置已更新，请刷新后重试 | 模型价格已更新，请刷新后重试 |
| `ipstudio/service/StudioWorkflowService.java` | 这个模型未配置图片读取能力，请切换模型或关闭读取画面 | 当前模型不支持读取图片，请切换模型或关闭读取画面 |
| `ipstudio/service/StudioWorkflowService.java` | 全片拆解需要至少4096输出Token预算，请调整模型配置 | 当前模型不支持全片拆解，请联系平台处理 |
| `ipstudio/service/StudioWorkflowService.java` | 画布上下文过长，请减少引用或按集创作 | 引用的画布内容过长，请减少引用或按集创作 |
| `ipstudio/service/StudioWorkflowService.java` | 提示词优化未绑定可用模型，可以关闭智能优化按原文生成 | 提示词优化暂不可用，可关闭「智能优化」按原文生成 |
| `ipstudio/service/StudioWorkflowService.java` | 提示词优化暂不可用（绑定模型未配置按量售价），可以关闭智能优化按原文生成 | 提示词优化暂不可用，可关闭「智能优化」按原文生成 |
| `ipstudio/service/StudioWorkflowService.java` | 文本模型不可用，请联系管理员配置 | 文本模型不可用，请联系平台处理 |
| `ipstudio/service/StudioWorkflowService.java` | 当前图片模型尚未配置可用规格 | 当前图片模型暂不可用，请选择其他模型 |
| `ipstudio/service/StudioWorkflowWorker.java`（2 处） | 创作模型已停用或不再是默认模型，请联系管理员 | 当前创作模型已停用，请联系平台处理 |
| `ipstudio/service/StudioWorkflowWorker.java` | 全片拆解需要至少4096输出Token预算，请调整模型配置 | 当前模型不支持全片拆解，请联系平台处理 |
| `ipstudio/service/StudioWorkflowWorker.java` | 片段读取结果被截断，请调整模型输出配置 | 片段读取结果不完整，请重试 |
| `ipstudio/service/StudioWorkflowWorker.java` | 本次Token预算已用完，请调整后台预算 | 本次用量已达上限，请缩短内容后重试 |
| `ipstudio/service/StudioWorkflowWorker.java` | 提示词优化用的文本模型已停用，可以关闭智能优化按原文生成 | 提示词优化暂不可用，可关闭「智能优化」按原文生成 |
| `ipstudio/service/StudioWorkflowWorker.java` | 模型未返回有效Token用量，本次未扣积分 | 生成服务未返回用量信息，本次未扣积分，请重试 |
| `ipstudio/service/StudioWorkflowWorker.java` | 创作超时，冻结积分已释放，可重新生成 | 创作超时，冻结积分已退回，可重新生成 |
| `ipstudio/service/StudioWorkflowWorker.java` | 创作已停止，模型费用待核对，冻结积分暂未释放 | 创作已停止，模型费用待核对，冻结积分暂未退回 |
| `ipstudio/service/StudioWorkflowWorker.java` | 提示词优化没成功，已按原文生成 | 提示词优化失败，已按原文生成 |
| `ipstudio/service/StudioWorkflowWorker.java` | 模型回复因输出额度停止，已保留返回内容 | 模型输出已达上限，已保留返回内容 |
| `ipstudio/service/StudioWorkflowWorker.java` | 模型因输出额度停止，原文已保留 | 模型输出已达上限，原文已保留 |
| `ipstudio/skill/StudioSkillDraftService.java` | "请求编号无效" | "请求已失效，请刷新页面后重试" |
| `ipstudio/skill/StudioSkillDraftService.java` | 同一请求的内容已改变，请重新提交 | 请求已失效，请刷新页面后重试 |
| `ipstudio/service/IpRunService.java` | "形象引擎未配置：请在管理后台「AI 应用绑定」为「数字人 · 人设」用途绑定一个支持图片输入的模型" | "生成服务暂不可用，请联系平台处理", null, "形象引擎未配置：请在管理后台「AI 应用绑定」为「数字人 · 人设」用途绑定一个支持图片输入的模型" |
| `ipstudio/service/IpRunService.java` | "形象引擎未配置：请在管理后台「AI 应用绑定」为「数字人 · 图片」用途绑定启用端点" | "生成服务暂不可用，请联系平台处理", null, "形象引擎未配置：请在管理后台「AI 应用绑定」为「数字人 · 图片」用途绑定启用端点" |
| `dap/service/DapJobService.java` | "生成引擎未配置：请在管理后台「AI 模型与 Key + AI 应用绑定」为数字人用途（人设/图片/视频）绑定端点" | "生成服务暂不可用，请联系平台处理", null, "生成引擎未配置：请在管理后台「AI 模型与 Key + AI 应用绑定」为数字人用途（人设/图片/视频）绑定端点" |
| `card/service/CardPersonaService.java` | "人设对话还没接入大模型：请在管理后台把「数字人 · 人设/翻译」用途绑定一个模型端点后再试。" | "人设对话暂不可用，请联系平台处理", null, "人设对话未绑定模型：请在管理后台把「数字人 · 人设/翻译」用途绑定一个模型端点" |
| `card/service/CardPersonaService.java` | "人设提示词尚未配置（promptKey=" + key + "），请在管理后台补全后再试。" | "人设对话暂不可用，请联系平台处理", null, "人设提示词尚未配置（promptKey=" + key + "），请在管理后台补全" |
| `dap/service/modelink/HttpModelinkGateway.java` | "未配置素材合规服务：请在管理后台「AI 应用绑定」把用途「数字资产 · 真人素材与授权」绑定七牛 modelink 端点" | "素材合规服务暂不可用，请联系平台处理", null, "未配置素材合规服务：请在管理后台「AI 应用绑定」把用途「数字资产 · 真人素材与授权」绑定七牛 modelink 端点" |
| `dap/service/modelink/ModelinkService.java` | "未配置素材合规服务：请在管理后台「AI 应用绑定」把用途「数字资产 · 真人素材与授权」绑定七牛 modelink 端点" | "素材合规服务暂不可用，请联系平台处理", null, "未配置素材合规服务：请在管理后台「AI 应用绑定」把用途「数字资产 · 真人素材与授权」绑定七牛 modelink 端点" |
| `ipstudio/dialogue/StudioDialogueService.java` | chosen ? "所选文本模型不可用：它不是对话用途的默认模型，也没有在后台「AI 模型」里启用为对话用途的候选模型"                                         : "还没有配置可用的对话模型：请在后台「AI 模型」里为对话用途绑定默认模型")) | chosen ? "所选对话模型不可用，请重新选择" : "对话功能暂不可用，请联系平台处理", null,                                 chosen ? "所选模型不是对话用途的默认模型，也没有在后台「AI 模型」里启用为对话用途的候选模型"                                         : "还没有配置可用的对话模型：请在后台「AI 模型」里为对话用途绑定默认模型")) |
| `ipstudio/service/IpRunWorker.java` | "生成失败（" + e.getClass().getSimpleName() + "），请稍后重试" | "生成失败，请稍后重试" |
| `dap/service/DapAssetJobs.java` | " 出片" | " 生成" |
| `ipstudio/h3/H3PromptRewrite.java` | 优化稿缺少保留说明（retention_analysis），人物外观可能不一致 | 优化稿缺少保留说明，人物外观可能不一致 |
| `ipstudio/h3/H3PromptRewrite.java` | 字符，H3 收不下，请重新优化或按原文生成 | 字符，超出模型上限，请重新优化或按原文生成 |
| `ipstudio/h3/H3PromptRewrite.java` | bad("没有返回 JSON") | bad("模型返回格式有误") |
| `ipstudio/h3/H3PromptRewrite.java`（2 处） | bad("没有写镜头") | bad("缺少镜头内容") |
| `ipstudio/service/StudioWorkflowWorker.java` | H3PromptRewrite.bad("没有返回 JSON") | H3PromptRewrite.bad("模型返回格式有误") |
| `ipstudio/service/StudioImageReconciliationService.java` | 供应商已确认原请求未受理，已退回未用积分 | 生成服务确认未收到此请求，已退回未用积分 |
| `service/materialvideo/MaterialVideoJobService.java` | "受理结果待核对" | "提交结果待核对" |
| `service/materialvideo/MaterialVideoJobService.java` | job.setErrorMessage("供应商已确认未受理，任务已关闭") | job.setErrorMessage("生成服务确认未收到此任务，任务已关闭") |
| `service/materialvideo/MaterialVideoModelClient.java` | 已受理视频任务的模型端点不存在，暂时无法查询结果。 | 视频任务使用的模型已不可用，暂时无法查询结果 |
| `ipstudio/controller/StudioEffectController.java` | 只有超级管理员能发布官方特效 | 仅超级管理员可发布官方特效 |
| `ipstudio/controller/StudioTemplateController.java` | 只有平台运营能发布官方模板 | 仅平台运营可发布官方模板 |
| `ipstudio/service/StudioTokenBilling.java` | 模型 Token 用量无效 | 生成服务返回的用量信息无效，请重试 |
| `ipstudio/director/DirectorService.java` | "台词加起来太长，发给视频模型的提示词超过 " | "台词过长，视频提示词超过 " |
| `ipstudio/director/DirectorService.java` | "选中的正文太长，请少选一些（最多 " + DirectorAssistant.MAX_SELECTION + " 字）" | "选中的正文过长，最多 " + DirectorAssistant.MAX_SELECTION + " 字" |
| `ipstudio/segmented/SegmentedVideoService.java` | 所选视频模型还没有可用的时长规格，请换一个模型 | 所选视频模型暂不可用，请更换模型 |
| `ipstudio/segmented/SegmentedVideoService.java` | 所选视频模型暂不可用，请换一个模型 | 所选视频模型暂不可用，请更换模型 |
| `ipstudio/service/StudioWorkflowService.java` | 所选视频模型不可用，请换一个模型 | 所选视频模型不可用，请更换模型 |
| `ipstudio/service/StudioWorkflowService.java` | 所选视频模型还没有可用的时长规格，请换一个模型 | 所选视频模型暂不可用，请更换模型 |
| `ipstudio/service/IpDemoTemplateService.java` | "未命名工作流" | "未命名模板" |
| `ipstudio/execution/StudioPlanExecutionService.java` | 换成了另一种做法，这次制作到此结束；已经做好的留在画布上。 | 已更换做法，本次制作结束。已完成的内容保留在画布上。 |
| `ipstudio/execution/StudioPlanExecutionService.java` | 换成了另一种做法：已经在生成的会做完并放进画布，后面的步骤不再提交。 | 已更换做法：生成中的内容完成后会放进画布，后续步骤不再提交。 |
| `ipstudio/execution/StudioPlanExecutor.java` | 」。已经提交的任务会照原样完成，后面的步骤先不提交。 | 」。已提交的任务会继续完成，后续步骤暂不提交。 |
| `ipstudio/execution/StudioPlanExecutor.java` | "」停下了：" | "」已暂停：" |
| `ipstudio/execution/StudioPlanExecutor.java` | 。可以继续重试这一步，或结束本次制作。 | 。可重试此步骤，或结束本次制作。 |
| `ipstudio/execution/StudioPlanExecutor.java` | "」认为有问题或无法判断。请看检查建议，决定采用当前版本、修改后重做，或继续下一步。" | "」发现问题或无法判断。请查看检查建议，决定采用当前版本、修改后重新生成，或继续下一步。" |
| `ipstudio/execution/StudioPlanExecutor.java` | 成片已做完，但有检查没通过或无法判断。请看检查建议，决定采用当前版本或修改重做。 | 成片已完成，但有检查项未通过或无法判断。请查看检查建议，决定采用当前版本或修改后重新生成。 |
| `ipstudio/service/StudioFilmStudy.java` | " 段放不下，请先剪短原片或换支持更长时长的视频模型" | " 段，超出上限。请先剪短原片或更换支持更长时长的视频模型" |
| `service/CreditService.java` | "hold 缺少 userId / referenceType / referenceId" | "冻结参数无效" |
| `service/CreditService.java` | "hold 桶分布异常: amount=" + amount + " 剩余=" + remaining | "积分冻结失败，请重试" |
| `service/CreditService.java` | "commit 金额必须为正数" | "结算积分必须为正数" |
| `service/CreditService.java` | "未找到对应的 hold: " + referenceType + ":" + referenceId | "未找到对应的冻结记录" |
| `service/CreditService.java` | "hold 已是终态 (" + hold.getStatus() + ")，无法 commit" | "冻结记录已结束，无法结算" |
| `service/CreditService.java` | "commit 金额 " + amount + " 超过剩余 hold " + hold.getRemainingAmount() | "结算积分超过剩余冻结积分" |
| `service/CreditService.java` | "creditAccount 不支持的入账类型：" + entryType | "不支持的入账类型" |
| `ipstudio/service/StudioHypitMedia.java` | 视频处理工具不可用，请配置Node.js 22以上、FFmpeg 5.1以上及Hypit媒体适配器 | 视频处理服务暂不可用，请稍后重试或联系平台处理（运维指引进 internalDetail） |
| `apps/server/src/main/resources/ipstudio/scenes.json` · free.description | 自己写描述，可以放几张参考图 | 自己写描述，可添加参考图 |
| `apps/server/src/main/resources/ipstudio/scenes.json` · free.hint | 说说想要什么画面。放了图片的话，输入 @ 可以指定用哪一张 | 描述想要的画面。添加图片后，输入 @ 可指定使用哪一张 |
| `apps/server/src/main/resources/ipstudio/scenes.json` · refs[].hint（5 处） | 放同一个人的不同角度或表情，结果更接近本人 | 添加同一人的不同角度或表情，结果更接近本人 |
| `apps/server/src/main/resources/ipstudio/scenes.json` · fullbody-sheet refs[].hint | 放同一个人的不同角度或全身照，结果更接近本人 | 添加同一人的不同角度或全身照，结果更接近本人 |
| `apps/server/src/main/resources/ipstudio/scenes.json` · ip-expression.description | 一次出九种表情，聊天、封面都能用 | 一次生成九种表情，聊天、封面都能用 |
| `apps/server/src/main/resources/ipstudio/scenes.json` · outfit-on-model.description | 把衣服穿到模特身上，出穿搭图 | 把衣服穿到模特身上，生成穿搭图 |
| `apps/server/src/main/resources/ipstudio/scenes.json` · outfit-on-model refs[].hint | 可以放一件的不同角度，或要一起穿的几件 | 可添加同一件的不同角度，或需要搭配的几件 |
| `apps/server/src/main/resources/ipstudio/scenes.json` · refs[].hint（4 处） | 放同一个商品的不同角度或细节，外观还原得更准 | 添加同一商品的不同角度或细节，外观还原更准确 |
| `apps/server/src/main/resources/ipstudio/scenes.json` · realism refs[].hint | 放这个人真实拍的照片，长相更不容易跑偏 | 添加此人的真实照片，长相更接近本人 |
| `apps/server/src/main/resources/ipstudio/scenes.json` · product-scene.hint | 没放场景图时，写想要的场景，例如：清晨洒满阳光的木质餐桌 | 未添加场景图时，请描述想要的场景，例如：清晨洒满阳光的木质餐桌 |
| `apps/server/src/main/resources/ipstudio/scenes.json` · recreation.placeholder | 说说要换成什么，例如：把原片里的护手霜换成我的精华液，人物换成我的 IP | 要替换的内容，例如：把原片里的护手霜换成我的精华液，人物换成我的 IP |
| `apps/server/src/main/resources/ipstudio/scenes.json` · brand-story.placeholder | 品牌名，有哪些可以讲的经历；没有就说想讲一个什么样的用户故事，例如：山野户外，想讲一个第一次带孩子露营的爸爸 | 品牌名和可讲述的经历；如无，可写想讲的用户故事，例如：山野户外，想讲一个第一次带孩子露营的爸爸 |
| `apps/server/src/main/resources/ipstudio/scenes.json` · homeGoals product-set.description | 白底图、卖点图、模特图一起出 | 白底图、卖点图、模特图一次生成 |

行为改动（#6）：`ipstudio/director/DirectorService.java` `clip.delete`，片段的分镜图或视频生成中时 409 `DIRECTOR_TASK_RUNNING`，文案「片段 N 的视频正在生成，完成后再删除」「片段 N 的分镜图正在生成，完成后再删除」，判断照 `clip.unlinkAsset`。用例 `DirectorAssetUnlinkTest#aClipCannotBeDeletedWhileItsBoardOrVideoIsGenerating`。`specs/BUSINESS_RULES.md`「导演台资产引用与解除关联」条已加一句。

改动的测试断言（改成错误码或结构，§8.0.1 ⑩）：`StudioSceneCatalogTest`（`INVALID` 错误码 + 素材名）、`DirectorImageModelTest`、`DirectorAssetUnlinkTest`、`DirectorLongTextTest`、`IpRunWorkerTest`、`JusuanImageClientTest`（两处）、`StudioNativeVideoProjectionTest`；跟字面改的：`DirectorImagePromptFormatTest`、`DirectorImageTemplateVersionTest`、`DirectorOwnImageTest`（staleReasons 文案）、`H3PromptRewriteTest`、`StudioVideoRewriteWorkerTest`、`VideoStudioServiceTest`。


合计 365 行、408 处（同句多处算一行）。

## 存疑项选了哪种写法

- 开通产品名：IP Studio（用户定）。授权凭证和 `DapConsentService.PLATFORMS` 没动。
- 报错里的运维指引：选第一种，用户看「XX 暂不可用，请联系平台处理」，指引进 `internalDetail`。
- 场景名「自由出图」：保留。
- 幂等类报错（「同一请求的内容已改变」「请求编号无效」等约 30 处）：统一「请求已失效，请刷新页面后重试」；消息类「消息内容已变化，请刷新后重新发送」。
- 未定价的模型：统一「此模型暂未定价，请选择其他模型」。数字资产没有模型可选，那一处写「生成服务暂不可用，请联系平台处理」。

---

# 第 8 批 · 旧手机页与画布语言包（只改扫描命中）

位置相对 `apps/web-aiavatar/src/`。

#### canvas/locales/zh-CN.ts
文件第 1 行加了注释，说明按 ui-copy 改过、合并上游时保留。

| 键 | 原文 | 改为 |
|---|---|---|
| `prompts.loading` | 加载中... | 加载中… |
| `imageWorkbench.dropReferences` | 松开即可添加参考图 | 松开以添加参考图 |
| `videoWorkbench.dropReferences` | 松开即可上传参考资产 | 松开以上传参考资产 |
| `canvas.opening` | 正在打开画布... | 正在打开画布… |
| `canvas.loading` | 正在加载画布... | 正在加载画布… |
| `canvas.plugins.interactiveTitle` | 当前：交互中。点击切回「移动」——拖动可移动节点 | 当前：交互中。点击切回「移动」后可拖动节点 |
| `canvas.plugins.movableTitle` | 当前：可移动。点击切到「交互」——可操作节点内容（如转动全景） | 当前：可移动。点击切到「交互」后可操作节点内容（如转动全景） |
| `canvas.generation.interrupted` | 上次没跑完就离开了。它可能根本没发出去，也可能已经在服务端跑过并扣过费 —— 重新生成前建议先看一眼积分明细。 | 上次生成未完成。任务可能未提交，也可能已在服务端执行并扣除积分。重新生成前，请先查看积分明细。 |
| `version.checking` | 检查中... | 检查中… |
| `config…proxy.channelHint` | …关闭开关即可恢复直连。 | …关闭开关后恢复直连。 |
| `config…webdav.directory` | 远程目录 | 远程文件夹 |
| `config…webdav.directoryDescription` | 会在该目录下分业务目录保存，每个目录包含 {{manifest}} 和 files/ | 将在此文件夹下按业务分文件夹保存，每个文件夹包含 {{manifest}} 和 files/ |
| `config…webdav.errors.directoryFailed` | 创建 WebDAV 远程目录失败 | 创建 WebDAV 远程文件夹失败 |
| `config…webdav.errors.pathMissing` | WebDAV 路径不存在，请检查地址和远程目录 | WebDAV 路径不存在，请检查地址和远程文件夹 |
| `agent.history.defaultWorkspace` | 默认画布目录 | 默认画布文件夹 |
| `agent.panel.mcpInitializing` | MCP 初始化中，完成后即可发送 | MCP 初始化中，完成后可发送 |
| `agent.events.workingDirectory` | 工作目录 | 工作文件夹 |
| `agent.eventMore.thinking` | 正在思考... | 正在思考… |
| `agent.eventMore.operationRunning` | {{operation}}正在进行... | {{operation}}进行中… |
| `agent.eventMore.organizingCanvas` | 画布已读取，Codex 正在整理结果... | 画布已读取，Codex 正在整理结果… |
| `agent.eventMore.operationCompleted` | {{operation}}已完成，Codex 正在继续处理... | {{operation}}已完成，Codex 正在继续处理… |

上面 21 条里，只有 `canvas.generation.interrupted` 在代码里有引用（`canvas/lib/canvas/canvas-generation-helpers.ts`，只写进 `errorDetails`，没有拿它做比较）。其余 20 个键在 `canvas`、`canvas-bridge`、`ip`、`shell`、`app` 里都搜不到引用，是搬画布时留下的，用户现在看不到。

#### proto
| 位置 | 原文 | 改为 |
|---|---|---|
| `proto/api.ts:928`（mock） | t: "今天 11:20" | t: "2026-08-30 11:20:00" |
| `proto/api.ts:929`（mock） | t: "昨天 15:30" | t: "2026-08-29 15:30:00" |
| `proto/asset-create.tsx:29` | 先选类型，再选来源 —— 实拍上传与 AI 生成两条路径并重。 | 选择资产类型和来源，支持实拍上传和 AI 生成。 |
| `proto/asset-create.tsx:89` | 描述一个空间 —— 生成的是不含人物的场景板，合成时人物才会站进去。 | 描述一个空间，生成不含人物的场景板，人物在合成时加入。 |
| `proto/asset-create.tsx:90` | 描述一件商品 —— 生成纯净底的产品主图，方便后续抠图与合成。 | 描述一件商品，生成纯净底的产品主图，便于后续抠图与合成。 |
| `proto/asset-create.tsx:137` | IP 是容器 —— 建好后把人物 / 场景 / 产品收拢进来，就能整体授权、整体合成。 | 将人物、场景和产品归入同一个 IP，可整体授权、整体合成。 |
| `proto/beauty/studio.tsx:289` | 当前为标准示意图，生成定妆形象后即可精调真实照片 | 当前为标准示意图，生成定妆形象后可精调真实照片 |
| `proto/screen-assets.tsx:246` | IP 是容器 —— 把人物 / 场景 / 产品收拢成一个可授权的整体 | 将人物、场景和产品归入同一个 IP，作为整体授权。 |
| `proto/screen-compose.tsx:358` | 正在出片，稍后回来查看 | 可稍后返回查看结果 |
| `proto/screen-home.tsx:119` | 约 15 秒即可生成第一版形象 | 生成第一版形象后，可继续精调 |
| `proto/screen-home.tsx:294` | 实拍入库，登记即可用 | 实拍入库，登记后可用 |
| `proto/screen-ip.tsx:269` | 六类资产里只有真人肖像与 IP 需要授权 —— 登记后会生成 LIC 凭证，合成出片时自动核验。 | 六类资产中，只有真人肖像和 IP 需要授权。登记后将生成授权凭证，合成时自动核验。 |
| `proto/screen-library.tsx:414` | 广场公开形象 · 只读展示。「另存为我的数字人」后即可自由改名、迭代与生成衍生。 | 广场公开形象，仅供查看。点击「另存为我的数字人」后，可改名、迭代和生成衍生内容。 |
| `proto/screen-library.tsx:670`（代码注释） | 「更新」是文案（如 "2 小时前"） | 「更新」是时间串（yyyy-MM-dd HH:mm:ss） |
| `proto/screen-library.tsx:753` | 正在出图… | 生成中… |
| `proto/screen-library.tsx:908` | 从定妆形象生成标准图集，或生成表情 / 场景 / 换装 / 3D / 运镜视频等衍生资产 —— 生成的内容都会沉淀在这里。 | 从定妆形象生成标准图集，或生成表情、场景、换装、3D、运镜视频等衍生资产。生成的内容都保存在这里。 |
| `proto/screen-lictaskme.tsx:144` | 上传图片或视频，完成人脸确认与逐条审核后即可在视频生成时选择 | 上传图片或视频，完成人脸确认与逐条审核后，可在生成视频时选择 |
| `proto/screen-more.tsx:380` | 配音 TTS 合成能力上线后即可直接使用；当前试听为原始采样。 | 配音合成功能上线后可直接使用。当前试听为原始音频。 |
| `proto/screen-product.tsx:37` | 锁同一件商品，只换机位 —— 角度越全，合成时越好用。 | 同一件商品，只更换机位。角度越全，合成时选择越多。 |
| `proto/screen-real.tsx:121` | 正对镜头，跟随箭头缓慢左右转头即可。素材只用于… | 正对镜头，跟随箭头缓慢左右转头。素材只用于… |
| `proto/screen-real.tsx:140` | 无需朗读台词：跟随屏幕箭头先正对镜头、再缓慢左右转头，约 {REC_SECONDS} 秒即可完成。 | 无需朗读台词：跟随屏幕箭头正对镜头，然后缓慢左右转头，约 {REC_SECONDS} 秒完成。 |
| `proto/screen-real.tsx:318` | 最后一步！ | 最后一步 |
| `proto/screen-real.tsx:540` | 真人授权已完成！ | 真人授权已完成 |
| `proto/screen-real.tsx:540` | 你的数字人已就绪！ | 你的数字人已就绪 |
| `proto/screen-scene.tsx:33` | 同一空间、同一机位，只换光线 —— 生成后可直接用于合成。 | 同一空间、同一机位，只更换光线。生成后可直接用于合成。 |
| `proto/screen-voiceapps.tsx:140` | 录 10 秒即可克隆你的声音 | 录制 10 秒音频，克隆你的声音 |

## 存疑项选了哪种写法

- **约 15 秒**：去掉了时长。`proto`、`PRODUCT.md`、`README.md`、`product_spec.md`、服务端 dap 域都没有依据，而且同一条创建流程的等待页 `screen-aicreate.tsx:284` 写的是「约需 30–60 秒」，和这句对不上。
- **screen-compose「正在出片」**：左边紧挨徽标「合成中」，再写「生成中」就重复了，所以只留「可稍后返回查看结果」。
- **LIC 凭证**：改成「授权凭证」。LIC 是登记前缀。
- **mock 时间**：用 `2026-08-30` 和 `2026-08-29`，形状同服务端 `DapSupport.dateTimeZh`（`yyyy-MM-dd HH:mm:ss`）。比所有 mock 的 `updated`（最早 `2026-08-31`）都早，版本顺序不会倒。
- **工作目录**：改成「工作文件夹」。键没有引用，只为扫描干净、和 WebDAV 同一口径。

## 第 9 批：删多余说明（2026-11-07）

已上线：PR 153（`2d9d15bef`，CI 8 项全绿）随另一个会话的 `20261107-h3-rewrite-checks`（main `6a9a459cd`，10:50 CST）发布，没有单独发版，发布窗口见[那次的记录](../releases/h3-rewrite-checks-release-20261107.md)。

线上只读验收（没有发起生成）：口播带货按钮是划掉 930、折后 465 积分，悬停显示「H3限时折扣，省 465 积分」，按钮下只有「请添加商品图」和「优化提示词按实际用量另计。」；爆款复刻是「约 1,606 积分」和「按实际用量结算，最多 4,818 积分。」；AI 图片显示「自由生成」，项目页显示「点击画布继续编辑」；发布包里没有「本次上限」。线上没有看长视频的价格说明（要改时长，这次不动账号数据），只有单测。

用户点名 AI 视频页按钮下那段「H3限时折扣，省 465 积分。优化提示词按实际用量另计。按实际完成的内容结算，本次上限 3,120 积分。」，要求全站同类一起改。

判断标准：只留界面上看不出来、又会影响用户决定的事。删掉四类：按钮和标签已经说明的、解释内部机制的、给人宽心但不影响决定的、空泛的句子。规则写进 AGENTS.md §8 和 `ui-copy`，§9 1b 加了门禁。

计费核对：普通视频失败重试时，每次尝试都会重新走优化提示词，这部分按实际用量算；视频费失败时退回。所以「优化提示词按实际用量另计」成立，3,120 这个上限（预估费用的 3 倍，按原价算）不是用户会花的钱。后台上限照旧生效，只是普通视频不再显示。

| 位置 | 原文 | 改为 |
|---|---|---|
| `canvas-bridge/studio-video-price.ts` | H3限时折扣，省 465 积分。优化提示词按实际用量另计。 / …生成时选择付款账户，模型赠款在付款时抵扣。 | 优化提示词按实际用量另计。（折扣放价格的悬停提示） |
| `ip/scenes/scene-video-studio.tsx` | 按实际完成的内容结算，本次上限 3,120 积分。（普通视频） | （删除，普通视频价格确定） |
| `ip/scenes/scene-video-studio.tsx` | 按实际完成的内容结算，本次上限 X 积分。（爆款复刻） | 按实际用量结算，最多 X 积分。 |
| `ip/scenes/scene-video-studio.tsx` | 视频 X 积分，分镜图 N 张 Y 积分，写脚本、审核和优化提示词按实际用量结算，分镜图优惠和模型赠款在执行时抵扣。 | 视频 X 积分，分镜图 Y 积分，其余按实际用量结算，最多 Z 积分。 |
| `ip/scenes/scene-video-studio.tsx` | 生成前按此模型的写法优化提示词。优化提示词按实际用量另计，不含在视频费用中。 / 按原文生成，只收取视频费用。 | 按此模型的写法优化提示词，按实际用量另计。（选按原文生成时不显示） |
| `ip/studio-billing-dialog.tsx` | 下一步确认折扣、模型赠款抵扣和应付积分。 / 按实际用量结算，完成后显示实际消耗积分。 / 按当前模型与生成参数结算。 | 下一步确认应付积分。 / 按实际用量结算。 /（删除） |
| `ip/studio-billing-dialog.tsx` | 本次提交后付款账户固定；重试和失败退款均沿用原账户。 | （删除） |
| `ip/director/director-assistant.tsx` | 分镜图提示词会按新镜头自动更新。 / 视频提示词会按新镜头自动更新。 / 已有的分镜图将标记为… / 已有的片段视频将标记为… | 只在自定义时提示不会更新；分镜图和视频合成一句「已有的分镜图和视频将标记为「需更新」，不会自动重新生成。」 |
| `ip/studio-scene-workshop.tsx` | 从这里起步，按你的想法自由创作。 / 从上次停下的地方，继续。 / 新的创作，将从这里留下第一笔。 | （删除）/ 最近编辑的画布。 / 还没有画布。 |
| `场景名（scenes.json 等）` | 自由出图 | 自由生成 |
| `ip/scenes/scene-video-studio.tsx` | describeSegmentedPrice(longShown, longPriced?.enterprise, longPriced?.undecided) | describeSegmentedPrice(longShown, longPriced?.enterprise) |
| `ip/scenes/scene-video-studio.tsx` | 脚本、分镜图、各段视频和合成将一次完成。` | 完成后自动合成。` |
| `ip/scenes/scene-video-studio.tsx` | 填写提示词后点击「生成视频」，生成的视频将显示在这里。 | 生成的视频将显示在这里。 |
| `ip/scenes/scene-video-studio.tsx` | 从资产库选择。新文件可点击「上传到资产库」，上传后自动选中，原文件不会被修改。 | 从资产库选择，也可上传新文件。 |
| `ip/scenes/scene-image-studio.tsx` | 点击「生成图片」后，生成的图片将显示在这里。 | 生成的图片将显示在这里。 |
| `ip/scenes/scene-image-studio.tsx` | 从资产库选择图片。新图片可点击「上传到资产库」，上传后自动选中，原文件不会被修改。 | 从资产库选择图片，也可上传新图片。 |
| `ip/scenes/scene-image-studio.tsx` | 添加参考图并描述想要的画面，也可点击场景名选择其他场景。 | 添加参考图并描述想要的画面。 |
| `ip/studio-billing-settings.tsx` | 修改后自动保存。图片、视频、数字人、配音等所有生成均使用此账户付款，在其他设备上同样生效。余额不足时不会自动切换账户；退出企业后将重新询问。 | 修改后自动保存。所有生成均使用此账户付款，余额不足时不会自动切换账户。 |
| `ip/studio-model-quote-dialog.tsx` | 勾选后，模型赠款不足时将停止生成，不扣除普通积分。提交时将再次核对价格与额度。 | 勾选后，模型赠款不足时将停止生成，不扣除普通积分。 |
| `ip/studio-conversation-start.tsx` | 助手回复按实际用量扣除积分；生成图片和视频前会先报价，确认后开始。也可浏览 | 助手回复按实际用量计费，生成图片和视频前会先报价。也可浏览 |
| `shell/wallet-badge.tsx` | 分配给你的企业积分（不含冻结积分），生成时可选用。点击查看企业 | 分配给你的企业积分，点击查看企业 |
| `app/me/page.tsx` | 积分暂时读不出来，查看积分 | 积分加载失败，查看积分 |
| `app/me/page.tsx` | 可用积分，不含冻结的；点击查看积分 | 可用积分，点击查看积分 |
| `ip/enterprise-management.tsx` | 仅对使用企业积分的任务生效，包括画布、导演台、数字资产和声音克隆。不影响个人积分。 | 仅对使用企业积分的任务生效，不影响个人积分。 |
| `ip/enterprise-management.tsx` | 成员使用企业积分时只能选择以上模型，后续上线的模型需手动添加。声音克隆不按模型计费，不受此限制。已排队或已提交的任务按原模型和价格结算。 | 成员使用企业积分时只能选择以上模型，后续上线的模型需手动添加。 |
| `ip/enterprise-management.tsx` | 包括排队中、生成中，以及已提交、结果待确认的任务。画布一次制作常会同时运行多项任务，上限过低时后续步骤需要等待。 | 包括排队中、生成中和结果待确认的任务。上限过低时，后续步骤需要等待。 |
| `ip/enterprise-management.tsx` | 管理员只能管理普通成员。积分相关授权不涉及成员的个人积分、素材和画布。 | 管理员只能管理普通成员。 |
| `ip/enterprise-reports.tsx` | 记录个人转入、分配和回收的积分，不计作新增充值或消费。 | 个人转入、分配和回收积分的记录。 |
| `ip/enterprise-reports.tsx` | 展示企业付款的进行中任务与实际消耗。冻结积分不计作消费，不包含个人付款或私有创作内容。 | 企业付款的任务与实际消耗。冻结积分不计作消费。 |
| `ip/enterprise-reports.tsx` | 展示本人使用企业积分的任务与实际消耗。个人积分的消费记录可在「我的账号」查看。 | 本人使用企业积分的任务与实际消耗。 |
| `ip/enterprise-workspace.tsx` | 企业积分与个人积分分开计算。回收仅针对可用余额，冻结积分仍用于原任务结算。 | 回收仅针对可用余额，冻结积分仍用于原任务结算。 |
| `ip/enterprise-workspace.tsx` | 申请将提交至平台财务，核准后积分进入「企业待分配积分」。提交申请不会直接增加积分。 | 申请将提交至平台财务，核准后积分进入「企业待分配积分」。 |
| `ip/invitation-workspace.tsx` | 朋友通过链接注册新账号后，会留下邀请记录。已有账号登录不新增记录。 | 朋友通过链接注册新账号后，会显示在这里。 |
| `ip/invitation-workspace.tsx` | 可选中链接手动复制。此链接用于注册账号，各产品的使用权限与权益需另行开通。 | 可选中链接手动复制。 |
| `ip/invitation-workspace.tsx` | 仅记录由你直接邀请注册的账号，不反映对方的开通或使用情况。 | 仅记录由你直接邀请注册的账号。 |
| `ip/invitation-workspace.tsx` | 只记录注册时的邀请关系，已有账号不会补记。更换手机号或合并账号，不会改变原有记录。 | （删除） |
| `ip/canvas-cover-editor.tsx` | 上传封面，或从画布中选择图片。恢复自动封面后，优先显示画布中的图片；没有图片时显示画布里的文字内容。 | 上传封面，或从画布中选择图片。 |
| `ip/ip-management.tsx` | 新建画布不消耗积分。生成前可在画布中确认模型、参考图和积分。 | 新建画布不消耗积分。 |
| `ip/studio-storyboard.tsx` | 查看画布中的全部节点，点击继续创作。 | 点击节点继续创作。 |
| `ip/studio-template-source.tsx` | 此画布已锁定该模板版本。按步骤生成，每步单独确认费用；上游结果采用前，依赖它的步骤不会执行。刷新可找回已提交的任务。 | 按步骤生成，每步单独确认费用。上一步的结果采用后，才能生成依赖它的步骤。 |
| `ip/studio-voice-adopt.tsx` | 将此配音的音色和风格保存为人物声音，并设为默认。试听沿用此音频，保存免费。 | 将此配音的音色和风格保存为人物声音，并设为默认。不消耗积分。 |
| `ip/assets-hub.tsx` | AI 生成的图片、视频和音频会自动保存在这里，移到其他资产库后不再显示在此处。 | AI 生成的图片、视频和音频会自动保存在这里。 |
| `ip/studio-task-list.tsx` | 任务状态自动更新，可继续在画布创作 | 任务状态自动更新 |
| `ip/studio-projects.tsx` | 每张画布都在这里，点开可继续编辑 | 点击画布继续编辑 |
| `ip/studio-recreation.tsx` | 支持 60 秒、128 MB 内的 MP4。优先读取明显画面变化前后的画面，并在较长片段中补帧；时间点为近似定位。有音轨时自动提取原声，不转写字幕。 | 支持 60 秒、128 MB 内的 MP4。有音轨时自动提取原声，不转写字幕。 |
| `ip/studio-speech.tsx` | 要调整音色或风格，请选择临时固定音色；生成满意后可保存为新声音版本。 | 要调整音色或风格，请选择临时固定音色。 |
| `ip/studio-speech.tsx` | 临时音色不会改变人物默认声音。生成满意后，选中音频并点击「设为人物声音」，保存音色、风格和真实试听。 | 临时音色不会改变人物默认声音。生成后可选中音频，点击「设为人物声音」保存。 |
| `ip/studio-speech.tsx` | 指定人物与声音版本，为台词或商品介绍生成配音。音频会保存在当前画布，可试听、下载并用于成片。 | 为台词或商品介绍生成配音，音频保存在当前画布。 |
| `ip/studio-lip-sync.tsx` | 选择画布中的单人视频和配音，让人物按此音频说话。结果另存为新片段，原视频仍可使用。 | 选择画布中的单人视频和配音，生成口型同步的新片段，原视频保留。 |
| `ip/studio-assistant.tsx` | 可以修改后发送。需要生成时，助手会先说明所需积分。 | 可修改后发送。 |
| `ip/studio-assistant-starters.tsx` | 你已手动修改提示词，切换选项不会覆盖。点击「按选项重写」可使用当前选择。 | 提示词已手动修改，切换选项不会覆盖。 |
| `ip/studio-assistant-starters.tsx` | 完整提示词已填入下方输入框，包含人物特征、风格、版式和需要避免的内容，可直接发送或修改。 | 提示词已填入下方输入框，可修改后发送。 |
| `ip/studio-canvas-guide.tsx` | 向助手描述需求，助手会把每一步放进画布。也可以从下方选择： | 向助手描述需求，或从下方选择： |
| `ip/studio-assistant-plan.tsx` | 采用后写回原节点，保留素材和连线，不启动生成、不另扣积分。 | 采用后写回原节点，不另扣积分。 |
| `ip/studio-assistant-plan.tsx` | 采用文字无需再次生成，不另扣积分。 | 采用不另扣积分。 |
| `ip/studio-video-controls.tsx` | 留空让每次生成有所变化；固定数值有助于复现相近结果，效果也受提示词、素材和模型影响。 | 留空则每次生成不同；固定数值可复现相近结果。 |
| `ip/studio-video-controls.tsx` | 第一条使用此种子，后续结果依次递增；超过上限从 0 继续。 | 第一条使用此种子，后续依次递增。 |
| `ip/studio-work-editor.tsx` | 品牌和标题显示在画面左上角，结尾提示显示在底部，全片持续显示。预览中的位置仅供参考，以合成后的成片为准。 | 品牌和标题显示在左上角，结尾提示显示在底部，实际位置以成片为准。 |
| `ip/studio-workspace.tsx` | 口型片段已提取，原始对照视频保留在版本中，未额外扣除积分。 | 口型片段已提取，未额外扣除积分。 |
| `ip/studio-workspace.tsx` | 模型按设置生成视频，描述中的规格不会自动生效。修改设置后费用可能变化，确认前会显示新费用。 | 模型按设置生成视频，描述中的规格不会自动生效。 |
| `ip/studio-workspace.tsx` | 此处保留提交时的输入快照。 | 此处显示提交时的内容。 |
| `ip/studio-workspace.tsx` | 本次采用人物视频与配音驱动，具体素材和时长保存在下方快照中。 | 本次由人物视频和配音生成，素材和时长见下方。 |
| `ip/director/director-asset-studio.tsx` | 不会替换当前资产图。如需按参考图生成新版本，请点击上方「重新生成」。 | 不会替换当前资产图，点击「重新生成」时将参照此图。 |
| `ip/director/director-asset-studio.tsx` | 上传后不会立即生成。点击上方「生成资产图」时将参照此图。 | 点击「生成资产图」时将参照此图。 |
| `ip/director/director-asset-studio.tsx` | 上传不会替换当前资产图，也不会自动生成，不消耗积分。 | 不会替换当前资产图，不消耗积分。 |
| `ip/director/director-assistant.tsx` | 选中正文，或点击镜头、图片旁的「AI」按钮，指定要修改的内容。讨论时只给出分析和方向，你明确要求修改后才给出修改建议，采用前可先对比。 | 选中正文，或点击镜头、图片旁的「AI」按钮，指定要修改的内容。采用建议前可先对比。 |
| `ip/director/director-rewrite.tsx` | AI 按本集正文重写此片段的镜头，分镜图提示词和视频提示词随之更新；此片段在本集中的位置和剧情不变。 | AI 按本集正文重写此片段的镜头和提示词，位置和剧情不变。 |
| `ip/director/director-rewrite.tsx` | 已有的分镜图和视频保留在历史版本中，将标记为「需更新」，是否重新生成由你决定。 | 已有的分镜图和视频保留在历史版本中，将标记为「需更新」。 |
| `ip/director/director-rewrite.tsx` | AI 按本集正文重写镜头，各片段的分镜图提示词和视频提示词随之更新。只修改文字，不生成图片和视频，其他集不受影响。如只需重写某个片段，请关闭此窗口，在该片段上点击「重写」。 | AI 按本集正文重写镜头和提示词，不生成图片和视频，其他集不受影响。 |
| `ip/director/director-script-file.tsx` | 免费提取文字，预览后导入正文。网页文件仅提取正文，不运行其中的脚本；扫描版 PDF 请先识别文字。 | 免费提取文字，预览后导入正文。扫描版 PDF 请先识别文字。 |
| `ip/director/director-script.tsx` | 从拆分剧本开始自动完成至成片，也可只完成至分镜脚本或分镜图。开始前显示推荐预算，确认后执行。 | 自动完成至成片，开始前显示推荐预算。 |
| `ip/director/director-script.tsx` | 自动完成后续步骤至成片，也可只完成至分镜脚本或分镜图。开始前显示推荐预算，确认后执行。 | 自动完成后续步骤至成片，开始前显示推荐预算。 |
| `ip/director/director-script.tsx` | 第 1 集之前的内容保存为设定资料。拆分结果确认后生效。 | 第 1 集之前的内容保存为设定资料。 |
| `ip/director/director-script.tsx` | 支持两种拆分方式：已分好集的剧本按分集标题拆分，不消耗积分，不限集数；尚未分集的剧本由 AI 按剧情拆分，按实际用量结算。两种方式均不修改正文，拆分结果确认后生效。 | 已分好集的剧本按分集标题拆分，不消耗积分；尚未分集的由 AI 按剧情拆分，按实际用量结算。均不修改正文。 |
| `ip/director/director-script.tsx` | 请在「资产」为角色、场景和道具生成资产图，分镜图和视频将以此为参考。修改正文后可重新提取，同一人物不会重复创建。 | 请在「资产」生成资产图，分镜图和视频将以此为参考。 |
| `ip/director/director-script.tsx` | AI 从全部集中识别角色、场景和道具，清单经你确认后保存。之后生成资产图、写分镜脚本，每一步都可检查和修改。 | AI 从全部集中识别角色、场景和道具，清单经你确认后保存。 |
| `ip/director/director-script.tsx` | 从全部集中提取角色、场景和道具，同一人物不会在各集重复出现 | 从全部集中提取角色、场景和道具 |
| `ip/director/director-storyboard.tsx` | 将本集正文切分为视频片段，写出每个镜头及每段的分镜图提示词和视频提示词。 | 将本集正文切分为视频片段，写出每段的镜头和提示词。 |
| `ip/director/director-storyboard.tsx` | 片段划分不变，逐段重写镜头，分镜图提示词和视频提示词随之更新，不生成图片和视频。 | 片段划分不变，逐段重写镜头和提示词，不生成图片和视频。 |
| `ip/director/director-storyboard.tsx` | 分镜脚本会将本集切分为若干片段，每段包含镜头、分镜图提示词和视频提示词，一段对应一条视频。写分镜脚本前，请在「资产」准备角色、场景和道具。 | 分镜脚本将本集切分为若干片段，一段对应一条视频。写分镜脚本前，请在「资产」准备角色、场景和道具。 |
| `ip/director/director-storyboard.tsx` | 完成后此片段的镜头、分镜图提示词和视频提示词将自动更新，不生成图片和视频。 | 完成后此片段的镜头和提示词将自动更新，不生成图片和视频。 |
| `ip/director/director-storyboard.tsx` | 生成视频前，将先把提示词改写为 H3 官方要求的英文格式（台词保留中文原文）。优化提示词按实际用量另计。 | 生成视频前按 H3 写法优化提示词，按实际用量另计。 |
| `ip/director/director-workbench.tsx` | 已停止后续处理。已提交给模型的请求正在等待用量结算，将按实际用量计费。 | 已停止。已提交给模型的请求按实际用量计费。 |
| `ip/director/director-workbench.tsx` | 快捷方式：从剧本自动制作到成片（也可只制作到分镜脚本或分镜图），在后台执行，关闭页面不影响进行。如需逐步检查，请按剧本页的步骤操作。 | 从剧本自动制作到成片，在后台执行，关闭页面不影响进行。 |
| `ip/director/director-workbench.tsx` | 一键制作只补充未完成的步骤，不会重写已有的分镜脚本；如需重写，请在「分镜」点击「重写分镜脚本」（整集），或在片段上点击「重写」（单段）。 | 一键制作只补充未完成的步骤；如需重写，请在「分镜」点击「重写分镜脚本」。 |
| `ip/director/director-workbench.tsx` | 这是快捷方式，将自动连续完成后续步骤。如需逐步检查和修改，请关闭此窗口，按剧本页的步骤操作。 | 将自动连续完成后续步骤。如需逐步检查和修改，请关闭此窗口，按剧本页的步骤操作。 |

## 第 10 批：技能改版后补扫的漏改（2026-11-07）

`ui-copy` 技能改版成通用的 `wenan`，本仓规则放进 [`docs/wenan.md`](../wenan.md)，叫法表进了扫描。第一次用新扫描，查出旧脚本没抓到的这些。

| 位置 | 原文 | 改为 |
|---|---|---|
| `app/me/page.tsx` | 回到竖排界面 | 返回竖排界面 |
| `app/me/page.tsx` | 写剧本、拆分镜、出片 | 写剧本、拆分镜、生成视频 |
| `components/hub/create-center.tsx` | 合成出片 / 用资产出片 / 出片时搭配使用 | 合成成片 / 用资产生成视频 / 生成视频时搭配使用 |
| `components/hub/landing.tsx` | 之后拍短剧、做音乐、带货出片，直接拿来用。 | 之后制作短剧、音乐和带货视频时直接使用。 |
| `components/hub/landing.tsx` | 没有有效授权，出片这一步就走不下去。 | 没有有效授权，无法生成视频。 |
| `components/hub/ui.tsx` | 选个场景，编导先写分镜再出片 | 选择场景，编导写好分镜后生成视频 |
| `components/hub/ui.tsx` | 选个场景，补一句要求就出图 | 选择场景，填写要求后生成图片 |
| `ip/canvas-gate.tsx` | 只是想看看效果、改一句提示词重跑一次的话，手机上也能做。 | 如只需查看效果或修改提示词后重新生成，手机上也可以操作。 |
| `canvas-bridge/studio-task-status.ts` | 正在读取视频画面 / 正在逐段读取画面 | 正在分析视频画面 / 正在逐段分析画面 |
| `ip/studio-scene-workshop.tsx` | 正在读取… | 正在加载… |
| `canvas/locales/zh-CN.ts` | 出图 / 出片 / 收藏稳定出图的提示词 / 正在读取 / 重新读取 / 再回到网页里 | 生成图片 / 生成视频 / 收藏效果稳定的提示词 / 正在加载 / 重新加载 / 再返回网页 |
| `EnterpriseRechargeService` | 原充值积分仍有在途任务 | 原充值积分仍有进行中的任务 |
| `StudioPlanExecutionControl` | 积分，在途 N 积分 | 积分，进行中 N 积分 |
| `StudioPlanExecutionService` | 请在画布中查看… / 超出本次上限 | 请在画布上查看… / 超出上限 |
| `IpRunService` / `IpRunWorker`（积分流水说明） | 画布出图 × N / IP 形象出图 · 第 N 张 | 画布生成图片 × N / IP 形象生成图片 · 第 N 张 |

「出图提示词」「出图描述」保留：它们是导演台和提示词库共用的名词，不是按钮，提示词库也在用，改了要连提示词版本一起动。放行写在项目规则里。

## 第 11 批：模型报错与兜底（2026-11-07 用户反馈）

用 `wenan` 审过：说清发生了什么和下一步，不写厂商的话和内部状态。

| 位置 | 原文 | 改为 |
|---|---|---|
| `StudioPlanExecutionService` | 原任务的提交结果尚未确认，不能重复生成。请先确认原任务 | 已结束的任务不再拦；还在进行时：这一步正在生成，请等待完成后重试。 |
| `PublicModelErrorPolicy` / `public-model-error.ts` | 生成服务暂时不可用，请稍后再试或联系平台处理。 | 生成服务暂时不可用，请稍后重试。 |
| 同上 | 生成服务未能完成这次请求，请稍后再试或换一个模型。 | 生成服务未能完成本次请求，请重试或更换模型。 |
| `JusuanImageClient` | 图片生成服务返回错误（400） / 图片生成服务返回错误，未提供具体原因 / 生成服务未返回图片，请重试；多次出现请联系平台处理 | 图片生成失败，未生成的图片不扣积分。请重新生成。 |
| `JusuanImageClient` | 图片生成服务返回错误：原因 | 图片生成失败：原因 |
| `MaterialVideoWorker` | 视频生成失败，模型没有给出原因 / 视频模型报告已完成，但没有交回成片 | 视频生成失败，未生成的视频不扣积分。请重新生成。 |
| `MaterialVideoWorker` | 成片已经生成，但平台存储还没配置好，暂时取不回来，请联系运营 / VIDEO_MIRROR_FAILED：视频生成好了，但…… | 视频保存失败，未保存的视频不扣积分。请重新生成。 |
| `VideoProviderErrorMapper` | （供应商内部错误，没有单独说法） | 模型服务临时出错，未生成的视频不扣积分。请重新生成。 |
| `studio-errors.tsx` | 请根据上述原因处理。原因不明确或多次出现时，可复制「错误详情」反馈给我们。 | 原因说到能改的内容：请根据上述原因调整后重试。其余：请重试。多次失败时，可复制「错误详情」反馈给我们。 |
| `studio-errors.tsx`（制作状态变化） | 此内容已在其他地方修改…… | 请刷新页面后重试。多次失败时，可复制「错误详情」反馈给我们。 |
| `scene-layout.tsx` | 生成失败，未生成的 X 不扣积分。 | 生成失败，未生成的 X 不扣积分。请点击「重新生成」。 |
| `packages/api-client/_client.ts` | 服务器处理请求失败（HTTP 502） / 请求失败（HTTP 400） / HTTP 504 | 服务暂时不可用，请稍后重试。 / 请求没有完成，请重试。 |
| `packages/api-client/_client.ts` | Response envelope missing success:true / 服务返回了无法识别的响应，请稍后再试或联系平台处理。 | 服务返回了无法识别的响应，请稍后重试。 |
| `ip/api/ip-studio.ts` | 素材加载失败（HTTP 403） | 素材加载失败，请重试。 |
| `studio-errors.tsx`（没有错误码的英文，如 Failed to fetch） | 原文 | 操作未完成，请重试 / 网络连接中断，未收到服务器响应。 |
| 画布左上角、手机提示页 | ← 项目 / ← AI 视频 | ← 返回项目 / ← 返回 AI 视频 |

没改的：真人参考图那句（用户定素材库后再看）；`SUPPLIER_STORAGE_FULL`（口吻偏长，「存储空间满」还被 `GenerationSubmissionFailure` 当判断用，要改得两边一起动）。

