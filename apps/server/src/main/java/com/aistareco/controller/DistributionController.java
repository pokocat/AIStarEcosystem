package com.aistareco.controller;

import com.aistareco.aep.dto.DistributionContentDto;
import com.aistareco.aep.dto.PlatformConnectionDto;
import com.aistareco.aep.dto.PlatformDto;
import com.aistareco.aep.dto.PlatformViewPointDto;
import com.aistareco.aep.model.PlatformConnection;
import com.aistareco.aep.repository.DistributionContentRepository;
import com.aistareco.aep.repository.PlatformConnectionRepository;
import com.aistareco.aep.repository.PlatformRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 用户侧分发中心：/api/distribution/*。
 * 读：平台目录 / 已发行内容 / 播放量聚合（目录共享）；
 * 写：publish 发行任务（stub）、平台对接 connect / disconnect。
 */
@RestController
@RequestMapping("/api/distribution")
public class DistributionController {

    private final PlatformRepository platformRepo;
    private final DistributionContentRepository contentRepo;
    private final PlatformConnectionRepository connectionRepo;

    public DistributionController(PlatformRepository platformRepo,
                                  DistributionContentRepository contentRepo,
                                  PlatformConnectionRepository connectionRepo) {
        this.platformRepo = platformRepo;
        this.contentRepo = contentRepo;
        this.connectionRepo = connectionRepo;
    }

    @GetMapping("/platforms")
    public ApiResponse<List<PlatformDto>> platforms() {
        return ApiResponse.of(platformRepo.findAll(Sort.by("id").ascending())
                .stream().map(PlatformDto::from).toList());
    }

    @GetMapping("/content")
    public ApiResponse<List<DistributionContentDto>> content() {
        return ApiResponse.of(contentRepo.findAll(Sort.by("id").ascending())
                .stream().map(DistributionContentDto::from).toList());
    }

    @GetMapping("/platform-views")
    public ApiResponse<List<PlatformViewPointDto>> platformViews() {
        List<PlatformViewPointDto> list = platformRepo.findAll().stream()
                .map(p -> new PlatformViewPointDto(p.getName(), p.getFollowersCount()))
                .toList();
        return ApiResponse.of(list);
    }

    @GetMapping("/connections")
    public ApiResponse<List<PlatformConnectionDto>> myConnections(Principal principal) {
        return ApiResponse.of(connectionRepo
                .findByUserIdOrderByConnectedAtDesc(principal.getName())
                .stream().map(PlatformConnectionDto::from).toList());
    }

    @PostMapping("/platforms/{platformId}/connection")
    @ResponseStatus(HttpStatus.CREATED)
    @SuppressWarnings("unchecked")
    public ApiResponse<PlatformConnectionDto> connect(Principal principal,
                                                       @PathVariable String platformId,
                                                       @RequestBody(required = false) Map<String, Object> body) {
        if (!platformRepo.existsById(platformId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "platformId 不存在: " + platformId);
        }
        PlatformConnection conn = connectionRepo
                .findByUserIdAndPlatformId(principal.getName(), platformId)
                .orElseGet(() -> PlatformConnection.builder()
                        .id(UUID.randomUUID().toString())
                        .userId(principal.getName())
                        .platformId(platformId)
                        .build());
        conn.setStatus(PlatformConnection.ConnectionStatus.CONNECTED);
        conn.setConnectedAt(Instant.now());
        if (body != null) {
            Object t = body.get("tenantId");
            if (t != null) conn.setTenantId(t.toString());
            Object creds = body.get("credentials");
            if (creds instanceof Map<?, ?> m) {
                conn.setCredentialsJson(new java.util.LinkedHashMap<>((Map<String, Object>) m));
            }
        }
        if (conn.getTenantId() == null) conn.setTenantId(principal.getName()); // fallback
        connectionRepo.save(conn);
        return ApiResponse.of(PlatformConnectionDto.from(conn));
    }

    @DeleteMapping("/platforms/{platformId}/connection")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disconnect(Principal principal, @PathVariable String platformId) {
        PlatformConnection conn = connectionRepo
                .findByUserIdAndPlatformId(principal.getName(), platformId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "未连接该平台"));
        conn.setStatus(PlatformConnection.ConnectionStatus.DISCONNECTED);
        connectionRepo.save(conn);
    }

    /** POST /api/distribution/publish — 触发发行任务（stub）。 */
    @PostMapping("/publish")
    public ApiResponse<Map<String, Object>> publish(@RequestBody Map<String, Object> request) {
        String jobId = "publish-" + UUID.randomUUID().toString().substring(0, 8);
        return ApiResponse.of(Map.of("success", true, "publishJobId", jobId));
    }
}
