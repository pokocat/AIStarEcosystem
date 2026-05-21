# picgen 中文字体目录

启动时 `FontRegistry` 会扫这个目录里所有 `*.ttf` / `*.otf` 自动加载。
**目录为空也没问题** —— `BannerRenderer` 会回退到 JVM 逻辑字 + OS 字体回退（macOS PingFang SC / Linux Noto CJK / Windows YaHei），渲染仍能跑，只是变体丰富度低一些。

文件名里带这些关键词会被自动归类：

| 关键词 | 分类 (Kind) | 用途 |
|---|---|---|
| `black` / `heavy` / `huangyou` / `kuaile` / `zcool` / `display` / `poster` | DISPLAY | 主标题首选（粗黑 / 卡通） |
| `serif` / `song` / `ming` / `xiaowei` / `kaiti` | SERIF | 副标题、衬线风格 |
| `brush` / `mashanzheng` / `handwriting` / `script` | BRUSH | 偶尔出现的毛笔 / 手写风 |
| 其它 | SANS | 通用无衬线 |

## 推荐清单（OFL / 免商用）

按"风格差异最大化"挑的 4 个，覆盖 4 个 Kind：

### 1. AlibabaPuHuiTi 3.0 Heavy / 85 Bold (SANS · 主黑体)
- 通用主标题、高识别度
- 许可：阿里巴巴 普惠体协议（免商用，需保留版权）
- 下载：<https://www.alibabafonts.com/#/font>

### 2. ZCOOL QingKe HuangYou (站酷庆科黄油体) — DISPLAY
- 圆润饱满，电商促销最常见的"黄油字"
- 许可：OFL 1.1
- 下载：<https://fonts.google.com/specimen/ZCOOL+QingKe+HuangYou>
  - 直链：`https://github.com/google/fonts/raw/main/ofl/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf`

### 3. ZCOOL KuaiLe (站酷快乐体) — DISPLAY
- 卡通圆润，吸引眼球
- 许可：OFL 1.1
- 下载：<https://fonts.google.com/specimen/ZCOOL+KuaiLe>
  - 直链：`https://github.com/google/fonts/raw/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf`

### 4. Ma Shan Zheng (马善政书法体) — BRUSH
- 毛笔风，节日 / 特卖标语
- 许可：OFL 1.1
- 下载：<https://fonts.google.com/specimen/Ma+Shan+Zheng>
  - 直链：`https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf`

### 5. ZCOOL XiaoWei (站酷小薇) — SERIF
- 清瘦衬线，副标题用
- 许可：OFL 1.1
- 下载：<https://fonts.google.com/specimen/ZCOOL+XiaoWei>
  - 直链：`https://github.com/google/fonts/raw/main/ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf`

### 6. Source Han Sans SC Bold (思源黑体 SC Bold) — DISPLAY
- 完整 CJK 覆盖，Adobe / Google 出品
- 许可：OFL 1.1
- 下载：<https://github.com/adobe-fonts/source-han-sans/releases>
  - 注意：完整字重 ~10MB / 个；只挑 Bold 即可

## 添加步骤

```bash
cd apps/server/src/main/resources/fonts/

# 示例：4 个 Google Fonts 镜像直链
curl -sSLO https://github.com/google/fonts/raw/main/ofl/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf
curl -sSLO https://github.com/google/fonts/raw/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf
curl -sSLO https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf
curl -sSLO https://github.com/google/fonts/raw/main/ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf

# 启动 server，看启动日志：
# [fonts] loaded 'ZCOOLQingKeHuangYou-Regular' as kind=DISPLAY (ZCOOL QingKe HuangYou)
# [fonts] loaded 'MaShanZheng-Regular' as kind=BRUSH (Ma Shan Zheng)
# ...
# [fonts] registry total = 4 fonts
```

## 不要做

- 别放仿宋 / 微软雅黑 / 等商用授权字体 —— 这些不是 OFL。
- 别放 `.woff2`：Java AWT 不直接支持，需先转 TTF。
- 子目录可以建（如 `fonts/zh/`、`fonts/display/`），scanner 是递归的。

## License

每个加进来的字体务必在本 README 下面追加一段说明（字体名 + license + 来源 URL），随仓库一起 commit，便于审计。

### 已加载（请按实际情况维护）

| 文件名 | Kind | Family | License | 来源 |
|---|---|---|---|---|
| `ZCOOLQingKeHuangYou-Regular.ttf` | DISPLAY | 站酷庆科黄油体 | OFL 1.1 | github.com/google/fonts/tree/main/ofl/zcoolqingkehuangyou |
| `ZCOOLKuaiLe-Regular.ttf` | DISPLAY | 站酷快乐体 | OFL 1.1 | github.com/google/fonts/tree/main/ofl/zcoolkuaile |
| `MaShanZheng-Regular.ttf` | BRUSH | 马善政书法体 | OFL 1.1 | github.com/google/fonts/tree/main/ofl/mashanzheng |
| `LiuJianMaoCao-Regular.ttf` | BRUSH | 刘建毛草 | OFL 1.1 | github.com/google/fonts/tree/main/ofl/liujianmaocao |
| `LongCang-Regular.ttf` | BRUSH | 龙藏 | OFL 1.1 | github.com/google/fonts/tree/main/ofl/longcang |
| `ZCOOLXiaoWei-Regular.ttf` | SERIF | 站酷小薇 | OFL 1.1 | github.com/google/fonts/tree/main/ofl/zcoolxiaowei |
| `NotoSerifSC-Bold.otf` | SERIF | Noto Serif SC Bold | OFL 1.1 | github.com/notofonts/noto-cjk Serif/SubsetOTF/SC |
| `NotoSansSC-Bold.otf` | SANS | Noto Sans SC Bold | OFL 1.1 | github.com/notofonts/noto-cjk Sans/SubsetOTF/SC |

总计 8 个字体，约 52 MB。覆盖全部 4 个 Kind：
- SANS × 1 (Noto Sans SC)
- DISPLAY × 2 (ZCOOL 黄油体 / 快乐体)
- SERIF × 2 (站酷小薇 / Noto Serif SC)
- BRUSH × 3 (马善政 / 刘建毛草 / 龙藏)

picgen 渲染时同 kind 池有多个字体的话，按 seed 在池里挑一个，5 条变体之间字体差异更明显。
