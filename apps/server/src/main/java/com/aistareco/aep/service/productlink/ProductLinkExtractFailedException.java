package com.aistareco.aep.service.productlink;

import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;

/** 所有 handler 都返回 empty 或抛错时统一暴露的异常。前端会拿到 PRODUCT_LINK_EXTRACT_FAILED。 */
public class ProductLinkExtractFailedException extends BusinessException {
    public ProductLinkExtractFailedException() {
        super(HttpStatus.UNPROCESSABLE_ENTITY, "PRODUCT_LINK_EXTRACT_FAILED",
                "未能从该链接解析出商品信息（可能是不受支持的平台或页面格式变更）");
    }
}
