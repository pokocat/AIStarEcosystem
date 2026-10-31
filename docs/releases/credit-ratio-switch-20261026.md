# 积分切换到 1 元 = 100 积分 · 生产（2026-10-26）

用户要求把全部变更推上线，套餐与售价按新比率（1 元 = 100 积分）改。成本依据：飞书「AIStar 全平台成本与积分自动核算」，60% 技术毛利，供应商价见 `docs/runbooks/cost-pricing-feishu.md` §2.5–2.6。

## 用户决定

- 老余额数字不变（55 个钱包合计 177,928 积分，未做账本调整）。
- 套餐：99 元 = 10,000 积分；其余按同一思路取整、不赠送：299 元 = 30,000、799 元 = 80,000、2399 元 = 240,000。
- 只改有成本数据的售价；没有成本数据的保持原数字（见下「未改」）。
- 停止每月赠送。

## 已上线（服务端 + 模型配置）

服务端发布 `20261026-credit-ratio`（干净 main `1a5f120d`，仅 server）：带上系列界面名「GPT Image 2 / GPT Image 2.5」（`384fb9bb`）；verify ALL GREEN，NRestarts=0，启动后 ERROR 0 条。

`/etc/aistareco/server.env` 追加 `AEP_DAP_MONTHLY_GRANT=0`（非密钥配置；改前文件备份在下列目录 `server.env.before`），进程环境已确认生效。账户页会显示「本月赠送 0」。

模型配置服务（短时签名，actor `claude-code-donis`）6 条命令全部成功：

| 功能 | 原售价（旧积分） | 新售价 |
|---|---|---|
| Studio 图片 GPT Image 2 1K/2K（`ai-abadd123-a06`） | 30 | 16 积分/张 |
| Studio 图片 GPT Image 2 4K（`ai-7398056d-6cf`） | 40 | 55 |
| Studio 图片 GPT Image 2.5 1K/2K（`ai-c120fb1f-769`） | 35 | 37 |
| Studio 图片 GPT Image 2.5 4K（`ai-41444f1b-60a`） | 45 | 61 |
| 视频生成区矩阵 544p / 768p（四种模式） | 20 / 40 | 62 积分/秒 |
| 视频生成区智能优化 | 2 | 5 积分/次 |
| H3 候选价（短剧分镜视频、画布视频、带货视频共用） | 40 | 62 积分/秒 |
| 短剧分镜图 `drama.frame`（GPT Image 2） | 2（回落值） | 16 积分/张 |
| Studio 配音 qwen3-tts | 2 | 4 积分/秒 |
| Studio 口型同步 x-dub | 40 | 61 积分/秒 |

视频矩阵 720p（80 积分/秒）没有成本数据，未改。图片 1K/2K 同端点只能同价，取 2K 的 16。

前台验收：用户登录态打开画布，页面请求 `GET /api/v1/ip-studio/models` 返回系列名「GPT Image 2 / GPT Image 2.5」，`imageResolutionCosts` 16/16/55、37/37/61，视频 62 积分/秒。未做付费生成。

改前快照与每步返回：`/opt/ai-star-eco/backups/credit-ratio-20261026/`（`functionPricingCatalog.json`、`scenePolicies.json`、`videoPrices.json`、四个用途的候选、`step-1..6.json`、`server.env.before`）。回滚：按快照里的原值重新保存同样 6 项，删掉 env 里那一行并重启服务端。

## 后台操作计划（已完成，保留原记录）

1. **充值套餐**（财务后台「充值套餐」）：`pkg-300` 99 元 → 10,000 积分、赠送 0；`pkg-1000` 299 元 → 30,000、赠送 0；`pkg-3000` 799 元 → 80,000、赠送 0；`pkg-10000` 2399 元 → 240,000、赠送 0。测试包 `test` 不动。
2. **AI 文本按 Token 计费**（后台「基础数据 → 预设 → AI 对话计费」，`ai.chat-token-pricing`，单位积分/千 Token）：qwen38-27b 输入 0.59、输出 2.36（原 0.18 / 1.08）；qwen3.6 输入 0.27、输出 1.59（原 0.18 / 1.08）。按聚算原价 × 5 折 × 0.01 元/积分、损耗 10%、免费 5%、支付 0.6%、毛利 60% 计算，预算上限不变。

## 未改（没有成本数据）

短剧文本配置价（2–18 积分/次）、数字资产形象生成与衍生（20–50）、场景/产品图（3–6 回落值）、带货脚本 10、素材视频 30、混剪 30、作品分发 20、旧数字人引擎（50/120/300）、视频 720p 80、`studio.script` 场景价 2。按 1 元 = 100 积分，这些价格折合人民币比原来低很多，部分可能低于成本，补齐成本后再定。

## 后台修改结果

### 修改前快照

2026-10-25 09:47（America/Los_Angeles）通过已登录的生产管理后台接口回读。充值套餐接口会把数据库中的通用适用范围投影为 `appScope: "all"`，零赠送与零存储字段省略；下表按完整 PUT 字段还原，其中原始 `appScope` 保持 `null`、页面确认四项均为在售：

| id | tag | credits | priceCents | bonusCredits | recommended | sortOrder | active | appScope | grantStorageMb |
|---|---|---:|---:|---:|---|---:|---|---|---:|
| `pkg-300` | 体验包 | 300 | 9900 | 0 | false | 10 | true | null | 0 |
| `pkg-1000` | 标准包 | 1000 | 29900 | 100 | true | 20 | true | null | 0 |
| `pkg-3000` | 热门包 | 3000 | 79900 | 500 | false | 30 | true | null | 0 |
| `pkg-10000` | 企业包 | 10000 | 239900 | 2000 | false | 40 | true | null | 0 |

`ai.chat-token-pricing` 修改前完整 JSON（配置版本 v2；描述、更新时间和操作人属于配置元数据，不在 `value` 内）：

```json
{
  "endpoints": {
    "ai-studio-jusuan-qwen36": {
      "inputCreditsPerK": 0.18,
      "outputCreditsPerK": 1.08,
      "maxInputTokens": 65536,
      "maxOutputTokens": 8192,
      "supplierReference": {
        "source": "https://portal.jusuanhub.com/models/pub-fibiyjy3vbkcc",
        "verifiedAt": "2026-10-12",
        "currency": "supplier_points",
        "inputPerMillion": 90,
        "outputPerMillion": 540,
        "supplierToPlatformRatio": 1,
        "multiplier": 2,
        "note": "当前活动价的两倍，客户售价独立保存；供应商变价需重新核定"
      }
    },
    "ai-studio-jusuan-qwen38": {
      "inputCreditsPerK": 0.18,
      "outputCreditsPerK": 1.08,
      "maxInputTokens": 65536,
      "maxOutputTokens": 8192,
      "pricingNote": "保留原Studio已公布客户端积分费率；未据新供应商成本重新定价"
    }
  }
}
```

配置元数据：`description = "Studio AI 对话按供应商实际 Token 结算；2026-10-12 聚算活动价 x2，积分换算1:1"`，`updatedAt = 2026-10-16T09:25:51.850754Z`，`updatedBy = studio-upload-chat-repair`。

### 修改与回读

操作时间：2026-10-25 09:47:41（America/Los_Angeles；对应 2026-10-26 00:47:41 Asia/Shanghai）。使用生产管理后台现有 SUPER_ADMIN 登录态，通过页面自身使用的管理接口操作；未直写 SQL、未新建或伪造令牌。

充值套餐四次 `PUT /api/admin/finance/recharge-packages/{id}` 均返回 HTTP 200。`appScope` 请求传 `null` 以保持原存储值，回读接口按既有 DTO 规则投影为 `all`：

| id | tag | credits | priceCents | bonusCredits | recommended | sortOrder | active | appScope | grantStorageMb |
|---|---|---:|---:|---:|---|---:|---|---|---:|
| `pkg-300` | 体验包 | 10000 | 9900 | 0 | false | 10 | true | null | 0 |
| `pkg-1000` | 标准包 | 30000 | 29900 | 0 | true | 20 | true | null | 0 |
| `pkg-3000` | 热门包 | 80000 | 79900 | 0 | false | 30 | true | null | 0 |
| `pkg-10000` | 企业包 | 240000 | 239900 | 0 | false | 40 | true | null | 0 |

测试包 `test` 回读仍为 1 积分、1 分、赠送 1、`appScope=drama`、排序 9999，未修改。

`PUT /api/admin/platform-configs/ai.chat-token-pricing` 返回 HTTP 200，配置从 v2 升至 v3；新 `value` 完整 JSON 如下。除四个费率外，Token 上限、`supplierReference`、`pricingNote` 和配置描述均保持原样：

```json
{
  "endpoints": {
    "ai-studio-jusuan-qwen36": {
      "inputCreditsPerK": 0.27,
      "outputCreditsPerK": 1.59,
      "maxInputTokens": 65536,
      "maxOutputTokens": 8192,
      "supplierReference": {
        "source": "https://portal.jusuanhub.com/models/pub-fibiyjy3vbkcc",
        "verifiedAt": "2026-10-12",
        "currency": "supplier_points",
        "inputPerMillion": 90,
        "outputPerMillion": 540,
        "supplierToPlatformRatio": 1,
        "multiplier": 2,
        "note": "当前活动价的两倍，客户售价独立保存；供应商变价需重新核定"
      }
    },
    "ai-studio-jusuan-qwen38": {
      "inputCreditsPerK": 0.59,
      "outputCreditsPerK": 2.36,
      "maxInputTokens": 65536,
      "maxOutputTokens": 8192,
      "pricingNote": "保留原Studio已公布客户端积分费率；未据新供应商成本重新定价"
    }
  }
}
```

回读证据：

- 管理接口重新 GET 两项均为 HTTP 200，四个套餐逐项校验为 true，`ai.chat-token-pricing` 为 v3，`updatedAt=2026-10-25T16:47:41.045136Z`。
- 管理后台「充值套餐」页面显示 10,000 / 30,000 / 80,000 / 240,000 积分、¥99 / ¥299 / ¥799 / ¥2399、赠送均为 0，四项均在售；测试包仍在原行。
- 管理后台「基础数据 → 预设 → AI 对话计费」页面显示 qwen36 为 0.27 / 1.59、qwen38 为 0.59 / 2.36，v3。
- Studio 生产充值页 `/studio#/membership` 实际显示四个新套餐及价格。
- 小程序充值页代码直接消费的生产 `GET /api/me/wallet/packages` 回读 HTTP 200，返回上述四个新套餐；桌面微信当时要求重新扫码登录，未做桌面小程序截图验收。

回滚：按「修改前快照」对四个原 id 各执行一次完整 PUT，并把 `ai.chat-token-pricing` 的 `value` 原样保存；不要修改 `test`、其他套餐、钱包或账本。
