package com.aistareco.aep.clip.service.shiliu;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.common.BusinessException;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.util.Arrays;

@Service
public class ShiliuService {
    private final ClipProperties props;
    private final Environment env;
    private final ShiliuGateway mock = new MockShiliuGateway();
    private final HttpShiliuGateway http;
    public ShiliuService(ClipProperties props, Environment env, HttpShiliuGateway http) {
        this.props = props;
        this.env = env;
        this.http = http;
    }

    public ShiliuGateway required() {
        boolean production = Arrays.asList(env.getActiveProfiles()).contains("mysql") || Arrays.asList(env.getActiveProfiles()).contains("prod");
        if (props.isAllowMock() && !production) return mock;
        if (props.getShiliuBaseUrl() != null && !props.getShiliuBaseUrl().isBlank()
                && props.getShiliuToken() != null && !props.getShiliuToken().isBlank()) return http;
        throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "CLIP_ENGINE_NOT_CONFIGURED", "数字人视频引擎尚未配置");
    }
    public boolean mockMode() { return required().mock(); }
}
