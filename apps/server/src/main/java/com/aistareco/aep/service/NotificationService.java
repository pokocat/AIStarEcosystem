package com.aistareco.aep.service;

import com.aistareco.aep.dto.BotConversationDto;
import com.aistareco.aep.dto.BotMetaDto;
import com.aistareco.aep.dto.ChatMessageDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * AI Bot 同事会话服务（v0.4 新增）。
 *
 * 5 个 Bot 各一段 canned 多消息会话，与 apps/miniprogram/utils/mocks.js 中 CONVERSATIONS 完全对齐。
 * 后续接入真实推送 / 个性化时再换实现，此处先返回硬编码数据。
 */
@Service
public class NotificationService {

    public BotConversationDto getConversation(String botId) {
        return switch (botId) {
            case "pian" -> pian();
            case "shen" -> shen();
            case "shu" -> shu();
            case "ada" -> ada();
            case "zhang" -> zhang();
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "未知 botId：" + botId + "（仅支持 pian/shen/shu/ada/zhang）");
        };
    }

    // ── 片片：创作官 ──────────────────────────────────────────────────────────
    private BotConversationDto pian() {
        BotMetaDto bot = new BotMetaDto("pian", "片片", "创作官 · 在线",
                "#0A0A0A", "✦", "#C8FF00");
        List<ChatMessageDto> msgs = List.of(
                ChatMessageDto.time("上午 09:42"),
                ChatMessageDto.text("老板早～你的「李某某 · 30s 口播」刚刚生成完成 🎬"),
                ChatMessageDto.cardCta(
                        "生成完成 · 待发布",
                        "建议加个产品特写镜头会更出片，复制并改只需 30 秒。",
                        true,
                        Map.of("icon", "▶", "title", "T-2024-1024-02", "sub", "李某某 · 每日坚果礼盒"),
                        Map.of("text", "去查看 / 发布", "route", "/pages/video-detail/index?id=T-2024-1024-02")
                ),
                ChatMessageDto.text("另外还有 2 条草稿待发布、1 条失败可重试，需要一起处理吗？"),
                ChatMessageDto.cardCta(
                        "草稿管理",
                        "当前共 2 条草稿、1 条生成失败、4 条生成中。",
                        false,
                        null,
                        Map.of("text", "前往视频中心", "route", "/pages/videos/index")
                )
        );
        return new BotConversationDto(bot, msgs);
    }

    // ── 审审：合规官 ──────────────────────────────────────────────────────────
    private BotConversationDto shen() {
        BotMetaDto bot = new BotMetaDto("shen", "审审", "合规官 · 在线",
                "#FF7A1A", "✓", "#fff");
        List<Map<String, Object>> fields = List.of(
                Map.of("label", "营业执照", "value", "已上传"),
                Map.of("label", "品类经营许可", "value", "未上传"),
                Map.of("label", "法人手机号", "value", "138****8888")
        );
        List<ChatMessageDto> msgs = List.of(
                ChatMessageDto.time("上午 09:15"),
                ChatMessageDto.text("王某某授权审核已通过 ✓ 但还差一些资质材料没补齐。"),
                ChatMessageDto.cardForm(
                        "资质材料",
                        Map.of("text", "待完善", "tone", "warn"),
                        fields,
                        Map.of("text", "上传剩余资质", "route", "/pages/celebrity-detail/index?id=star-wang")
                ),
                ChatMessageDto.text("SLA：补齐后 48h 内复核完成。如果超时我会再 ping 你一次。")
        );
        return new BotConversationDto(bot, msgs);
    }

    // ── 数数：数据官 ──────────────────────────────────────────────────────────
    private BotConversationDto shu() {
        BotMetaDto bot = new BotMetaDto("shu", "数数", "数据官 · 在线",
                "#2A6FDB", "📊", "#fff");
        List<Map<String, Object>> items = List.of(
                Map.of("icon", "👁", "label", "曝光", "sub", "28.4w"),
                Map.of("icon", "🛒", "label", "订单", "sub", "1,284"),
                Map.of("icon", "¥", "label", "GMV", "sub", "4.8w"),
                Map.of("icon", "↑", "label", "转化", "sub", "+12%")
        );
        List<ChatMessageDto> msgs = List.of(
                ChatMessageDto.time("上午 08:30"),
                ChatMessageDto.text("昨日 12 条视频累计曝光 28.4w，转化率较前日 +12% 👏"),
                ChatMessageDto.cardGrid(
                        "昨日数据快报",
                        "7 日环比向好 · 数据已落账",
                        items,
                        Map.of("text", "查看完整看板", "route", "/pages/dashboard/index")
                ),
                ChatMessageDto.text("异常提醒：陈某某的视频 ROI 跌到 1.8x，建议复盘改脚本。")
        );
        return new BotConversationDto(bot, msgs);
    }

    // ── Ada：星探官 ───────────────────────────────────────────────────────────
    private BotConversationDto ada() {
        BotMetaDto bot = new BotMetaDto("ada", "Ada", "星探官 · 在线",
                "#1F8A5B", "★", "#C8FF00");
        List<Map<String, Object>> items = List.of(
                Map.of("icon", "★", "label", "王某某", "sub", "美妆 · 时尚"),
                Map.of("icon", "★", "label", "陈某某", "sub", "数码 · 科技"),
                Map.of("icon", "★", "label", "刘某某", "sub", "服饰 · 配饰"),
                Map.of("icon", "★", "label", "周某某", "sub", "母婴 · 教育")
        );
        List<ChatMessageDto> msgs = List.of(
                ChatMessageDto.time("上午 10:23"),
                ChatMessageDto.text("AI 供应链助手为你匹配到一批新明星，与你的店铺品类相符。"),
                ChatMessageDto.cardCta(
                        "明星授权邀请",
                        "诚邀您与「李某某 · 美食综艺」开启首条带货合作，本周通道免审核保证金、极速过审。",
                        true,
                        Map.of("icon", "👑", "title", "本周限时通道", "sub", "免保证金 · 极速审核"),
                        Map.of("text", "查看明星详情", "route", "/pages/celebrity-detail/index?id=star-li")
                ),
                ChatMessageDto.time("上午 10:25"),
                ChatMessageDto.text("另外还有 4 位刚开放授权的明星可以扫一眼："),
                ChatMessageDto.cardGrid(
                        "本周明星上新",
                        "成为核心带货方可解锁以下 4 位",
                        items,
                        Map.of("text", "去市场看看", "route", "/pages/market/index")
                )
        );
        return new BotConversationDto(bot, msgs);
    }

    // ── 长长：成长教练 ────────────────────────────────────────────────────────
    private BotConversationDto zhang() {
        BotMetaDto bot = new BotMetaDto("zhang", "长长", "成长教练 · 在线",
                "#9D5BFF", "◯", "#fff");
        List<Map<String, Object>> items = List.of(
                Map.of("icon", "①", "label", "提升 15s 占比", "sub", "完播率高 28%"),
                Map.of("icon", "②", "label", "加大美妆品类", "sub", "王某某适配度 9.4"),
                Map.of("icon", "③", "label", "调整发布时段", "sub", "20:00 流量更佳"),
                Map.of("icon", "④", "label", "延长授权时长", "sub", "30 天 → 60 天")
        );
        List<ChatMessageDto> msgs = List.of(
                ChatMessageDto.time("昨天 21:00"),
                ChatMessageDto.text("本周复盘已生成。基于过去 7 日数据，给你 3 条最有价值的建议："),
                ChatMessageDto.cardGrid(
                        "本周成长建议",
                        "按预期收益排序",
                        items,
                        Map.of("text", "查看完整复盘", "route", "/pages/dashboard/index")
                ),
                ChatMessageDto.text("下周一早上 9 点我会再推一次进度对比 📈")
        );
        return new BotConversationDto(bot, msgs);
    }
}
