package com.aistareco.aep.impersonation;

import com.aistareco.common.BusinessException;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.util.Set;

/** 只接受服务端登记的产品地址，不接受调用方传任意跳转地址。 */
@Component
public class ImpersonationOrigins {
    private static final Set<String> PRODUCTS = Set.of("music", "drama", "celebrity", "aiavatar", "star");
    private final Environment env;
    public ImpersonationOrigins(Environment env) { this.env = env; }
    public String get(String product) {
        if (product == null || !PRODUCTS.contains(product))
            throw BusinessException.badRequest("IMPERSONATION_PRODUCT_INVALID", "请选择支持的产品");
        String raw = env.getProperty("aep.impersonation.origins." + product, "https://" + product + ".aibuzz.cn");
        try {
            URI uri = URI.create(raw);
            boolean local = env.acceptsProfiles(Profiles.of("dev", "test"))
                    && !env.acceptsProfiles(Profiles.of("mysql", "prod", "production"))
                    && "http".equals(uri.getScheme()) && Set.of("localhost", "127.0.0.1").contains(uri.getHost() == null ? "" : uri.getHost());
            if ((!"https".equals(uri.getScheme()) && !local) || uri.getHost() == null
                    || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || !uri.getRawPath().isEmpty()) throw new IllegalArgumentException();
            return uri.toASCIIString();
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("IMPERSONATION_ORIGIN_INVALID", "产品附身登录地址配置有误");
        }
    }
}
