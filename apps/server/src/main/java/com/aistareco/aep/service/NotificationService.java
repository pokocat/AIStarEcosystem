package com.aistareco.aep.service;

import com.aistareco.aep.dto.BotConversationDto;
import com.aistareco.aep.dto.BotMetaDto;
import com.aistareco.aep.dto.ChatMessageDto;
import com.aistareco.aep.dto.MessagesOverviewDto;
import com.aistareco.aep.model.CelebrityAuthStatus;
import com.aistareco.aep.model.Notification;
import com.aistareco.aep.repository.CelebrityProjectVideoRepository;
import com.aistareco.aep.repository.CelebrityStarAuthorizationRepository;
import com.aistareco.aep.repository.NotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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

    private final NotificationRepository notificationRepo;
    private final CelebrityStarAuthorizationRepository authRepo;
    private final CelebrityProjectVideoRepository videoRepo;

    public NotificationService(NotificationRepository notificationRepo,
                                CelebrityStarAuthorizationRepository authRepo,
                                CelebrityProjectVideoRepository videoRepo) {
        this.notificationRepo = notificationRepo;
        this.authRepo = authRepo;
        this.videoRepo = videoRepo;
    }

    /** 5 个 Bot 的元数据（与 chat 详情页 BotMetaDto 一致）。 */
    private static final List<Map<String, String>> BOTS = List.of(
            Map.of("botId", "pian",  "name", "片片", "role", "创作官", "color", "#0A0A0A", "roleBg", "#C8FF00", "roleColor", "#0A0A0A", "avatarIcon", "✦"),
            Map.of("botId", "shen",  "name", "审审", "role", "合规官", "color", "#FF7A1A", "roleBg", "#FFE7D2", "roleColor", "#FF7A1A", "avatarIcon", "✓"),
            Map.of("botId", "shu",   "name", "数数", "role", "数据官", "color", "#2A6FDB", "roleBg", "#E0EBFB", "roleColor", "#2A6FDB", "avatarIcon", "📊"),
            Map.of("botId", "ada",   "name", "Ada",  "role", "星探官", "color", "#1F8A5B", "roleBg", "#DCF1E5", "roleColor", "#1F8A5B", "avatarIcon", "★"),
            Map.of("botId", "zhang", "name", "长长", "role", "成长教练", "color", "#9D5BFF", "roleBg", "#EFE2FF", "roleColor", "#9D5BFF", "avatarIcon", "◯")
    );

    /**
     * v0.5.1：消息首页聚合 = 待办中心（按用户真实业务态聚合）+ Bot 会话预览（每个 Bot 一行）。
     * 替代原 GET /notifications 的 List<NotificationDto> shape（与 chat-only API 区分）。
     */
    public MessagesOverviewDto getMessagesOverview(String userId) {
        List<MessagesOverviewDto.TodoItemDto> todos = computeTodos(userId);
        List<MessagesOverviewDto.BotConversationPreviewDto> conversations = new ArrayList<>();
        for (Map<String, String> bot : BOTS) {
            String botId = bot.get("botId");
            // 取该 Bot 历史最近一条 Notification 的标题作为 preview；没有则回退 canned 第一条 text。
            List<Notification> mine = notificationRepo.findByUserIdAndBotIdOrderByCreatedAtDesc(userId, botId);
            String preview;
            String time;
            if (!mine.isEmpty()) {
                Notification latest = mine.get(0);
                preview = latest.getTitle() == null ? "" : latest.getTitle();
                time = relativeTime(latest.getCreatedAt());
            } else {
                preview = firstTextFromCanned(botId);
                time = "—";
            }
            int dot = (int) notificationRepo.countByUserIdAndBotIdAndReadFalse(userId, botId);
            conversations.add(new MessagesOverviewDto.BotConversationPreviewDto(
                    botId,
                    bot.get("name"),
                    bot.get("role"),
                    bot.get("color"),
                    bot.get("roleBg"),
                    bot.get("roleColor"),
                    bot.get("avatarIcon"),
                    preview,
                    time,
                    dot,
                    dot > 0
            ));
        }
        return new MessagesOverviewDto(todos, conversations);
    }

    /**
     * v0.5.1：把当前用户对该 Bot 的所有 Notification 标已读。chat 页打开时调用，清掉首页红点。
     * 返回受影响行数。
     */
    @Transactional
    public int markBotConversationRead(String userId, String botId) {
        List<Notification> mine = notificationRepo.findByUserIdAndBotIdOrderByCreatedAtDesc(userId, botId);
        int updated = 0;
        for (Notification n : mine) {
            if (!n.isRead()) {
                n.setRead(true);
                updated++;
            }
        }
        if (updated > 0) notificationRepo.saveAll(mine);
        return updated;
    }

    /** 计算待办：按当前用户真实业务态聚合。 */
    private List<MessagesOverviewDto.TodoItemDto> computeTodos(String userId) {
        // 1) 视频待审：用户的视频里 status="待审核" 数（项目维度按 ownerUserId 过滤待 v0.6 的项目-视频 join；
        //    本期回退到全量"待审核"或"生成中"的代理计数）
        long pendingVideos = videoRepo.findAll().stream()
                .filter(v -> "待审核".equals(v.getStatus()) || "生成中".equals(v.getStatus()))
                .count();
        // 2) 授权进度：用户的 PENDING 授权数
        long pendingAuth = authRepo.findByUserIdAndStatusIn(userId, List.of(CelebrityAuthStatus.PENDING)).size();
        // 3) 数据日报：未读的 system / achievement / data 类通知数（粗估为 1）
        long dailyReports = 1L;

        return List.of(
                new MessagesOverviewDto.TodoItemDto("视频待审", "AI 生成视频", (int) pendingVideos, true, "/pages/videos/index"),
                new MessagesOverviewDto.TodoItemDto("授权进度", "明星授权审核中", (int) pendingAuth, false, "/pages/celebrity-detail/index"),
                new MessagesOverviewDto.TodoItemDto("数据日报", "昨日 GMV 已结算", (int) dailyReports, false, "/pages/dashboard/index")
        );
    }

    /** Bot 历史无消息时，从 canned 会话拿第一条 text 作为预览兜底。 */
    private String firstTextFromCanned(String botId) {
        BotConversationDto conv = getConversation(botId);
        for (ChatMessageDto m : conv.messages()) {
            if ("text".equals(m.type()) && m.text() != null && !m.text().isBlank()) return m.text();
        }
        return "暂无消息";
    }

    private static String relativeTime(Instant t) {
        if (t == null) return "";
        long s = Duration.between(t, Instant.now()).getSeconds();
        if (s < 60) return s + "s";
        long m = s / 60;
        if (m < 60) return m + "min";
        long h = m / 60;
        if (h < 24) return h + "h";
        return (h / 24) + "d";
    }

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
