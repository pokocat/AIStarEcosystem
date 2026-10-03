package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.service.AccountSelfService;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.security.Principal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * /me/ledger 连续翻页不重、不漏。
 *
 * <p>web-drama 的「收入与提现」按 offset 一页页往前翻找收入 / 提现（`_shared/ledger.ts` 的 scanLedger）。
 * 只按 createdAt 排时，同一时刻的几条在不同请求之间先后不固定（MySQL 对非唯一列 ORDER BY + LIMIT/OFFSET
 * 不保证稳定），页边界上那条可能两页都没有。
 *
 * <p>这里用一个「每次请求都把同值记录重新洗一遍」的假库模拟数据库对并列值的任意顺序，
 * 然后照控制器实际传下去的 Sort 排序、切页。
 */
class AccountControllerLedgerPagingTest {

    private static final Instant SAME_MOMENT = Instant.parse("2026-09-28T01:00:00.123456Z");

    /** 假库：并列值的相对顺序每次请求都不同（固定种子，结果可复现）；只认 createdAt / id 两个排序键。 */
    private static Page<LedgerEntryDto> query(List<LedgerEntryDto> table, Pageable pageable, Random rnd) {
        List<LedgerEntryDto> rows = new ArrayList<>(table);
        Collections.shuffle(rows, rnd);
        Comparator<LedgerEntryDto> cmp = (a, b) -> 0;
        for (Sort.Order o : pageable.getSort()) {
            Comparator<LedgerEntryDto> key = switch (o.getProperty()) {
                case "createdAt" -> Comparator.comparing(LedgerEntryDto::createdAt);
                case "id" -> Comparator.comparing(LedgerEntryDto::id);
                default -> throw new AssertionError("假库不认识的排序键: " + o.getProperty());
            };
            cmp = cmp.thenComparing(o.isDescending() ? key.reversed() : key);
        }
        rows.sort(cmp); // List.sort 稳定：Sort 分不出先后的，保留洗牌后的随机顺序
        int from = (int) Math.min(pageable.getOffset(), rows.size());
        int to = Math.min(from + pageable.getPageSize(), rows.size());
        return new PageImpl<>(rows.subList(from, to), pageable, rows.size());
    }

    private static List<LedgerEntryDto> sameMomentEntries(int n) {
        List<LedgerEntryDto> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            out.add(new LedgerEntryDto("le-" + String.format("%03d", i), "w", "u", null, null, null,
                    i % 7 == 0 ? "income" : "spend", i % 7 == 0 ? 100 : -10, 1000, "entry " + i,
                    null, null, SAME_MOMENT));
        }
        return out;
    }

    /** 从第 0 页翻到某一页条数少于 size，返回翻到的全部 id（含重复）。 */
    private static List<String> pageThrough(AccountController controller, int size) {
        Principal me = () -> "u";
        List<String> seen = new ArrayList<>();
        for (int page = 0; page < 100; page++) {
            PageEnvelope<LedgerEntryDto> env = controller.ledger(me, page, size);
            env.data().forEach(e -> seen.add(e.id()));
            if (env.data().size() < size) break;
        }
        return seen;
    }

    private static AccountController controllerOver(List<LedgerEntryDto> table, Random rnd) {
        AccountSelfService svc = mock(AccountSelfService.class);
        when(svc.listLedger(eq("u"), any(Pageable.class)))
                .thenAnswer(inv -> query(table, inv.getArgument(1, Pageable.class), rnd));
        return new AccountController(svc, null, null, null, null, null, null, null, null);
    }

    @Test
    void pagingThroughEntriesWithTheSameTimestampSeesEachEntryExactlyOnce() {
        List<LedgerEntryDto> table = sameMomentEntries(35);
        List<String> seen = pageThrough(controllerOver(table, new Random(42)), 10);

        assertEquals(table.size(), seen.size(), "不重：每条只出现一次");
        assertEquals(table.stream().map(LedgerEntryDto::id).collect(Collectors.toSet()),
                new HashSet<>(seen), "不漏：每条都翻到了");
    }

    @Test
    void sortEndsWithAUniqueKey() {
        List<Sort.Order> orders = AccountController.LEDGER_SORT.toList();
        assertEquals("createdAt", orders.get(0).getProperty());
        assertTrue(orders.get(0).isDescending(), "新的在前");
        assertEquals("id", orders.get(orders.size() - 1).getProperty(), "最后一个排序键必须唯一，顺序才是全序");
    }

    /**
     * 对照组：证明上面的假库**能**暴露问题（§8.0.1 ②，先确认信号成立）。
     * 只按 createdAt 排、同一时刻的记录一多，就会出现漏掉 / 重复。
     */
    @Test
    void theFakeTableDoesExposeTheProblemWhenOnlyCreatedAtIsUsed() {
        List<LedgerEntryDto> table = sameMomentEntries(35);
        Random rnd = new Random(42);
        Set<String> seen = new HashSet<>();
        int rowsSeen = 0;
        Sort createdAtOnly = Sort.by("createdAt").descending();
        for (int page = 0; page < 4; page++) {
            Page<LedgerEntryDto> p = query(table, PageRequest.of(page, 10, createdAtOnly), rnd);
            rowsSeen += p.getContent().size();
            p.getContent().forEach(e -> seen.add(e.id()));
        }
        assertEquals(table.size(), rowsSeen);
        assertTrue(seen.size() < table.size(), "只按 createdAt 排时，翻完一遍应当有记录没翻到");
    }
}
