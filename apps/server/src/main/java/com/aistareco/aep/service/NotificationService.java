package com.aistareco.aep.service;

import com.aistareco.aep.dto.BotConversationDto;
import com.aistareco.aep.dto.BotMetaDto;
import com.aistareco.aep.dto.ChatMessageDto;
import com.aistareco.aep.dto.MessagesOverviewDto;
import com.aistareco.aep.model.CelebrityAuthStatus;
import com.aistareco.aep.model.CelebrityProject;
import com.aistareco.aep.model.CelebrityProjectVideo;
import com.aistareco.aep.model.CelebrityStar;
import com.aistareco.aep.model.CelebrityStarAuthorization;
import com.aistareco.aep.model.UserBotReadState;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.CelebrityProjectRepository;
import com.aistareco.aep.repository.CelebrityProjectVideoRepository;
import com.aistareco.aep.repository.CelebrityStarAuthorizationRepository;
import com.aistareco.aep.repository.CelebrityStarRepository;
import com.aistareco.aep.repository.UserBotReadStateRepository;
import com.aistareco.aep.repository.WalletRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * AI Bot 同事会话服务（v0.5.2 重写）。
 *
 * 设计：**按需查询代替事件总线**。
 * 用户每次打开 chat / 消息首页，server 即时查询其真实业务实体（CelebrityProjectVideo
 * / CelebrityStarAuthorization / CelebrityStar / Wallet 等），用各 Bot 的"作曲"函数
 * 把这些数据合成 ChatMessageDto[] 流。
 *
 * 未读 dot：基于 UserBotReadState.lastReadAt 做"自上次已读以来的变化"freshness 比较。
 * markBotConversationRead 把 lastReadAt = now，下次打开 dot 自然清零。
 *
 * 不需要消息队列、推送通道或事件总线。所有 Bot 消息都是函数式的"当前业务态投影"。
 */
@Service
public class NotificationService {

    private final CelebrityProjectRepository projectRepo;
    private final CelebrityProjectVideoRepository videoRepo;
    private final CelebrityStarAuthorizationRepository authRepo;
    private final CelebrityStarRepository starRepo;
    private final WalletRepository walletRepo;
    private final UserBotReadStateRepository readRepo;

    public NotificationService(CelebrityProjectRepository projectRepo,
                                CelebrityProjectVideoRepository videoRepo,
                                CelebrityStarAuthorizationRepository authRepo,
                                CelebrityStarRepository starRepo,
                                WalletRepository walletRepo,
                                UserBotReadStateRepository readRepo) {
        this.projectRepo = projectRepo;
        this.videoRepo = videoRepo;
        this.authRepo = authRepo;
        this.starRepo = starRepo;
        this.walletRepo = walletRepo;
        this.readRepo = readRepo;
    }

    // ── Bot 元数据（5 个 AI 同事） ─────────────────────────────────────────
    private static final BotMetaDto BOT_PIAN  = new BotMetaDto("pian",  "片片", "创作官 · 在线",   "#0A0A0A", "✦", "#C8FF00");
    private static final BotMetaDto BOT_SHEN  = new BotMetaDto("shen",  "审审", "合规官 · 在线",   "#FF7A1A", "✓", "#fff");
    private static final BotMetaDto BOT_SHU   = new BotMetaDto("shu",   "数数", "数据官 · 在线",   "#2A6FDB", "📊", "#fff");
    private static final BotMetaDto BOT_ADA   = new BotMetaDto("ada",   "Ada",  "星探官 · 在线",   "#1F8A5B", "★", "#C8FF00");
    private static final BotMetaDto BOT_ZHANG = new BotMetaDto("zhang", "长长", "成长教练 · 在线", "#9D5BFF", "◯", "#fff");

    private static final List<BotMetaDto> ALL_BOTS = List.of(BOT_PIAN, BOT_SHEN, BOT_SHU, BOT_ADA, BOT_ZHANG);

    // ── 公共入口 ───────────────────────────────────────────────────────────

    /** 取单 Bot 完整会话流（chat 详情页消费）。 */
    public BotConversationDto getConversation(String botId, String userId) {
        if (userId == null || userId.isBlank()) userId = "demo-user";
        return switch (botId) {
            case "pian"  -> composePian(userId);
            case "shen"  -> composeShen(userId);
            case "shu"   -> composeShu(userId);
            case "ada"   -> composeAda(userId);
            case "zhang" -> composeZhang(userId);
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "未知 botId：" + botId + "（仅支持 pian/shen/shu/ada/zhang）");
        };
    }

    /** 兼容旧签名（无 userId）：用 demo-user 兜底。 */
    public BotConversationDto getConversation(String botId) {
        return getConversation(botId, "demo-user");
    }

    /**
     * 消息首页聚合 = 待办中心（业务态聚合）+ 5 Bot 会话预览（含 dot）。
     */
    public MessagesOverviewDto getMessagesOverview(String userId) {
        if (userId == null || userId.isBlank()) userId = "demo-user";
        List<MessagesOverviewDto.TodoItemDto> todos = computeTodos(userId);
        List<MessagesOverviewDto.BotConversationPreviewDto> conversations = new ArrayList<>();
        for (BotMetaDto bot : ALL_BOTS) {
            BotConversationDto conv = getConversation(bot.id(), userId);
            String preview = firstTextOf(conv);
            int dot = computeUnreadDot(bot.id(), userId);
            conversations.add(new MessagesOverviewDto.BotConversationPreviewDto(
                    bot.id(),
                    bot.name(),
                    extractRole(bot.subtitle()),
                    bot.avatarColor(),
                    roleBgFor(bot.id()),
                    roleColorFor(bot.id()),
                    bot.avatarIcon(),
                    preview,
                    relativeTime(latestSourceTime(bot.id(), userId)),
                    dot,
                    dot > 0
            ));
        }
        return new MessagesOverviewDto(todos, conversations);
    }

    /** 把当前用户对该 Bot 的 lastReadAt 推进到 now，下次打开首页 dot=0。 */
    @Transactional
    public int markBotConversationRead(String userId, String botId) {
        if (userId == null || userId.isBlank()) userId = "demo-user";
        String pk = UserBotReadState.compositeId(userId, botId);
        UserBotReadState st = readRepo.findById(pk).orElse(null);
        Instant now = Instant.now();
        if (st == null) {
            st = UserBotReadState.builder()
                    .id(pk).userId(userId).botId(botId).lastReadAt(now)
                    .build();
        } else {
            st.setLastReadAt(now);
        }
        readRepo.save(st);
        return 1;
    }

    // ── 待办中心 ───────────────────────────────────────────────────────────

    private List<MessagesOverviewDto.TodoItemDto> computeTodos(String userId) {
        Set<String> myProjectIds = projectRepo.findByOwnerUserIdOrderByCreatedAtDesc(userId).stream()
                .map(CelebrityProject::getId).collect(java.util.stream.Collectors.toSet());
        long pendingVideos = videoRepo.findAll().stream()
                .filter(v -> myProjectIds.contains(v.getProjectId()))
                .filter(v -> "待审核".equals(v.getStatus()) || "生成中".equals(v.getStatus()))
                .count();
        long pendingAuth = authRepo.findByUserIdAndStatusIn(userId, List.of(CelebrityAuthStatus.PENDING)).size();
        long dailyReports = 1L; // dashboard 接入后改为真实未读统计
        return List.of(
                new MessagesOverviewDto.TodoItemDto("视频待审", "AI 生成视频", (int) pendingVideos, true,  "/pages/videos/index"),
                new MessagesOverviewDto.TodoItemDto("授权进度", "明星授权审核中",  (int) pendingAuth,    false, "/pages/celebrity-detail/index"),
                new MessagesOverviewDto.TodoItemDto("数据日报", "昨日 GMV 已结算",  (int) dailyReports,   false, "/pages/dashboard/index")
        );
    }

    // ── 片片 · 创作官 ──────────────────────────────────────────────────────
    // 数据源：用户的视频（CelebrityProjectVideo 通过 ownerUserId 项目反查）

    private BotConversationDto composePian(String userId) {
        List<CelebrityProjectVideo> myVideos = userVideos(userId);
        long generating = myVideos.stream().filter(v -> "生成中".equals(v.getStatus())).count();
        long pending    = myVideos.stream().filter(v -> "待审核".equals(v.getStatus())).count();
        long published  = myVideos.stream().filter(v -> "已发布".equals(v.getStatus())).count();
        Optional<CelebrityProjectVideo> latestPub = myVideos.stream()
                .filter(v -> "已发布".equals(v.getStatus()))
                .findFirst();

        List<ChatMessageDto> msgs = new ArrayList<>();
        msgs.add(ChatMessageDto.time(humanTime(Instant.now())));
        if (latestPub.isPresent()) {
            CelebrityProjectVideo v = latestPub.get();
            msgs.add(ChatMessageDto.text("老板早～你的「" + safe(v.getStarName()) + " · " + safe(v.getProductName()) + "」已发布 🎬"));
            msgs.add(ChatMessageDto.cardCta(
                    "已发布 · 数据滚动中",
                    "建议加个产品特写镜头会更出片，复制并改只需 30 秒。",
                    true,
                    Map.of("icon", "▶", "title", v.getId(), "sub", safe(v.getStarName()) + " · " + safe(v.getProductName())),
                    Map.of("text", "去查看 / 复制改", "route", "/pages/video-detail/index?id=" + v.getId())
            ));
        } else if (myVideos.isEmpty()) {
            msgs.add(ChatMessageDto.text("还没有视频任务。从工作台开始第一条带货视频吧～"));
            msgs.add(ChatMessageDto.cardCta(
                    "新建视频",
                    "选明星 / 选商品 / 选风格 / AI 生成 — 只需 30 秒。",
                    true,
                    null,
                    Map.of("text", "前往生成器", "route", "/pages/generator/index")
            ));
        } else {
            msgs.add(ChatMessageDto.text("当前还没有已发布视频，先看看草稿和生成中？"));
        }

        if (generating > 0 || pending > 0) {
            String body = "当前有 " + generating + " 条生成中、" + pending + " 条待审核、" + published + " 条已发布。";
            msgs.add(ChatMessageDto.text("我帮你梳理了下任务："));
            msgs.add(ChatMessageDto.cardCta("视频任务概览", body, false, null,
                    Map.of("text", "前往视频中心", "route", "/pages/videos/index")));
        }
        return new BotConversationDto(BOT_PIAN, msgs);
    }

    // ── 审审 · 合规官 ──────────────────────────────────────────────────────
    // 数据源：用户的授权关系（CelebrityStarAuthorization）

    private BotConversationDto composeShen(String userId) {
        List<CelebrityStarAuthorization> auths = authRepo.findByUserId(userId);
        List<CelebrityStarAuthorization> pending = auths.stream()
                .filter(a -> a.getStatus() == CelebrityAuthStatus.PENDING).toList();
        List<CelebrityStarAuthorization> authorized = auths.stream()
                .filter(a -> a.getStatus() == CelebrityAuthStatus.AUTHORIZED).toList();

        List<ChatMessageDto> msgs = new ArrayList<>();
        msgs.add(ChatMessageDto.time(humanTime(Instant.now())));
        if (auths.isEmpty()) {
            msgs.add(ChatMessageDto.text("你还没有任何明星授权，去市场挑一个开始吧。"));
            msgs.add(ChatMessageDto.cardCta("申请授权", "选定明星后我会帮你跟进资质审核。", true, null,
                    Map.of("text", "去明星市场", "route", "/pages/market/index")));
            return new BotConversationDto(BOT_SHEN, msgs);
        }
        msgs.add(ChatMessageDto.text("已为你梳理授权进度：当前 " + authorized.size() + " 项已授权、"
                + pending.size() + " 项审核中。"));
        for (CelebrityStarAuthorization a : pending) {
            CelebrityStar star = starRepo.findById(a.getStarId()).orElse(null);
            String starName = star != null ? star.getName() : a.getStarId();
            msgs.add(ChatMessageDto.cardForm(
                    "审核中：" + starName,
                    Map.of("text", "待完善", "tone", "warn"),
                    List.of(
                            Map.of("label", "授权场景", "value",
                                    a.getScenes() != null && !a.getScenes().isEmpty() ? String.join(", ", a.getScenes()) : "—"),
                            Map.of("label", "状态", "value", "审核中（48h SLA）"),
                            Map.of("label", "备注", "value", a.getPendingNote() != null ? a.getPendingNote() : "—")
                    ),
                    Map.of("text", "上传剩余资质", "route", "/pages/celebrity-detail/index?id=" + a.getStarId())
            ));
        }
        if (pending.isEmpty()) {
            msgs.add(ChatMessageDto.text("所有授权都已就绪 🎉 可以放心生成视频了。"));
        }
        return new BotConversationDto(BOT_SHEN, msgs);
    }

    // ── 数数 · 数据官 ──────────────────────────────────────────────────────
    // 数据源：用户的视频统计 + 钱包余额

    private BotConversationDto composeShu(String userId) {
        List<CelebrityProjectVideo> myVideos = userVideos(userId);
        long total = myVideos.size();
        long published = myVideos.stream().filter(v -> "已发布".equals(v.getStatus())).count();
        long playsTotal = myVideos.stream().mapToLong(v -> parseShortPlays(v.getPlays())).sum();
        Optional<Wallet> wallet = walletRepo.findByUserId(userId);
        long balance = wallet.map(Wallet::getTotalBalance).orElse(0L);

        List<ChatMessageDto> msgs = new ArrayList<>();
        msgs.add(ChatMessageDto.time(humanTime(Instant.now())));
        if (total == 0) {
            msgs.add(ChatMessageDto.text("还没有数据可分析；生成第一条视频后，我会每天给你做日报。"));
            return new BotConversationDto(BOT_SHU, msgs);
        }
        msgs.add(ChatMessageDto.text("最新数据快报："));
        msgs.add(ChatMessageDto.cardGrid(
                "你的视频 · 全周期",
                "数据已落账",
                List.of(
                        Map.of("icon", "🎬", "label", "总视频", "sub", String.valueOf(total)),
                        Map.of("icon", "📤", "label", "已发布", "sub", String.valueOf(published)),
                        Map.of("icon", "👁", "label", "累计曝光", "sub", formatPlays(playsTotal)),
                        Map.of("icon", "💎", "label", "积分余额", "sub", String.valueOf(balance))
                ),
                Map.of("text", "查看完整看板", "route", "/pages/dashboard/index")
        ));
        return new BotConversationDto(BOT_SHU, msgs);
    }

    // ── Ada · 星探官 ───────────────────────────────────────────────────────
    // 数据源：未授权的明星（用户能看到的市场上新）

    private BotConversationDto composeAda(String userId) {
        Set<String> mine = authRepo.findByUserId(userId).stream()
                .map(CelebrityStarAuthorization::getStarId).collect(java.util.stream.Collectors.toSet());
        List<CelebrityStar> recommendable = starRepo.findAll().stream()
                .filter(s -> !mine.contains(s.getId()))
                .limit(4).toList();

        List<ChatMessageDto> msgs = new ArrayList<>();
        msgs.add(ChatMessageDto.time(humanTime(Instant.now())));
        if (recommendable.isEmpty()) {
            msgs.add(ChatMessageDto.text("你已经把市场上的明星都拿下了，太厉害啦 🚀"));
            return new BotConversationDto(BOT_ADA, msgs);
        }
        msgs.add(ChatMessageDto.text("AI 供应链助手为你匹配到一批新明星，与你的店铺品类相符。"));
        if (!recommendable.isEmpty()) {
            CelebrityStar first = recommendable.get(0);
            msgs.add(ChatMessageDto.cardCta(
                    "明星授权邀请",
                    "诚邀您与「" + first.getName() + " · " + safe(first.getCategory())
                            + "」开启首条带货合作，本周通道免审核保证金、极速过审。",
                    true,
                    Map.of("icon", "👑", "title", "本周限时通道", "sub", "免保证金 · 极速审核"),
                    Map.of("text", "查看明星详情", "route", "/pages/celebrity-detail/index?id=" + first.getId())
            ));
        }
        if (recommendable.size() > 1) {
            List<Map<String, Object>> grid = new ArrayList<>();
            for (CelebrityStar s : recommendable.subList(1, Math.min(recommendable.size(), 5))) {
                String sub = s.getSubCategories() != null && !s.getSubCategories().isEmpty()
                        ? s.getSubCategories().get(0) : safe(s.getCategory());
                grid.add(Map.of("icon", "★", "label", s.getName(), "sub", sub));
            }
            msgs.add(ChatMessageDto.text("还有这些可以扫一眼："));
            msgs.add(ChatMessageDto.cardGrid(
                    "本周明星上新",
                    "成为核心带货方可解锁",
                    grid,
                    Map.of("text", "去市场看看", "route", "/pages/market/index")
            ));
        }
        return new BotConversationDto(BOT_ADA, msgs);
    }

    // ── 长长 · 成长教练 ────────────────────────────────────────────────────
    // 数据源：用户视频统计 + 已授权明星，给出本周建议

    private BotConversationDto composeZhang(String userId) {
        List<CelebrityProjectVideo> myVideos = userVideos(userId);
        List<CelebrityStarAuthorization> auths = authRepo.findByUserId(userId);
        long videosCount = myVideos.size();
        long s15 = myVideos.stream().filter(v -> v.getDurationSec() == 15).count();
        long s30 = myVideos.stream().filter(v -> v.getDurationSec() == 30).count();
        long authorized = auths.stream().filter(a -> a.getStatus() == CelebrityAuthStatus.AUTHORIZED).count();

        List<ChatMessageDto> msgs = new ArrayList<>();
        msgs.add(ChatMessageDto.time(humanTime(Instant.now())));
        if (videosCount == 0) {
            msgs.add(ChatMessageDto.text("还没有数据可复盘。生成 3 条视频后，我会给你定向建议。"));
            return new BotConversationDto(BOT_ZHANG, msgs);
        }
        msgs.add(ChatMessageDto.text("基于过去 7 日数据，给你 3 条最有价值的建议："));
        List<Map<String, Object>> tips = new ArrayList<>();
        if (s15 < s30) {
            tips.add(Map.of("icon", "①", "label", "提升 15s 占比", "sub", "完播率高 28%"));
        }
        if (authorized < 3) {
            tips.add(Map.of("icon", "②", "label", "扩大授权矩阵", "sub", "建议至少 3 位"));
        } else {
            tips.add(Map.of("icon", "②", "label", "深耕优质明星", "sub", "Top 1 明星投入加倍"));
        }
        tips.add(Map.of("icon", "③", "label", "调整发布时段", "sub", "20:00 流量更佳"));
        tips.add(Map.of("icon", "④", "label", "本周目标", "sub", "比上周多 " + Math.max(1, videosCount / 2) + " 条"));
        msgs.add(ChatMessageDto.cardGrid("本周成长建议", "按预期收益排序", tips,
                Map.of("text", "查看完整复盘", "route", "/pages/dashboard/index")));
        return new BotConversationDto(BOT_ZHANG, msgs);
    }

    // ── 内部工具 ───────────────────────────────────────────────────────────

    private List<CelebrityProjectVideo> userVideos(String userId) {
        Set<String> projectIds = projectRepo.findByOwnerUserIdOrderByCreatedAtDesc(userId).stream()
                .map(CelebrityProject::getId).collect(java.util.stream.Collectors.toSet());
        if (projectIds.isEmpty()) return List.of();
        return videoRepo.findAllByOrderByCreatedAtDesc().stream()
                .filter(v -> projectIds.contains(v.getProjectId())).toList();
    }

    /**
     * 未读 dot：基于 lastReadAt + freshness 比较。每个 Bot 自己定义"什么算 fresh"。
     *
     * 简化策略（避免对每个数据源都加 createdAt 索引）：
     *   - 取 lastReadAt；如不存在视为 epoch（一切都算 fresh）
     *   - 比较各 Bot 数据源的"代表时间"是否晚于 lastReadAt
     */
    private int computeUnreadDot(String botId, String userId) {
        Instant lastRead = readRepo.findByUserIdAndBotId(userId, botId)
                .map(UserBotReadState::getLastReadAt).orElse(Instant.EPOCH);
        switch (botId) {
            case "pian": {
                long c = userVideos(userId).stream()
                        .filter(v -> v.getStatus() != null
                                && (v.getStatus().equals("生成中") || v.getStatus().equals("待审核") || v.getStatus().equals("已发布")))
                        .filter(v -> v.getCreatedAt() != null
                                && v.getCreatedAt().atStartOfDay(java.time.ZoneOffset.UTC).toInstant().isAfter(lastRead))
                        .count();
                return (int) Math.min(99, c);
            }
            case "shen": {
                long c = authRepo.findByUserId(userId).stream()
                        .filter(a -> a.getStatus() == CelebrityAuthStatus.PENDING)
                        .filter(a -> a.getUpdatedAt() != null && a.getUpdatedAt().isAfter(lastRead))
                        .count();
                return (int) Math.min(99, c);
            }
            case "shu": {
                // 数据日报：自上次已读以来 ≥ 24h，视为有新日报
                return Duration.between(lastRead, Instant.now()).toHours() >= 24 ? 1 : 0;
            }
            case "ada": {
                Set<String> mine = authRepo.findByUserId(userId).stream()
                        .map(CelebrityStarAuthorization::getStarId).collect(java.util.stream.Collectors.toSet());
                long c = starRepo.findAll().stream()
                        .filter(s -> !mine.contains(s.getId()))
                        .count();
                return c > 0 && lastRead.isBefore(Instant.now().minusSeconds(3600)) ? 1 : 0;
            }
            case "zhang": {
                // 周复盘：自上次已读以来 ≥ 7d，视为有新复盘
                return Duration.between(lastRead, Instant.now()).toDays() >= 7 ? 1 : 0;
            }
            default: return 0;
        }
    }

    /** 取 Bot 数据源最近一次变化时间，用于消息首页 time 列。 */
    private Instant latestSourceTime(String botId, String userId) {
        switch (botId) {
            case "pian": {
                return userVideos(userId).stream()
                        .map(v -> v.getCreatedAt() == null ? null
                                : v.getCreatedAt().atStartOfDay(java.time.ZoneOffset.UTC).toInstant())
                        .filter(java.util.Objects::nonNull)
                        .max(java.util.Comparator.naturalOrder())
                        .orElse(Instant.now());
            }
            case "shen": {
                return authRepo.findByUserId(userId).stream()
                        .map(CelebrityStarAuthorization::getUpdatedAt).filter(java.util.Objects::nonNull)
                        .max(java.util.Comparator.naturalOrder()).orElse(Instant.now());
            }
            default: return Instant.now();
        }
    }

    private static String firstTextOf(BotConversationDto conv) {
        for (ChatMessageDto m : conv.messages()) {
            if ("text".equals(m.type()) && m.text() != null && !m.text().isBlank()) return m.text();
        }
        return "暂无消息";
    }

    private static String relativeTime(Instant t) {
        if (t == null) return "";
        long s = Duration.between(t, Instant.now()).getSeconds();
        if (s < 60) return Math.max(0, s) + "s";
        long m = s / 60;
        if (m < 60) return m + "min";
        long h = m / 60;
        if (h < 24) return h + "h";
        return (h / 24) + "d";
    }

    private static String humanTime(Instant t) {
        long s = Duration.between(t, Instant.now()).getSeconds();
        if (s < 300) return "刚刚";
        if (s < 3600) return (s / 60) + " 分钟前";
        if (s < 86400) return (s / 3600) + " 小时前";
        return (s / 86400) + " 天前";
    }

    private static String safe(String s) { return s == null ? "" : s; }

    private static String extractRole(String subtitle) {
        if (subtitle == null) return "";
        int i = subtitle.indexOf(' ');
        return i > 0 ? subtitle.substring(0, i) : subtitle;
    }

    private static String roleBgFor(String botId) {
        return switch (botId) {
            case "pian" -> "#C8FF00";
            case "shen" -> "#FFE7D2";
            case "shu"  -> "#E0EBFB";
            case "ada"  -> "#DCF1E5";
            case "zhang"-> "#EFE2FF";
            default -> "#F2F2EE";
        };
    }
    private static String roleColorFor(String botId) {
        return switch (botId) {
            case "pian" -> "#0A0A0A";
            case "shen" -> "#FF7A1A";
            case "shu"  -> "#2A6FDB";
            case "ada"  -> "#1F8A5B";
            case "zhang"-> "#9D5BFF";
            default -> "#0A0A0A";
        };
    }

    private static long parseShortPlays(String plays) {
        if (plays == null || plays.isBlank() || "—".equals(plays)) return 0;
        try {
            String s = plays.trim().toUpperCase();
            double mult = 1.0;
            if (s.endsWith("K")) { mult = 1_000; s = s.substring(0, s.length() - 1); }
            else if (s.endsWith("M")) { mult = 1_000_000; s = s.substring(0, s.length() - 1); }
            else if (s.endsWith("W")) { mult = 10_000; s = s.substring(0, s.length() - 1); }
            return (long) (Double.parseDouble(s) * mult);
        } catch (Exception e) { return 0; }
    }

    private static String formatPlays(long n) {
        if (n >= 10_000) return String.format("%.1fw", n / 10_000.0);
        if (n >= 1_000)  return String.format("%.1fK", n / 1_000.0);
        return String.valueOf(n);
    }
}
