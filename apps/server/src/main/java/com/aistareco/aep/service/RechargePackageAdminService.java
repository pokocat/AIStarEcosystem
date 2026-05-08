package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdminRechargePackageUpsertDto;
import com.aistareco.aep.dto.RechargePackageDto;
import com.aistareco.aep.model.RechargePackage;
import com.aistareco.aep.repository.RechargePackageRepository;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 充值套餐 admin CRUD（v0.5 新增）。
 * 删除走软删（active=false），不真删（保留 ledger refId 引用）。
 */
@Service
@Transactional
public class RechargePackageAdminService {

    private final RechargePackageRepository repo;

    public RechargePackageAdminService(RechargePackageRepository repo) {
        this.repo = repo;
    }

    /** admin GET 全量：含 inactive。 */
    public List<RechargePackageDto> listAll() {
        return repo.findAll().stream()
                .sorted((a, b) -> {
                    int sa = a.getSortOrder() != null ? a.getSortOrder() : 0;
                    int sb = b.getSortOrder() != null ? b.getSortOrder() : 0;
                    return Integer.compare(sa, sb);
                })
                .map(RechargePackageDto::from)
                .toList();
    }

    public RechargePackageDto get(String id) {
        return RechargePackageDto.from(load(id));
    }

    public RechargePackageDto create(AdminRechargePackageUpsertDto req) {
        if (req == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PKG_BODY_REQUIRED", "body 必填");
        }
        if (req.credits() == null || req.credits() <= 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PKG_CREDITS_INVALID", "credits 必须 > 0");
        }
        if (req.priceCents() == null || req.priceCents() < 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PKG_PRICE_INVALID", "priceCents 不能为负");
        }
        String id = (req.id() != null && !req.id().isBlank())
                ? req.id()
                : "pkg-" + UUID.randomUUID().toString().substring(0, 8);
        if (repo.existsById(id)) {
            throw new BusinessException(HttpStatus.CONFLICT, "PKG_DUPLICATE", "套餐 id 已存在: " + id);
        }
        RechargePackage entity = applyUpsert(new RechargePackage(), req);
        entity.setId(id);
        return RechargePackageDto.from(repo.save(entity));
    }

    public RechargePackageDto update(String id, AdminRechargePackageUpsertDto req) {
        RechargePackage entity = load(id);
        applyUpsert(entity, req);
        return RechargePackageDto.from(repo.save(entity));
    }

    /** 软删：active=false（保留 ledger 引用）。 */
    public RechargePackageDto softDelete(String id) {
        RechargePackage entity = load(id);
        entity.setActive(false);
        return RechargePackageDto.from(repo.save(entity));
    }

    // ── 内部 ───────────────────────────────────────────────────────────────

    private RechargePackage load(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PKG_NOT_FOUND", "套餐不存在"));
    }

    private RechargePackage applyUpsert(RechargePackage entity, AdminRechargePackageUpsertDto req) {
        if (req.credits() != null) entity.setCredits(req.credits());
        if (req.priceCents() != null) entity.setPriceCents(req.priceCents());
        if (req.tag() != null) entity.setTag(req.tag());
        if (req.recommended() != null) entity.setRecommended(req.recommended());
        if (req.bonusCredits() != null) entity.setBonusCredits(req.bonusCredits());
        if (req.sortOrder() != null) entity.setSortOrder(req.sortOrder());
        if (req.active() != null) entity.setActive(req.active());
        // 必填兜底
        if (entity.getTag() == null) entity.setTag("套餐");
        return entity;
    }
}
