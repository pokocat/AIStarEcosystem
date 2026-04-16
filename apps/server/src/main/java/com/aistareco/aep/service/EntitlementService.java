package com.aistareco.aep.service;

import com.aistareco.aep.dto.EntitlementDto;
import com.aistareco.aep.model.Entitlement;
import com.aistareco.aep.repository.EntitlementRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class EntitlementService {

    private final EntitlementRepository entitlementRepo;

    public EntitlementService(EntitlementRepository entitlementRepo) {
        this.entitlementRepo = entitlementRepo;
    }

    public Page<EntitlementDto> list(String tenantId, String productId, Pageable pageable) {
        Page<Entitlement> page;
        if (tenantId != null && productId != null) {
            page = entitlementRepo.findByTenantIdAndProductId(tenantId, productId, pageable);
        } else if (tenantId != null) {
            page = entitlementRepo.findByTenantId(tenantId, pageable);
        } else if (productId != null) {
            page = entitlementRepo.findByProductId(productId, pageable);
        } else {
            page = entitlementRepo.findAll(pageable);
        }
        return page.map(EntitlementDto::from);
    }

    public EntitlementDto findById(String id) {
        return entitlementRepo.findById(id)
                .map(EntitlementDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entitlement not found: " + id));
    }

    public List<EntitlementDto> listByTenant(String tenantId) {
        return entitlementRepo.findByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .map(EntitlementDto::from)
                .toList();
    }

    public EntitlementDto create(Map<String, Object> body) {
        Entitlement e = Entitlement.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(getString(body, "tenantId"))
                .productId(getString(body, "productId"))
                .planId(getString(body, "planId"))
                .entitlementType(parseEnum(body, "entitlementType", Entitlement.EntitlementType.class, Entitlement.EntitlementType.FEATURE_ACCESS))
                .featureCode(getString(body, "featureCode"))
                .value(getString(body, "value"))
                .validFrom(parseInstant(body, "validFrom"))
                .validTo(parseInstant(body, "validTo"))
                .status(Entitlement.EntitlementStatus.ACTIVE)
                .createdAt(Instant.now())
                .build();
        return EntitlementDto.from(entitlementRepo.save(e));
    }

    public EntitlementDto update(String id, Map<String, Object> body) {
        Entitlement e = entitlementRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entitlement not found: " + id));
        if (body.containsKey("value")) e.setValue(getString(body, "value"));
        if (body.containsKey("validFrom")) e.setValidFrom(parseInstant(body, "validFrom"));
        if (body.containsKey("validTo")) e.setValidTo(parseInstant(body, "validTo"));
        if (body.containsKey("status")) e.setStatus(Entitlement.EntitlementStatus.valueOf(getString(body, "status")));
        return EntitlementDto.from(entitlementRepo.save(e));
    }

    public void revoke(String id) {
        Entitlement e = entitlementRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entitlement not found: " + id));
        e.setStatus(Entitlement.EntitlementStatus.REVOKED);
        entitlementRepo.save(e);
    }

    private String getString(Map<String, Object> body, String key) {
        Object val = body.get(key);
        return val != null ? val.toString() : null;
    }

    private Instant parseInstant(Map<String, Object> body, String key) {
        Object val = body.get(key);
        if (val == null) return null;
        return Instant.parse(val.toString());
    }

    private <E extends Enum<E>> E parseEnum(Map<String, Object> body, String key, Class<E> enumClass, E defaultVal) {
        Object val = body.get(key);
        if (val == null) return defaultVal;
        try {
            return Enum.valueOf(enumClass, val.toString());
        } catch (IllegalArgumentException ex) {
            return defaultVal;
        }
    }
}
