---
name: IP Studio · 声量引擎旗下
description: 角色与世界的创作空间，以暖灰、白色与深墨组织人物和内容。
colors:
  bg: "#f0efec"
  paper: "#ffffff"
  soft: "#f6f6f5"
  ink: "#192229"
  ink-hover: "#323e45"
  muted: "#65707e"
  line: "#e8eaec"
  selected: "#eeefef"
  green: "#28694f"
  green-soft: "#eaf4ee"
  gold: "#805a27"
  gold-soft: "#f8eddb"
  error: "#a43845"
  error-soft: "#fcf0f1"
typography:
  display:
    fontFamily: "'Noto Serif SC', 'Songti SC', 'STSong', serif"
    fontSize: "clamp(40px, 4.5vw, 70px)"
    fontWeight: 700
    lineHeight: 1.42
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "'Noto Serif SC', 'Songti SC', 'STSong', serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.4
  title:
    fontFamily: "'Noto Serif SC', 'Songti SC', 'STSong', serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.35
  asset-name:
    fontFamily: "'Noto Serif SC', 'Songti SC', 'STSong', serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.6
  body:
    fontFamily: "'Manrope', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Manrope', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.6
rounded:
  field: "7px"
  control: "8px"
  image-card: "9px"
  surface: "13px"
  status: "18px"
  filter: "20px"
spacing:
  compact: "8px"
  small: "12px"
  medium: "16px"
  large: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-secondary-hover:
    backgroundColor: "{colors.soft}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "4px 0"
  search-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
  filter:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.filter}"
    padding: "6px 12px"
  filter-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  navigation-active:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 14px"
  ip-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "3px"
  dossier:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  status-finalized:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.green}"
    rounded: "{rounded.status}"
    padding: "3px 11px"
---

# Design System: IP Studio · 声量引擎旗下

## Overview

**Creative North Star: "角色与世界的创作空间"**

人物与内容是视觉中心。暖灰承托白色工作面，深墨明确操作，中文衬线给标题和人物名称留出创作的温度；搜索、筛选与设置使用清晰的无衬线字。界面既能容纳完整人物图，也能安静地承载版本、设定和状态，不以装饰代替内容。

本文件记录已实现的首页、IP 管理和共享浅色顶栏系统。适用代码为 `src/styles/ip-brand.css`，令牌限定在 `.ip-brand-surface` 与 `.ip-management-editor`。页面组成和业务行为见 [DESIGN-desktop.md](DESIGN-desktop.md)；首页及管理页的具体设计意图分别见 [.impeccable/ip-home.md](.impeccable/ip-home.md) 与 [.impeccable/ip-management.md](.impeccable/ip-management.md)。

旧青色移动 H5 仍按 [DESIGN-mobile.md](DESIGN-mobile.md) 及 [.impeccable/design-mobile.json](.impeccable/design-mobile.json)；画布内部仍按 `.ip-surface` 的群青与麦黄系统，见 [DESIGN-desktop.md](DESIGN-desktop.md)。这些入口按页面作用域使用，不能把本文件的令牌全局写到 `:root`。

**Key Characteristics:**

- 暖灰底、白色表面与细边线，内容平稳地留在工作面上。
- 深墨主按钮与选中标记，状态色只表达状态。
- 中文衬线承载标题与人物名，无衬线承载正文与操作。
- 图像有完整的阅读位置，缺失素材有清楚的占位说明。
- 常规控件紧凑，详情正文可换行，键盘焦点清晰可见。

## Colors

主色接近黑色，环境保持暖灰与白；绿色、赭金和红色只用于可核验的状态与反馈。色值以前置令牌为准，来源为 `ip-brand.css`。

### Primary

- **深墨**（`ink`）：标题、正文、主按钮、当前导航、筛选选中与焦点环。主按钮 hover 使用 `ink-hover`，以底色变化提供反馈。

### Secondary

- **定稿绿**（`green` / `green-soft`）：已定稿、保存成功的文字与轻底。
- **进行中赭金**（`gold` / `gold-soft`）：进行中状态及明确标注的演示模式说明。它不是本系统的主操作色。
- **错误红**（`error` / `error-soft`）：读取或保存失败；错误说明与重试入口同时出现。

### Neutral

- **暖灰底**（`bg`）：整页环境与列之间的留白。
- **白纸面**（`paper`）：主内容、详情、顶栏和按钮文字。
- **浅灰面**（`soft`）：输入周边、标签、空素材区域与次按钮 hover。
- **次文字灰**（`muted`）：说明、日期、未填写字段与次要导航。
- **细边线**（`line`）：输入、卡片与详情区块的分隔。
- **选中浅灰**（`selected`）：网格/列表切换的当前项。

**The 状态有文字 Rule.** 状态色必须与状态名称并用；绿色的「已定稿」不改写成「已发布」，未知统计使用「—」。

## Typography

**Display Font:** Noto Serif SC，回退到 Songti SC、STSong 与 serif。

**Body Font:** Manrope、Noto Sans SC，回退到系统无衬线字体。

标题与人物名共享中文衬线，正文和操作共享无衬线。这里没有额外的等宽层；画布与旧移动 H5 的登记号字体仍由其各自文档管理。

### Hierarchy

- **Display**：首页主标题，使用前置 `display` 规格；两行标题的结构属于首页组成。
- **Headline**：IP 管理页面标题，使用 `headline`。
- **Title**：详情人物名，使用 `title`；长名称允许换行。
- **Asset Name**：人物卡片名称，使用 `asset-name`；卡片单行截断。
- **Body**：正文基准使用 `body`；详情说明按当前实现使用较紧凑的字号与较松行高。
- **Label**：详情操作与标签使用 `label`；搜索、筛选和统计辅助文案按当前实现的紧凑密度呈现，不反向缩小正文。

Noto Serif SC 为官方可变 WOFF2 Unicode 分片（200–900），在 `src/styles/ip-display-font.css` 声明，`font-display: swap`。字库自托管于 OSS `media/ipstudio/fonts/noto-serif-sc-v36/`，由固定同源 `/ip-fonts/noto-serif-sc/[file]` 路由读取；OFL 与来源清单保留在相同前缀。它沿用官方 Web 字符范围，生僻字继续使用系统衬线回退，不承诺覆盖所有汉字。原有 Manrope、Noto Sans SC、Newsreader 与 JetBrains Mono 的加载方式未重做。

**The 字体按职责 Rule.** 衬线用于标题与人物名称；按钮、输入、筛选、日期和说明保持无衬线，不能把首页大字的形式扩散到操作控件。

## Layout

留白按已出现的紧凑、小、中、大与区块间距组织，精确值见前置 `spacing`。主要工作面以直线对齐和相邻列建立秩序，卡片内部保持一致的文字、标签与统计位置；图片内容不靠歪斜或重叠建立层次。

设备形态的唯一真值是 `html[data-layout]`：用户显式选择优先，未选择时以 960px 为默认断点。新增桌面形态样式必须接这个属性；媒体查询仅处理真实宽度约束，例如现有 1250px 以下的导航压缩与列宽调整。首页的公共移动适配与 IP 管理的移动覆盖式详情属于当前代码行为；本轮验收为桌面，未完成手机或 1280px 截图验收。

当前共享桌面顶栏离视口四周留出细窄间距，内容让位由 `--desktop-bar-h` 管理。页面尺寸、首页图卡数量、IP 管理列表与相邻详情的布局及滚动边界见桌面文档，不作为所有新页面的固定组成。

## Elevation & Depth

主系统不以卡片投影制造浮起感。白色表面、暖灰间隔、细边线和选中描边建立层次；IP 卡片 hover 只增强边线，选中描边保持深墨。账号菜单与相邻详情也按这一平面材料语言组织。

焦点是深墨实线（2px，外偏移 3px），不使用彩色发光。图片区允许局部遮罩帮助文字阅读，首页图片旁的小字有局部文字投影；这些不构成通用容器阴影令牌。

**The 平面工作面 Rule.** 常规卡片和控件保持平稳；交互优先改变边线、底色或文字，不添加常驻悬浮投影。

## Shapes

控件是小圆角矩形，卡片图片与外框分别裁切；主表面使用较缓的圆角。状态与筛选更圆，头像为圆形。前置 `rounded` 记录重复使用的形状，不能据此把所有对象改成同一圆角。

细边线通常为 1px，IP 卡片选中再增加 1px 外轮廓。详情和卡片均隐藏图片溢出；完整设定图使用 contain，人物缩略图使用 cover。图像比例属于具体内容用途，不用拉伸图片凑满格子。

## Components

### Buttons

深墨按钮表达当前主要动作；白底细边线表达次动作；纯文字表达低强调的辅助入口。常规按钮最小高度 42px，图标与文字间隔 9px，前置令牌记录共同的内边距与圆角；首页主 CTA 和管理页紧凑创建按钮有各自尺寸。

主按钮 hover 到 `ink-hover`，次按钮 hover 到 `soft`，文字按钮 hover 加下划线。可键盘聚焦的操作必须有焦点环；禁用时透明度为 0.5、光标回到默认，加载中显示具体动作并阻止重复提交。

### Inputs / Fields

搜索为白底细边线、深墨输入、次文字灰占位。搜索区域获得焦点时边线转为深墨；字段保留键盘焦点提示。编辑表单使用较紧凑的字段圆角，textarea 可纵向调整，长设定有足够的阅读行高。

保存失败与输入内容同时保留；不能用关闭表单替代错误反馈。空白必填名称不能提交，保存中禁用重复保存与取消。

### Navigation

浅色共享顶栏使用深墨品牌和无衬线导航；当前项为深墨文字加下划线。IP 管理沿用顶栏导航，不重复设置左侧工作空间导航。导航必须保留可见的当前项与中文名称，不靠图标单独识别。

### Filters / Status / Tags

状态筛选是小尺寸圆角按钮，默认浅灰、当前深墨；数量使用等宽数字。网格/列表切换是细边线容器内的浅灰选中块。标签是浅灰小矩形，状态是软底圆角标记，两者不能互相替代。

### Cards / Containers

人物卡以主形象为第一信息，随后是衬线名称、简介、标签与真实资产数量。卡片选择使用 `aria-pressed` 与深墨边线，缺少主图时使用说明占位。列表视图继续使用同一实体与信息顺序。

### Signature: 相邻人物档案

IP 管理的列表保留在原位，选择后显示相邻详情，列表与档案共享同一人物实体。档案包含主图、设定、具体图片版本和已绑定声音；内容独立滚动，底部编辑、进入形象画布与导出操作持续可达。它是本页的签名模式，不扩展为画布抽屉或所有页面的通用布局。

### Loading & State

加载明确说明正在读取什么；统计未确定时显示「—」。整页读取失败与素材/声音的局部失败分开呈现，已有内容保持可见。空列表和筛选无结果使用不同文案，并分别提供创作入口和清除筛选；缺失图片类别、声音与设定直接说明未归档或未填写。

交互过渡沿用 `--ip-ease`；主按钮底色为 160ms、图片入口箭头为 180ms。减少动态偏好会将 `.ip-brand-surface` 内动画与过渡降至接近即时。

## Do's and Don'ts

### Do:

- **Do** 在首页、IP 管理、桌面素材库、账号工具和共享顶栏使用本系统；旧移动 H5 与画布分别使用明确的设计入口。
- **Do** 让人物与内容成为视觉中心，保持白面、暖灰间隔和细边线。
- **Do** 按职责使用衬线与无衬线，并保留系统字体回退。
- **Do** 同时展示状态名称与状态色，让焦点和选中状态清楚可见。
- **Do** 为缺失素材、未知统计、加载和错误提供明确说明与可用的下一步。
- **Do** 按真实实体与具体版本展示人物内容，保存后同步列表与详情。

### Don't:

- **Don't** 把作用域令牌写到全局根节点，或将画布群青与麦黄套用到新的浅色主系统。
- **Don't** 用伪造作品、表情、收藏数、用户照片或通知按钮补满设计图。
- **Don't** 把「已定稿」显示成「已发布」，或以零值冒充失败接口的真实统计。
- **Don't** 给平面卡片添加常驻发光、重叠拼贴或强投影。
- **Don't** 将新中文衬线用于按钮、筛选和字段说明。
- **Don't** 用媒体查询重新判定设备形态，绕过用户明确选择。
