package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapStarGrantDto;
import com.aistareco.aep.model.CelebrityAuthStatus;
import com.aistareco.aep.model.CelebrityStar;
import com.aistareco.aep.model.CelebrityStarAuthorization;
import com.aistareco.aep.repository.CelebrityStarAuthorizationRepository;
import com.aistareco.aep.repository.CelebrityStarRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 资产中枢 P2 · 明星授权只读投影。
 *
 * 读取当前用户在带货线获得 / 申请中的明星授权（celebrity 域真值），供中枢货架与
 * 授权中心「授权给我的」展示。UNAUTHORIZED（未申请 / 被驳回后清零）不投影 ——
 * 它不代表任何授权关系。排序：生效中 → 审批中 → 已到期，同组内按更新时间倒序。
 */
@Service
public class DapStarGrantService {

    private static final Map<CelebrityAuthStatus, Integer> STATUS_ORDER = Map.of(
            CelebrityAuthStatus.AUTHORIZED, 0,
            CelebrityAuthStatus.PENDING, 1,
            CelebrityAuthStatus.EXPIRED, 2
    );

    private final CelebrityStarAuthorizationRepository authorizations;
    private final CelebrityStarRepository stars;

    public DapStarGrantService(CelebrityStarAuthorizationRepository authorizations, CelebrityStarRepository stars) {
        this.authorizations = authorizations;
        this.stars = stars;
    }

    @Transactional(readOnly = true)
    public List<DapStarGrantDto> list(String userId) {
        List<CelebrityStarAuthorization> rows = authorizations.findByUserId(userId).stream()
                .filter(a -> a.getStatus() != null && a.getStatus() != CelebrityAuthStatus.UNAUTHORIZED)
                .toList();
        if (rows.isEmpty()) return List.of();
        Map<String, CelebrityStar> starById = stars.findAllById(
                        rows.stream().map(CelebrityStarAuthorization::getStarId).distinct().toList()).stream()
                .collect(Collectors.toMap(CelebrityStar::getId, Function.identity()));
        return rows.stream()
                .sorted(Comparator
                        .comparing((CelebrityStarAuthorization a) -> STATUS_ORDER.getOrDefault(a.getStatus(), 9))
                        .thenComparing(CelebrityStarAuthorization::getUpdatedAt,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .map(a -> DapStarGrantDto.from(a, starById.get(a.getStarId())))
                .toList();
    }
}
