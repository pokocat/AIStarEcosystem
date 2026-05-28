package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AgentBotProviderDto;
import com.aistareco.aep.dto.AgentBotProviderUpsertDto;
import com.aistareco.aep.dto.AgentSceneDto;
import com.aistareco.aep.service.AgentBotProviderAdminService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin Agent 平台 bot 配置：/api/admin/agent-bots/*。v0.39 新增。
 *
 * 把「形象锻造」这类挂在 Coze 等 agent 平台上的会话能力做成后台可配（token 加密存储，永不明文返回）。
 * 一个 sceneKey 对应一个 bot；前端业务功能按 sceneKey 取配置。
 */
@RestController
@RequestMapping("/api/admin/agent-bots")
public class AdminAgentBotController {

    private final AgentBotProviderAdminService service;

    public AdminAgentBotController(AgentBotProviderAdminService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<AgentBotProviderDto>> list() {
        return ApiResponse.of(service.list());
    }

    /** 可绑定的业务场景目录（admin 下拉用）。 */
    @GetMapping("/scenes")
    public ApiResponse<List<AgentSceneDto>> scenes() {
        return ApiResponse.of(service.listScenes());
    }

    @GetMapping("/{id}")
    public ApiResponse<AgentBotProviderDto> get(@PathVariable String id) {
        return ApiResponse.of(service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AgentBotProviderDto> create(@RequestBody AgentBotProviderUpsertDto req) {
        return ApiResponse.of(service.create(req));
    }

    @PutMapping("/{id}")
    public ApiResponse<AgentBotProviderDto> update(@PathVariable String id,
                                                   @RequestBody AgentBotProviderUpsertDto req) {
        return ApiResponse.of(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }
}
