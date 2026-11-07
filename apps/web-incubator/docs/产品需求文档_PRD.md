# AI Star Eco · 全平台产品需求文档（PRD）

> 版本：v1.0 · 日期：2026-10-10
> 范围：整个平台（门户、生态创业者/MCN 工作台、明星 IP 端、品牌方、粉丝端、小程序、市场、计费、培训）
> 关联文档：`产品文档.md`（明星端工作台 v3.0 详细设计）
> 说明：本文依据当前前端代码整理。当前版本为**纯前端原型**，所有数据为 Mock 常量，无后端鉴权与规则校验；文末列出“待实现 / 待对齐”事项。

---

## 一、产品概述

### 1.1 产品定位
AI Star Eco 是一个 **AI 艺人孵化 + 明星 IP 授权商业化** 平台。平台把明星的肖像、声纹、切片素材、数字人等 IP 资产，以可控、可审、可追溯的方式授权给生态创业者（MCN / 带货创业者），用于孵化 AI 艺人、运营账号矩阵、内容分发和带货变现，并在多方之间自动分账。

### 1.2 业务闭环
```
明星授权 IP / 切片
   → 创业者订阅套餐、培训认证（获得分区操作资格）
   → 孵化 AI 艺人 / 申请明星授权 / 账号报白
   → 内容制作 → 审核 → 发布 → 投流
   → 带货 GMV / 音乐 / NFT 收益
   → 平台 · 运营者 · 明星 · MCN 分账结算
```

### 1.3 角色
| 角色 | 入口 | 核心诉求 |
|---|---|---|
| 生态创业者 / MCN / 制作人 | 门户 → 登录 → 介绍页 → `MCNConsole`（operator） | 孵化 AI 艺人、运营账号、生产内容、变现 |
| 明星 IP（本人 / 经纪团队） | 门户 → `MCNConsole`（celebrity） | 资产托管、授权审核、风控、分成 |
| 品牌方 | 控制台内角色切换 → `BrandPortal` | 匹配艺人、议价、寄样、看 ROI |
| 粉丝 | 门户 → `FanAppFull` | 发现艺人、听歌、打榜、收藏 NFT |
| 带货创业者（小程序） | 门户 → `EntrepreneurMiniApp` | 领取选品任务、赚佣金 |
| 切片创作者（小程序） | 门户 → `ClipMiniApp` | 使用明星切片做内容、接品牌任务 |

---

## 二、信息架构与入口

### 2.1 页面流转（`App.tsx`，`page` 状态驱动）
- `home`：首页，两个版本（`NewLandingPage` / 原版 `HomePage`），右下角可切换。
- `portal`：角色选择页，5 个入口：`producer_login`、`fan`、`celebrity_ip`、`miniapp_entrepreneur`、`miniapp_clip`。
- `producer_login` → `LoginPage` → `producer_intro`（Producer Program 2.0 介绍）→ `producer_app`。
- 全局：中英双语（`zh` / `en`），多主题（`ThemeProvider`）。

### 2.2 控制台角色切换
`MCNConsole` 内悬浮按钮 `RoleSwitcherFAB` 切换 `operator | celebrity | brand` 三种角色。

---

## 三、生态创业者 / MCN 工作台

### 3.1 导航
| 分组 | 菜单 | 说明 |
|---|---|---|
| 总览 | 工作台 `overview` | KPI（生态价值、收入、持有者、播放、粉丝）、收益趋势、内容类型分布、快捷入口 |
| 我的 IP | AI 艺人孵化 `artist_hub` | 艺人矩阵 + 7 步孵化向导 |
| | 培训认证 `training` | 合规分区资格认证 |
| 内容制作 | 素材中心 `asset_center` | 素材、文案、切片资产库 |
| | 制作工坊 `production_workshop` | 音乐 / 影视 / 代言 / 综艺 四领域制作 |
| | 内容库 `studio` | 作品管理（Published / Draft / Review） |
| 账号与发布 | 账号矩阵 `account_mgmt` | 绑定、报白、冷启动 |
| | 发布中心 `publish_center` | 发布池、内容日历 |
| | 投流管理 `traffic_boost` | 品牌投流 / 自投 / 平台扶持 |
| 数据与变现 | 数据看板 `analytics` | 内容效能、授权链健康、收益溯源 |
| | 变现中心 `monetization_center` | 带货、品牌合作、版权 |
| | 收益管理 `revenue_split` | 分成配置与结算 |
| 粉丝运营 | `fan_operations` | 社群与私域运营 |
| 合规工具 | `compliance_tools` | 授权台账、水印、侵权巡查、权限矩阵、内容审核 |

### 3.2 AI 艺人孵化
**艺人矩阵（MCNMatrix）**
- 筛选模式：双维度 / 职业主导 / 多标签；卡片密度：紧凑 / 默认 / 大图。
- 卡片可直达制作工坊四领域：`music | film | endorsement | variety`。

**孵化向导（IncubationWizard，7 步）**
| 步骤 | 内容 |
|---|---|
| 01 基础设定 | 名称、类型、风格、职业背景、MBTI |
| 02 外观 | AppearanceForge 捏脸（下颌线、颧骨等参数） |
| 03 个性光谱 | 性格维度 |
| 04 专属特质 | 标志性特征 |
| 05 技能树 | SkillTreePanel |
| 06 粉丝商业 | 应援色（必填）、商业定位 |
| 07 预览 | 汇总，触发出道仪式 DebutCeremony |

- 支持一键随机生成；配套 AI 顾问（WizardAIAdvisor）与内联对话。
- 完成度 = 前 6 步完成数；预览步始终可进入。

**艺人详情（ArtistDetailTabs）**：多平台账号表（粉丝、7 日增长、互动率、30 天曝光、状态），支持公域 / 私域（企业微信、微信群）筛选。

### 3.3 账号矩阵（AccountManagementCenter）
- Tab：账号列表 / 报白状态 / 冷启动服务。
- 平台：抖音、快手、小红书、视频号、B 站。
- 报白按“账号 × 明星”逐一申请，状态：`unsubmitted → pending → approved / rejected / supplementing`。
- 示例规则：账号粉丝 > 50 万；需补 MCN 机构授权证明。

### 3.4 投流管理（TrafficBoostCenter）
- 类型：`brand` 品牌投流、`self` 自投、`platform` 平台扶持（AI 识别优质内容免费给量）。
- 字段：预算、已花费、播放、GMV 增量、ROI；目标 `gmv | views | fans`。
- 状态：`active | completed | paused | pending`。
- **规则**：投流视频须关联有效授权（`licenseId`）；授权过期则投流自动暂停。

### 3.5 数据看板（DataAnalytics）
- 内容效能：GMV / 播放 / 粉丝趋势、账号 GMV 排行、平台分布。
- 授权链健康：雷达图（授权覆盖、时效、合规等）。
- 收益溯源：授权收益 vs 无授权收益对比。

### 3.6 制作与发行
- **音乐**：AI 生成音乐（`input → generating → preview → success`，结果存草稿）；单曲 / 专辑、演唱会售票。
- **影视**：角色、配音（动画 / 纪录片 / 有声书）、广告代言（CPM）。
- **发行**（DistributionPage）：`Published | Draft | Processing`，首发 / 再发行；播放激励约 ¥30–80 / 万次。
- **NFT 铸造**：`config → wallet → minting → success`，默认 0.05 ETH，版税 10%。
- **通告板**（NoticeBoard）：音乐 / 影视 / 综艺 / 广告 / 配音 / 舞台通告，按艺人等级与天赋门槛接单，获得奖励。

### 3.7 打榜宣发（MatrixWorkbench）
- Tab：总览 / 活动 / 账号 / 排期；平台抖音 / 快手 / 小红书。
- 活动状态：`draft | scheduled | active | ended`；含直播中控 LiveControlRoom。

---

## 四、明星 IP 端

> 详细设计见 `产品文档.md`，此处为摘要与补充。

### 4.1 导航（13 项，侧栏分组）
总览、IP 授权中心、报白账号、数字人授权、AI 形象授权、内容审核、商品入库、商品库、品牌授权、分成收益、授权规则、侵权巡查、合同中心。菜单带待办数角标。

### 4.2 核心流程
| 模块 | 流程 / 状态 |
|---|---|
| IP 授权（肖像 / 切片 / 数字人 / 证件） | 上传 → … → 火山引擎激活（6 状态） |
| 报白审核 | 开始联系平台 → 等待验证码 → 达人确认 → 授权成功 → 完成（5 步） |
| 数字人 / AI 形象审核 | 按用途与风险等级审核，可附风险备注、AI 厂商 |
| 内容审核 | 切片 / 数字人 / AI 形象视频 |
| 商品入库 | 6 步；明星与平台双寄样通过后自动入商品库 |
| 品牌授权 | `pending → platformReview → celebReview → sampleStage → approved / rejected` |
| 侵权巡查 | `pending → investigating → confirmed → resolved`，严重度高 / 中 / 低 |
| 合同中心 | 授权合同 / 补充协议 / 结算单；`active / pending / expired / terminated` |

### 4.3 风险分区（全平台统一语言）
| 分区 | 规则 |
|---|---|
| 绿区 | 官方切片可直接使用 |
| 黄区 | 可加 AI 字幕、剪辑重组，需声明 AI 辅助 |
| 橙区 | AI 语音合成需另签协议，相似度 < 80%，默认关闭 |
| 红区 | AI 形象虚拟创作禁用，需专属授权包方可开启 |

培训认证与分区资格挂钩（见第八章）。

---

## 五、品牌方门户（BrandPortal）
- 导航：总览 / 艺人匹配 / 爆款视频 / 议价 / 寄样 / ROI。
- 艺人匹配：等级 S/A、匹配分、转化率、历史 GMV、独家月数、可合作状态。
- 爆款视频：标记可投流，平台抖音 / 快手 / 小红书。
- 议价：`open → counter → accepted / rejected`（我方出价 vs 对方报价）。
- 寄样：`requested → shipping → delivered`，带物流单号。

---

## 六、市场

### 6.1 AI 艺人交易市场（ArtistMarket）
- 专区：热门签约、新人特卖、传奇拍场、限时闪签、联合孵化、我的委托。
- 签约方式：全权签约 / 分成签约（卖方保留比例可调）/ 借调（7 / 14 / 30 天，到期归还）/ 联合孵化。
- 售卖方式：固定价 / 拍卖（出价须高于当前价）/ 议价（可还价）。
- 品质：普通 / 稀有 / 史诗 / 传奇。
- 交易：`idle → confirm → processing → success`，确认后不可撤销；余额不足禁用。虚拟币 SC。
- 挂单向导：选艺人 → 签约方式 → 售卖方式 → 价格 / 分成 / 借调天数 / 独家 → 发布。
- 签约分成：签约方 70% / 原创者 30%；挂单：卖家 80% / 平台服务费 20%。

### 6.2 明星签约中心（CelebritySigningCenter）
明星分级：

| 等级 | 价格 | 粉丝门槛 |
|---|---|---|
| S | ¥9,999 | > 1 亿 |
| A | ¥4,999 | 3000 万 – 1 亿 |
| B | ¥1,999 | 500 万 – 3000 万 |
| C | ¥599 | < 500 万 / 新人 |

授权申请流程：`选择明星 → 选择账号 → 选择套餐 → 支付 → 完成`。

| 授权类型 | 基础 | 专业（推荐） | 旗舰（含独家定制） |
|---|---|---|---|
| 切片带货（需完成约 30 分钟培训） | 50 条 ¥9,800 / 1 账号 | 100 条 ¥16,800 / 3 账号 | 200 条 ¥29,800 / 5 账号 |
| AI 形象 | ¥12,800 / 1 账号 | ¥28,800 / 3 账号 | ¥58,800 / 5 账号 |
| AI 数字人 | ¥38,800 / 1 账号 | ¥78,800 / 3 账号 | ¥158,000 / 5 账号 |

已授权明星显示：授权账号数、到期日、用量（已用 / 总视频数）、状态 `active / expiring / expired`。

---

## 七、粉丝端与小程序

### 7.1 粉丝端（FanAppFull）
- 底部导航：发现 / 排行 / NFT 市场 / 我的。
- 内容：AI 艺人（歌手、演员、舞者、主持、偶像）、曲目、NFT（徽章、粉丝卡、通行证、门票）。

### 7.2 带货创业者小程序（EntrepreneurMiniApp）
- Tab：选品 / 我的任务 / 消息 / 变现 / 我的。
- 商品：佣金 18–22%、名额（已领 / 总量，满额为 `full`）、奖励、平台标签、预估播放。
- 任务：`pending → review → done`；按平台筛选，按热度 / 最新 / 佣金排序；附带货攻略与平台规则。

### 7.3 切片小程序（ClipMiniApp）
- Tab：广场 / 品牌任务 / 我的切片 / 收益 / 合规。
- 明星授权状态 `active / pending`；品牌任务佣金 18–25%，有额外奖励（如首单双倍）。
- 切片：`draft → review → live`；收益按平台汇总。

---

## 八、商业化

### 8.1 订阅套餐（BillingCenter）
| 套餐 | 月 / 季 / 年（¥） | 明星数 | 报白账号 | GMV 平台费 | 月赠星币 |
|---|---|---|---|---|---|
| Lite 轻享版 | 1,980 / 4,980 / 16,800 | 1 | 2 | 1.5% | – |
| Pro 专业版（推荐） | 5,800 / 14,800 / 52,800 | 3 | 5 | 1.5% | 500 |
| Elite 旗舰版 | 16,800 / 42,000 / 138,000 | 不限 | 不限 | 1.0% | 2,000 + 专属客服 |

### 8.2 星币（按次计费）
- 充值包：¥100 = 1,000；¥500 = 5,500（+10%）；¥1,000 = 12,000（+20%，主推）；¥5,000 = 65,000（+30%）。
- 消耗：AI 脚本 50 / 次；报白申请 200 / 次；AI 配音 120 / 分钟；AI 形象视频 500 / 条。

### 8.3 激活码（ActivationCodePanel）
| 码 | 权益 |
|---|---|
| WELCOME2026 | Pro 30 天 |
| LITE-TRIAL | Lite 14 天 |
| PRO30 | Pro 30 天 + 200 星币 |
| ELITE7 | Elite 7 天 |
| COINS500 / COINS2000 | 500 星币 / 2,400 星币（永不过期） |
| NEWMCN2026 | 300 星币 |
| TRAIN-FREE | 免费基础合规认证课（原价 ¥980） |

### 8.4 培训认证（TrainingCenter）
| 认证 | 价格 | 资格 |
|---|---|---|
| 基础 | ¥980 | 绿区操作 |
| 进阶 | ¥1,480 | 黄区运营 |
| 高级 | ¥1,980 | 红区 AI 创作 |

章节 → 课时（视频 / 阅读 / 实操），顺序解锁，含测验。

### 8.5 分账规则
| 场景 | 规则 |
|---|---|
| 账号带货 GMV | 平台 1.5%（Elite 1%）/ 账号运营者 20–25% / 明星 + MCN 约 73–78%（内部结算，对运营者不可见） |
| MCN 佣金方案 | 标准 30/60/10；明星联动 25/55/10（月 GMV ≥ 5 万）；新人培育 40/50/10；全能高佣 20/70/10（月 GMV ≥ 10 万）（MCN / 艺人 / 平台，合计 100%） |
| 三方分成 | MCN / 艺人 / 品牌，如 30/55/15，按月结算 |
| 艺人签约 | 签约方 70% / 原创者 30% |
| 艺人挂单 | 卖家 80% / 平台 20% |
| NFT 二级市场 | 创作者版税 10% |

月账单 = 订阅费 + 星币消耗 + GMV 平台费；状态 `current / paid`。

---

## 九、核心数据实体
| 实体 | 关键枚举 |
|---|---|
| AI 艺人 | 类型 singer / actor / entertainer / dancer / host / all_rounder / idol；状态 trainee / debut / active / rest / retired；品质 common / rare / epic / legendary；风格 hyperreal / anime / chinoiserie / cyber_mecha / y2k / pixel / dreamcore / gothic |
| 平台账号 | douyin / wechat_channels / xiaohongshu / bilibili / weibo / youtube / tiktok / instagram / spotify；私域 wework / wechat_group |
| 授权 | 类型 image / voice / performance / ip_adapt / live_avatar；状态 active / expiring / expired / paused / violation |
| 报白 | unsubmitted / pending / approved / rejected / supplementing |
| 投流 | active / completed / paused / pending；授权 valid / expiring / expired / none |
| 内容 | music / drama / ad / variety / live_clip；Published / Draft / Review |
| 合同 | authorization / amendment / settlement；active / pending / expired / terminated |

---

## 十、非功能需求
- 双语：所有文案中英文齐全（`translations.ts`）。
- 主题：多主题切换。
- 移动端：小程序与粉丝端移动优先；控制台适配桌面。
- 规范：图标统一 lucide，不使用 emoji。
- 合规：所有对外内容须可追溯到授权编号；AI 生成内容须标注。

---

## 十一、待实现 / 待对齐事项

### 11.1 待实现（目前只有 Mock 数据或文案，没有真实逻辑）
1. 真实登录鉴权与角色权限（目前登录直接放行，品牌方没有独立入口）。
2. 后端接入（Supabase）：授权、报白、订单、结算数据持久化。
3. 规则引擎：分成比例校验、报白门槛、投流授权校验、风险分区自动判定。
4. 明星端文档中的规则：低风险自动通过、信用分 < 60 要求补材料、60 天内防重复提交、T+1 月 15 日打款、审计日志、电子签 / 续约 / 撤销、一键发函取证。
5. 切片授权培训跳转（目前只是弹窗提示）。

### 11.2 待对齐（数据或口径不一致）
1. 季度折扣：界面写 85 折，代码里是 0.84。
2. 明星分级：顾星辰粉丝 4,530 万却标为 S 级，与“> 1 亿”的门槛不符。
3. 分成口径分散：平台费有 1.5%、10%、20% 三种口径，建议统一定义每种场景的费率。
4. 合同类型：明星端文档写的是“切片 / AI 形象 / 数字人”三类，代码是“授权 / 补充 / 结算”。
5. 风险分区：明星端是绿 / 黄 / 橙 / 红，培训中心是绿 / 黄 / 红 / 禁区，需统一。

### 11.3 技术债
- `components/producer/*` 是 `mcn/*` 的旧副本，`components/ProducerDashboard.tsx` 和 `CoachDashboardFull` 都没有被路由引用，建议清理。
- `App.tsx` 内的 `ProducerDashboard` / `CoachDashboard` 是空实现。
