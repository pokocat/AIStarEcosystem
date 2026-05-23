package com.aistareco.aep.service.productlink;

import com.aistareco.aep.dto.ProductLinkInfoDto;

import java.net.URI;
import java.util.Optional;

/**
 * 商品链接解析策略接口。每个 handler 自行决定能不能处理这个 URL：
 *   - 能处理 → 返回 Optional.of(info)
 *   - 不能 → 返回 Optional.empty()，让 chain 继续尝试下一个
 *
 * 用 Spring `@Order` 注解控制优先级，{@link com.aistareco.aep.service.ProductLinkService}
 * 自动按顺序注入并依次试。新增平台只需要加一个 handler，前端 / controller 都不动。
 */
public interface ProductLinkHandler {
    Optional<ProductLinkInfoDto> tryParse(URI url);
}
