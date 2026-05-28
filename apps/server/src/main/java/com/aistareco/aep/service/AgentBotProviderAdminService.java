package com.aistareco.aep.service;

import com.aistareco.aep.dto.AgentBotProviderDto;
import com.aistareco.aep.dto.AgentBotProviderUpsertDto;
import com.aistareco.aep.dto.AgentSceneDto;
import com.aistareco.aep.model.AgentBotProvider;
import com.aistareco.aep.model.AgentPlatform;
import com.aistareco.aep.repository.AgentBotProviderRepository;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Agent bot 配置管理（v0.39）。token 走明文进 service，加密落库；DTO 出口仅返回脱敏值。
 * 一个 sceneKey 唯一对应一个 bot。
 */
@Service
@Transactional
public class AgentBotProviderAdminService {

    private final AgentBotProviderRepository repo;

    public AgentBotProviderAdminService(AgentBotProviderRepository repo) {
        this.repo = repo;
    }

    public List<AgentSceneDto> listScenes() {
        return AgentScenes.all();
    }

    public List<AgentBotProviderDto> list() {
        return repo.findAllByOrderBySceneKeyAsc().stream().map(AgentBotProviderDto::from).toList();
    }

    public AgentBotProviderDto get(String id) {
        return AgentBotProviderDto.from(load(id));
    }

    public AgentBotProviderDto create(AgentBotProviderUpsertDto req) {
        require(req != null, "BODY_REQUIRED", "请求体必填");
        require(req.name() != null && !req.name().isBlank(), "NAME_REQUIRED", "name 必填");
        require(req.sceneKey() != null && !req.sceneKey().isBlank(), "SCENE_REQUIRED", "sceneKey 必填");
        require(req.botId() != null && !req.botId().isBlank(), "BOT_ID_REQUIRED", "botId 必填");
        require(req.token() != null && !req.token().isBlank(), "TOKEN_REQUIRED", "token 必填");

        String sceneKey = req.sceneKey().trim();
        if (repo.findBySceneKey(sceneKey).isPresent()) {
            throw new BusinessException(HttpStatus.CONFLICT, "SCENE_DUPLICATE",
                    "场景 " + sceneKey + " 已绑定 bot；一个场景只能对应一个 bot，请编辑现有配置");
        }
        String id = (req.id() != null && !req.id().isBlank())
                ? req.id().trim()
                : "agent-" + UUID.randomUUID().toString().substring(0, 12);
        if (repo.existsById(id)) {
            throw new BusinessException(HttpStatus.CONFLICT, "BOT_DUPLICATE", "bot id 已存在");
        }
        AgentBotProvider entity = AgentBotProvider.builder()
                .id(id)
                .name(req.name().trim())
                .platform(req.platform() != null ? AgentPlatform.fromWire(req.platform()) : AgentPlatform.COZE)
                .sceneKey(sceneKey)
                .apiBase(blankTo(req.apiBase(), "https://api.coze.cn"))
                .tokenEncrypted(AepCryptoUtil.encrypt(req.token().trim()))
                .botId(req.botId().trim())
                .userIdPrefix(blankTo(req.userIdPrefix(), "aep-producer-"))
                .readTimeoutMs(req.readTimeoutMs() != null ? req.readTimeoutMs() : 120000)
                .description(req.description())
                .enabled(req.enabled() != null ? req.enabled() : true)
                .build();
        return AgentBotProviderDto.from(repo.save(entity));
    }

    public AgentBotProviderDto update(String id, AgentBotProviderUpsertDto req) {
        AgentBotProvider entity = load(id);
        if (req.name() != null) entity.setName(req.name().trim());
        if (req.platform() != null) entity.setPlatform(AgentPlatform.fromWire(req.platform()));
        if (req.sceneKey() != null && !req.sceneKey().isBlank()) {
            String sceneKey = req.sceneKey().trim();
            repo.findBySceneKey(sceneKey)
                    .filter(other -> !other.getId().equals(id))
                    .ifPresent(other -> {
                        throw new BusinessException(HttpStatus.CONFLICT, "SCENE_DUPLICATE",
                                "场景 " + sceneKey + " 已绑定其他 bot");
                    });
            entity.setSceneKey(sceneKey);
        }
        if (req.apiBase() != null) entity.setApiBase(blankTo(req.apiBase(), "https://api.coze.cn"));
        if (req.token() != null && !req.token().isBlank()) {
            entity.setTokenEncrypted(AepCryptoUtil.encrypt(req.token().trim()));
        }
        if (req.botId() != null) entity.setBotId(req.botId().trim());
        if (req.userIdPrefix() != null) entity.setUserIdPrefix(blankTo(req.userIdPrefix(), "aep-producer-"));
        if (req.readTimeoutMs() != null) entity.setReadTimeoutMs(req.readTimeoutMs());
        if (req.description() != null) entity.setDescription(req.description());
        if (req.enabled() != null) entity.setEnabled(req.enabled());
        return AgentBotProviderDto.from(repo.save(entity));
    }

    public void delete(String id) {
        if (!repo.existsById(id)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "BOT_NOT_FOUND", "bot 不存在");
        }
        repo.deleteById(id);
    }

    private AgentBotProvider load(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "BOT_NOT_FOUND", "bot 不存在"));
    }

    private static String blankTo(String v, String def) {
        return v == null || v.isBlank() ? def : v.trim();
    }

    private static void require(boolean ok, String code, String message) {
        if (!ok) throw new BusinessException(HttpStatus.BAD_REQUEST, code, message);
    }
}
