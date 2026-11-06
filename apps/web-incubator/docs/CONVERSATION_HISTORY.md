# AI 艺人孵化平台 · 完整对话历史与决策记录

> 迁移自：Figma Make（Claude Sonnet 4.6）  
> 迁移时间：2026-07-05  
> 目标环境：OpenAI Codex  

---

## 项目背景（对话起点）

用户正在构建一个**赛博朋克风格的"AI艺人孵化平台"**，核心背景如下：

- **平台定位**：MCN 运营闭环，连接明星IP、生态创业者（MCN运营）、粉丝三方
- **三端架构**：
  1. 生态创业者工作台（MCN Console，producer 角色）
  2. 明星IP端（CelebrityWorkbench，celebrity 角色，通过 MCNConsole initialRole 进入）
  3. 星海粉丝端（FanAppFull）
- **附加端**：两个微信小程序模拟界面（EntrepreneurMiniApp、ClipMiniApp）
- **整体风格**：赛博朋克，红黑灰配色，5种主题可切换
- **双语支持**：中英文，Lang='zh'|'en'

---

## 阶段性开发记录

### P0 阶段：项目初始化与基础架构

**完成内容：**
- 初始化 React + TypeScript + Vite + Tailwind CSS v4 项目
- 建立三端架构：Portal → 三个入口
- App.tsx 使用 `useState` 字符串状态机管理页面路由（无 react-router）
- 集成 shadcn/ui 基础组件库（基于 Radix UI）
- 集成 Motion/React 动效库
- 建立粒子背景（ParticleBackground，canvas 实现）
- 建立 ThemeProvider，支持 5 种主题

**关键决策：**
- 路由方案选 useState 状态机而非 react-router，理由：单页应用结构简单，不需要 URL 路由
- 主题系统用 CSS 变量 + Context，不用 next-themes
- 包管理选 pnpm

---

### P1 阶段：白底化全面改造

**用户需求：** 将整个系统从深色（黑底）改为浅色（白底）风格。

**改造范围与方案：**

1. **ThemeProvider** — 新增 `light` 主题，并将默认主题从 `dark` 改为 `light`
2. **App.tsx 根容器** — `bg-black text-white` → `bg-white text-gray-900`
3. **Portal 页面** — 三栏背景保持全屏图片，但外容器改为 `bg-gray-50`
4. **MCNConsole 主控台** — 侧边栏、顶部导航、内容区全面改为白底浅色风格：
   - 侧边栏：`bg-gray-900` → `bg-white border-r border-gray-200`
   - 顶部栏：`bg-gray-800` → `bg-white border-b border-gray-100`
   - 激活项高亮：从亮色文字改为 `bg-gray-100 text-gray-900`
5. **NewLandingPage** — 保留赛博朋克深色风格（落地页特意保持黑底）

**最终效果：** 除落地页外，所有工作台页面统一白底浅色风格。

---

### P2 阶段：全站 emoji → Lucide 图标替换

**用户需求：** 将所有 emoji 替换为 lucide-react 图标组件。

**替换原则：**
- 每个 emoji 找语义最接近的 Lucide 图标
- 所有图标统一从 `lucide-react` 导入，在文件顶部统一声明
- 尺寸统一用 Tailwind 类（`w-4 h-4`、`w-5 h-5` 等）

**涉及文件：** App.tsx 内所有内联组件 + 各独立组件文件

---

### P3 阶段：AI孵化器 IncubationWizard 升级

**用户需求：** 在 AI 孵化向导中增加"持久人物预览框"。

**功能说明：**
- IncubationWizard 有 7 个步骤：
  1. 形象锻造（AppearanceForge）
  2. 声纹采集
  3. 人格设定
  4. 风格定向
  5. 技能树
  6. IP注册
  7. 发布
- **改造要点**：完成第1步"形象锻造"后，在左侧步骤列表**下方**新增一个持久人物预览框
- 该预览框在步骤2-7全程可见，显示已生成的角色形象
- 实现方式：在 wizard state 中增加 `generatedCharacter` 状态，步骤1完成后写入，左侧栏条件渲染

**文件路径：** `src/app/components/mcn/IncubationWizard.tsx`

---

### P4 阶段：两个小程序端全面重构

**用户需求：** 两个小程序界面（创业者小程序、切片专用小程序）需要统一重构风格。

**设计规范（用户指定）：**
- 底色：**纯白底**（`bg-white`）
- 主色调：**黄黑配色**（金黄 `#F59E0B` + 黑色 `#111`）
- 风格：**简约赛博朋克**（不是重度赛博朋克，而是克制的现代科技感）
- 布局：移动端优先，模拟 375px 手机界面，有外壳（手机边框模拟）

**EntrepreneurMiniApp.tsx 功能模块：**
- 首页：今日任务、收益概览
- 任务中心：领取内容任务、提交完成
- 佣金提现
- 报白申请（申请使用明星AI素材）
- 账号绑定

**ClipMiniApp.tsx 功能模块：**
- 明星切片素材库（浏览 + 领取）
- 带货任务（商品 + 提成比例）
- 我的收益（明细 + 提现）
- 任务记录

---

### P5 阶段：明星端工作台产品文档生成

**用户需求：** 根据 `CelebrityWorkbench.tsx` 代码逆向整理产品文档。

**文档内容（已写入 `产品文档.md`）：**

1. **产品概述**
   - 模块定位：明星本人/经纪团队的核心审核与运营中枢
   - 三方协同：明星端（顶点）← 授权/审核 → 生态创业者端 + 粉丝端

2. **信息架构（NavSection）**

   | Key | 中文名 | 模块职责 |
   |-----|--------|---------|
   | `overview` | 总览 | KPI仪表盘、待办聚合、GMV趋势 |
   | `ipAuth` | IP授权中心 | 4类资产上传→火山引擎激活 |
   | `whitelist` | 账号报白 | MCN账号准入审核 |
   | `digitalHuman` | 数字人审核 | 直播/短视频/广告用途审核 |
   | `content` | 内容审核 | 剪辑片段合规检查 |
   | `contract` | 合同管理 | 授权合同签署/归档 |
   | `infringement` | 侵权巡查 | 未授权使用扫描 |
   | `revenue` | 收益结算 | GMV分成核算 |

3. **核心业务流程**

   **IP授权状态机：**
   ```
   未授权 ──申请──→ 审核中 ──通过──→ 激活
                         └──驳回──→ 已拒绝
   激活 ──使用中──→ 续期/撤销
   ```

   **报白审核流程：**
   ```
   MCN提交账号 → 明星端收到待审通知
   → 人工审核（可附AI预审建议）
   → 通过：账号加入白名单，可使用AI素材
   → 驳回：附驳回原因，MCN可修改后重新提交
   ```

   **收益分成规则：**
   - MCN基础分成 = GMV × 合同分成比例
   - 明星端抽成 = MCN分成 × 明星合同比例
   - 平台服务费 = 固定比例（通常3-5%）
   - 结算周期：T+7（日结）或 T+30（月结）

4. **IP资产四类型**
   - 肖像资产（图片/视频素材）
   - 声纹资产（声音模型）
   - 切片素材（短视频片段授权）
   - 数字人模型（AI数字人形象授权）

---

### P6 阶段：Supabase 配置与迁移准备（当前阶段）

**用户操作（手动编辑）：**

`/supabase/.supabaseignore`：
```
functions/make-server/*
functions/make-server
make-server/*
make-server
```

`/supabase/functions/.deployignore`：
```
make-server
```

**原因：** `supabase/functions/make-server/` 是 Figma Make 平台的内置服务函数，在迁移到 Codex 后需要避免被意外部署到自己的 Supabase 项目中。通过配置 ignore 文件，`supabase functions deploy --all` 时会自动跳过该目录。

**迁移决定：** 用户决定将项目从 Figma Make 迁移到 Codex 继续开发，保留所有已有代码和对话上下文。

---

## 技术决策汇总

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 路由方案 | useState 状态机 | 无需URL路由，结构简单 |
| 图标库 | lucide-react | 项目统一规范，语义清晰 |
| 动效库 | motion/react | Framer Motion 新名称，API完全兼容 |
| 主题系统 | 自定义 ThemeProvider | 5种主题，light为默认 |
| UI组件 | shadcn/ui + Radix UI | 无样式原语，可完全定制 |
| 图表 | Recharts | 项目规范指定 |
| 包管理 | pnpm | 项目规范指定 |
| 后端 | Supabase + Hono Edge Functions | 用户选择 |

---

## 现有 Mock 数据说明

所有数据目前均为前端 Mock，尚未接入 Supabase：

- `MOCK_SINGERS`：艺人列表（App.tsx）
- `EARNING_DATA`：收益图表数据（App.tsx）
- MCNConsole 内各模块的模拟数据（各组件内部 useState 初始值）
- CelebrityWorkbench 的待审列表、GMV数据等（CelebrityWorkbench.tsx 内部）

**待开发：** 将 Mock 数据替换为 Supabase 真实查询。

---

## 已安装的主要依赖

```json
{
  "motion": "12.23.24",
  "lucide-react": "0.487.0",
  "recharts": "2.15.2",
  "react-hook-form": "7.55.0",
  "react-router": "7.13.0",
  "@jsr/supabase__supabase-js": "2.49.8",
  "hono": "^4.12.14",
  "sonner": "2.0.3",
  "date-fns": "3.6.0",
  "react-dnd": "16.0.1",
  "vaul": "1.1.2",
  "@mui/material": "7.3.5",
  "cmdk": "1.1.1"
}
```

---

## 下一步建议（供 Codex 参考）

1. **Supabase Schema 设计**：为三端数据建表（artists、whitelist_requests、ip_assets、contracts、revenue_records）
2. **Edge Functions**：报白审核、IP授权状态变更通知
3. **认证**：Supabase Auth 替换现有 mock LoginPage
4. **实时通知**：Supabase Realtime 驱动 NotificationCenter
5. **IncubationWizard 持久化**：向导进度存入 DB，支持断点续传
