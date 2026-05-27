package com.aistareco.aep.service;

import com.aistareco.aep.dto.SellingChannelDto;
import com.aistareco.aep.model.SellingChannel;
import com.aistareco.aep.repository.SellingChannelRepository;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class SellingChannelService {

    private final SellingChannelRepository repo;

    public SellingChannelService(SellingChannelRepository repo) {
        this.repo = repo;
    }

    public List<SellingChannelDto> listAll() {
        return repo.findAll().stream().map(SellingChannelDto::from).toList();
    }

    public SellingChannelDto getById(String id) {
        return repo.findById(id).map(SellingChannelDto::from)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "SELLING_CHANNEL_NOT_FOUND", "销售渠道不存在: " + id));
    }

    public SellingChannel requireActive(String id) {
        SellingChannel c = repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "SELLING_CHANNEL_NOT_FOUND", "销售渠道不存在: " + id));
        if (c.getStatus() != SellingChannel.ChannelStatus.ACTIVE) {
            throw new BusinessException(HttpStatus.CONFLICT,
                    "SELLING_CHANNEL_INACTIVE", "销售渠道已停用: " + c.getCode());
        }
        return c;
    }

    public SellingChannelDto create(Map<String, Object> body) {
        String code = str(body, "code");
        String name = str(body, "name");
        if (code == null || code.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CHANNEL_CODE_REQUIRED", "code 不能为空");
        }
        if (name == null || name.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CHANNEL_NAME_REQUIRED", "name 不能为空");
        }
        if (repo.findByCode(code).isPresent()) {
            throw new BusinessException(HttpStatus.CONFLICT, "CHANNEL_CODE_DUPLICATE", "code 已存在: " + code);
        }
        Instant now = Instant.now();
        SellingChannel c = SellingChannel.builder()
                .id(UUID.randomUUID().toString())
                .code(code.trim())
                .name(name.trim())
                .sellingEntity(str(body, "sellingEntity"))
                .type(parseType(str(body, "type"), SellingChannel.ChannelType.PARTNER))
                .contactEmail(str(body, "contactEmail"))
                .contactPhone(str(body, "contactPhone"))
                .remark(str(body, "remark"))
                .status(parseStatus(str(body, "status"), SellingChannel.ChannelStatus.ACTIVE))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return SellingChannelDto.from(repo.save(c));
    }

    public SellingChannelDto update(String id, Map<String, Object> body) {
        SellingChannel c = repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "SELLING_CHANNEL_NOT_FOUND", "销售渠道不存在"));
        if (body.containsKey("name")) c.setName(str(body, "name"));
        if (body.containsKey("sellingEntity")) c.setSellingEntity(str(body, "sellingEntity"));
        if (body.containsKey("type")) c.setType(parseType(str(body, "type"), c.getType()));
        if (body.containsKey("contactEmail")) c.setContactEmail(str(body, "contactEmail"));
        if (body.containsKey("contactPhone")) c.setContactPhone(str(body, "contactPhone"));
        if (body.containsKey("remark")) c.setRemark(str(body, "remark"));
        if (body.containsKey("status")) c.setStatus(parseStatus(str(body, "status"), c.getStatus()));
        c.setUpdatedAt(Instant.now());
        return SellingChannelDto.from(repo.save(c));
    }

    public void delete(String id) {
        // 软删：改为 INACTIVE 而非物理删除（保留历史 batch 引用一致性）
        SellingChannel c = repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "SELLING_CHANNEL_NOT_FOUND", "销售渠道不存在"));
        c.setStatus(SellingChannel.ChannelStatus.INACTIVE);
        c.setUpdatedAt(Instant.now());
        repo.save(c);
    }

    // ── internals ────────────────────────────────────────────────────────────

    private SellingChannel.ChannelType parseType(String s, SellingChannel.ChannelType fallback) {
        if (s == null || s.isBlank()) return fallback;
        try {
            return SellingChannel.ChannelType.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CHANNEL_TYPE_INVALID",
                    "type 取值非法: " + s);
        }
    }

    private SellingChannel.ChannelStatus parseStatus(String s, SellingChannel.ChannelStatus fallback) {
        if (s == null || s.isBlank()) return fallback;
        try {
            return SellingChannel.ChannelStatus.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CHANNEL_STATUS_INVALID",
                    "status 取值非法: " + s);
        }
    }

    private String str(Map<String, Object> body, String key) {
        Object v = body.get(key);
        return v == null ? null : v.toString();
    }
}
