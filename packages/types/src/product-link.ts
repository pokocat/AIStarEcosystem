// ─────────────────────────────────────────────────────────────────────────────
// product-link.ts — 商品链接解析结果。
// 前端调 POST /api/celebrity/product-link/parse 拿到这个结构。
// server 端两个 handler（DouyinQueryEmbeddedHandler / DouyinHtmlScrapeHandler）
// 都按这个统一形态返回。新平台扩展只加 handler，类型不变。
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductLinkInfo {
  /** 商品标题（解析自分享数据或 og:title） */
  title?: string;
  /** 商品图 URL 列表（外网 CDN，可直接 <img src>，不做本地化） */
  imageUrls: string[];
  /** 最低价（分）— 抖音商城 goods_detail 的 min_price */
  minPriceCents?: number;
  /** 最高价（分）— 同上 max_price；与 min 相等时表示单价 */
  maxPriceCents?: number;
  /** 销量整数（来自 goods_detail.sales 或页面提取，可空） */
  sales?: number;
  /** 推导卖点（例如「价格 ¥9.90 · 销量 200w+」），用户可覆盖 */
  inferredSellingPoints?: string;
  /** 命中的 handler 名字，用于调试（如 "douyin-query-embedded" / "douyin-html-scrape"） */
  source: string;
}
