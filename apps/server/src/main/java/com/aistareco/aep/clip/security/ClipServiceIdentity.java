package com.aistareco.aep.clip.security;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
public class ClipServiceIdentity {
    public record Owner(String externalOwnerId, String externalTenantId) {}
    private final ClipProperties props;
    public ClipServiceIdentity(ClipProperties props) { this.props = props; }

    public Owner require(String authorization, String ownerId, String tenantId) {
        String expected = props.getServiceToken();
        String actual = authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7) : "";
        if (expected == null || expected.isBlank()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "CLIP_SERVICE_AUTH_NOT_CONFIGURED", "视频服务调用凭证尚未配置");
        }
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "CLIP_SERVICE_UNAUTHORIZED", "视频服务调用凭证无效");
        }
        if (ownerId == null || !ownerId.matches("[A-Za-z0-9_-]{3,128}")) {
            throw BusinessException.badRequest("CLIP_EXTERNAL_OWNER_REQUIRED", "缺少合法的外部属主标识");
        }
        return new Owner(ownerId, tenantId == null ? "" : tenantId);
    }
}
