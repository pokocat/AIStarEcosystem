package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MembershipDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.repository.MembershipRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

/**
 * Membership admin 接口。对齐前端 {@code apps/admin/src/api/tenants.ts} 的 listMemberships。
 * 仅提供只读列表；创建由 License 激活 / 管理员邀请流程负责。
 */
@RestController
@RequestMapping("/api/admin/memberships")
public class AdminMembershipController {

    private final MembershipRepository membershipRepo;

    public AdminMembershipController(MembershipRepository membershipRepo) {
        this.membershipRepo = membershipRepo;
    }

    @GetMapping
    public PageEnvelope<MembershipDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "500") int size,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String userId) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("joinedAt").descending());

        if (tenantId != null && !tenantId.isBlank()) {
            return PageEnvelope.from(
                    membershipRepo.findByTenantId(tenantId, pageable).map(MembershipDto::from));
        }
        if (userId != null && !userId.isBlank()) {
            java.util.List<MembershipDto> rows = membershipRepo.findByUserId(userId).stream()
                    .map(MembershipDto::from)
                    .toList();
            return new PageEnvelope<>(
                    true,
                    rows,
                    new PageEnvelope.PaginationMeta(0, rows.size(), rows.size(), 1, false, false),
                    null);
        }
        return PageEnvelope.from(membershipRepo.findAll(pageable).map(MembershipDto::from));
    }
}
