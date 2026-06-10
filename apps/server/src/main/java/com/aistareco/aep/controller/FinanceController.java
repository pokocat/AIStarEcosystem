package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MonthlyRevenuePointDto;
import com.aistareco.aep.dto.RevenueSourceDto;
import com.aistareco.aep.dto.TransactionDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 生产侧财务视图：/api/finance/*。
 * 月度营收曲线、来源占比、交易流水都基于当前用户的 {@link LedgerEntry} 聚合得到。
 */
@RestController
@RequestMapping("/api/finance")
public class FinanceController {

    private static final ZoneId TZ = ZoneId.of("Asia/Shanghai");
    private static final String[] REVENUE_COLORS = {
            "#06b6d4", "#a855f7", "#f59e0b", "#10b981",
            "#ec4899", "#6366f1", "#ef4444", "#14b8a6"
    };

    private final LedgerEntryRepository ledgerRepo;

    public FinanceController(LedgerEntryRepository ledgerRepo) {
        this.ledgerRepo = ledgerRepo;
    }

    /** 近 12 个月每月入账总额（credits 原始值）。 */
    @GetMapping("/revenue/monthly")
    public ApiResponse<List<MonthlyRevenuePointDto>> monthlyRevenue(Principal principal) {
        Instant since = LocalDate.now(TZ).withDayOfMonth(1).minusMonths(11)
                .atStartOfDay(TZ).toInstant();
        List<LedgerEntry> entries = ledgerRepo.findPositiveSince(principal.getName(), since);

        Map<String, Long> bucket = new LinkedHashMap<>();
        // 预填 12 个月的 0 值，保证曲线连续
        LocalDate cursor = LocalDate.now(TZ).withDayOfMonth(1).minusMonths(11);
        for (int i = 0; i < 12; i++) {
            bucket.put(monthKey(cursor), 0L);
            cursor = cursor.plusMonths(1);
        }
        for (LedgerEntry e : entries) {
            String key = monthKey(LocalDate.ofInstant(e.getCreatedAt(), TZ));
            bucket.merge(key, e.getAmount(), Long::sum);
        }

        List<MonthlyRevenuePointDto> out = bucket.entrySet().stream()
                .map(en -> new MonthlyRevenuePointDto(displayMonth(en.getKey()), en.getValue()))
                .toList();
        return ApiResponse.of(out);
    }

    /** 按 entryType 分桶的入账占比（百分比 0–100）。 */
    @GetMapping("/revenue/sources")
    public ApiResponse<List<RevenueSourceDto>> revenueSources(Principal principal) {
        List<Object[]> rows = ledgerRepo.aggregateIncomeByType(principal.getName());
        long total = rows.stream()
                .mapToLong(r -> r[1] == null ? 0 : ((Number) r[1]).longValue())
                .sum();
        if (total <= 0) return ApiResponse.of(List.of());

        List<RevenueSourceDto> out = new java.util.ArrayList<>();
        int i = 0;
        for (Object[] r : rows) {
            LedgerEntry.LedgerEntryType type = (LedgerEntry.LedgerEntryType) r[0];
            long amount = r[1] == null ? 0 : ((Number) r[1]).longValue();
            double pct = amount * 100.0 / total;
            out.add(new RevenueSourceDto(
                    sourceLabel(type),
                    (int) Math.round(pct),
                    REVENUE_COLORS[i % REVENUE_COLORS.length]
            ));
            i++;
        }
        return ApiResponse.of(out);
    }

    /** 当前用户的全部流水，倒序。 */
    @GetMapping("/transactions")
    public ApiResponse<List<TransactionDto>> transactions(Principal principal) {
        List<TransactionDto> out = ledgerRepo.findByUserIdOrderByCreatedAtDesc(principal.getName())
                .stream().map(FinanceController::projectTx).toList();
        return ApiResponse.of(out);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static String monthKey(LocalDate d) {
        return String.format(Locale.ROOT, "%04d-%02d", d.getYear(), d.getMonthValue());
    }

    private static String displayMonth(String key) {
        // "2026-04" → "4月"
        int m = Integer.parseInt(key.substring(5));
        return m + "月";
    }

    private static String sourceLabel(LedgerEntry.LedgerEntryType t) {
        if (t == null) return "其他";
        return switch (t) {
            case LICENSE_GRANT -> "激活码";
            case RECHARGE -> "充值";
            case REFUND -> "退款";
            case INCOME -> "业务收入";
            case GIFT -> "赠送";
            case SPEND -> "支出";
            case WITHDRAW -> "提现";
            case FREEZE -> "冻结";
            case UNFREEZE -> "解冻";
            case ADJUST -> "调整";
        };
    }

    private static TransactionDto projectTx(LedgerEntry e) {
        return new TransactionDto(
                e.getId(),
                e.getDescription() != null ? e.getDescription() :
                        (e.getEntryType() != null ? e.getEntryType().name() : ""),
                e.getAmount(),
                e.getCreatedAt() == null ? "" : e.getCreatedAt().toString().substring(0, 10),
                e.getCreatedAt(),
                "completed",
                txType(e.getEntryType()),
                e.getUserId(),
                // 用户自查自己的流水，无需回显登录名 / 昵称（wire 上省略）
                null,
                null
        );
    }

    private static String txType(LedgerEntry.LedgerEntryType t) {
        if (t == null) return "income";
        return switch (t) {
            case RECHARGE, REFUND -> "recharge";
            case LICENSE_GRANT -> "license_grant";
            case WITHDRAW -> "withdrawal";
            case SPEND, FREEZE -> "spend";
            default -> "income";
        };
    }
}
