package com.aistareco.aep.service;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.model.PlatformConfig;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 平台配置读写服务。
 * <p>写端：{@link #upsert} 自增 version、刷新时间戳；读端：{@link #findByKey}、{@link #listAll}。
 */
@Service
public class PlatformConfigService {

    private final PlatformConfigRepository repo;
    private final ObjectMapper objectMapper;

    public PlatformConfigService(PlatformConfigRepository repo, ObjectMapper objectMapper) {
        this.repo = repo;
        this.objectMapper = objectMapper;
    }

    public Optional<PlatformConfigDto> findByKey(String key) {
        return repo.findByConfigKey(key).map(c -> PlatformConfigDto.from(c, objectMapper));
    }

    public PlatformConfigDto requireByKey(String key) {
        return findByKey(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "config not found: " + key));
    }

    public List<PlatformConfigDto> listAll() {
        return repo.findAll().stream()
                .map(c -> PlatformConfigDto.from(c, objectMapper))
                .toList();
    }

    /**
     * 新建或覆盖 key 的 JSON 值；version 自增 1；updatedAt / updatedBy 刷新。
     * {@code description} / {@code updatedBy} 为 null 时保留原值（upsert 场景）。
     */
    public PlatformConfigDto upsert(String key, JsonNode value, String description, String updatedBy) {
        if (key == null || key.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "configKey 必填");
        }
        PlatformConfig existing = repo.findByConfigKey(key).orElse(null);
        String json = serialize(value);
        Instant now = Instant.now();
        if (existing == null) {
            PlatformConfig created = PlatformConfig.builder()
                    .id(UUID.randomUUID().toString())
                    .configKey(key)
                    .valueJson(json)
                    .version(1)
                    .description(description)
                    .updatedAt(now)
                    .updatedBy(updatedBy == null ? "system" : updatedBy)
                    .build();
            repo.save(created);
            return PlatformConfigDto.from(created, objectMapper);
        }
        existing.setValueJson(json);
        existing.setVersion(existing.getVersion() + 1);
        if (description != null) existing.setDescription(description);
        existing.setUpdatedAt(now);
        if (updatedBy != null) existing.setUpdatedBy(updatedBy);
        repo.save(existing);
        return PlatformConfigDto.from(existing, objectMapper);
    }

    /**
     * 首次种子专用：不存在时建，存在时保持不变（不刷 version），避免重启覆盖管理端修改。
     */
    public void seedIfAbsent(String key, JsonNode value, String description) {
        if (repo.existsByConfigKey(key)) return;
        PlatformConfig created = PlatformConfig.builder()
                .id(UUID.randomUUID().toString())
                .configKey(key)
                .valueJson(serialize(value))
                .version(1)
                .description(description)
                .updatedAt(Instant.now())
                .updatedBy("seed")
                .build();
        repo.save(created);
    }

    public void delete(String key) {
        PlatformConfig c = repo.findByConfigKey(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "config not found: " + key));
        repo.delete(c);
    }

    private String serialize(JsonNode value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "config value JSON serialize failed");
        }
    }
}
