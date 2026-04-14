package com.aistareco.aep.service;

import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.model.Tenant;
import com.aistareco.aep.repository.TenantRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class TenantService {

    private final TenantRepository tenantRepo;

    public TenantService(TenantRepository tenantRepo) {
        this.tenantRepo = tenantRepo;
    }

    public Page<TenantDto> list(Pageable pageable) {
        return tenantRepo.findAll(pageable).map(TenantDto::from);
    }

    public TenantDto findById(String id) {
        return tenantRepo.findById(id)
                .map(TenantDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + id));
    }

    public TenantDto create(Map<String, Object> body) {
        Tenant tenant = Tenant.builder()
                .id(UUID.randomUUID().toString())
                .name(getString(body, "name"))
                .type(parseEnum(body, "type", Tenant.TenantType.class, Tenant.TenantType.PERSONAL))
                .status(Tenant.TenantStatus.ACTIVE)
                .ownerUserId(getString(body, "ownerUserId"))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        return TenantDto.from(tenantRepo.save(tenant));
    }

    public TenantDto update(String id, Map<String, Object> body) {
        Tenant tenant = tenantRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + id));
        if (body.containsKey("name")) tenant.setName(getString(body, "name"));
        if (body.containsKey("type")) tenant.setType(Tenant.TenantType.valueOf(getString(body, "type")));
        if (body.containsKey("status")) tenant.setStatus(Tenant.TenantStatus.valueOf(getString(body, "status")));
        if (body.containsKey("ownerUserId")) tenant.setOwnerUserId(getString(body, "ownerUserId"));
        tenant.setUpdatedAt(Instant.now());
        return TenantDto.from(tenantRepo.save(tenant));
    }

    private String getString(Map<String, Object> body, String key) {
        Object val = body.get(key);
        return val != null ? val.toString() : null;
    }

    private <E extends Enum<E>> E parseEnum(Map<String, Object> body, String key, Class<E> enumClass, E defaultVal) {
        Object val = body.get(key);
        if (val == null) return defaultVal;
        try {
            return Enum.valueOf(enumClass, val.toString());
        } catch (IllegalArgumentException e) {
            return defaultVal;
        }
    }
}
