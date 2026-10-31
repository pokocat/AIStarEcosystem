package com.aistareco.aep.billing.service;

import com.aistareco.common.BusinessException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Set;

/** Constructed from the resolved server route, never trusted from a generation request. */
public record ModelBillingTarget(String appCode, String action, String endpointId,
                                 String providerModel, String specKey, String unit) {
    public ModelBillingTarget {
        for (String value : new String[]{appCode,action,endpointId,providerModel,specKey,unit}) {
            if (value == null || value.isBlank() || value.length()>256 || !value.equals(value.trim()))
                throw BusinessException.badRequest("MODEL_BILLING_TARGET_INVALID", "模型接入点信息不完整，请重新选择");
        }
        if (!Set.of("image","second","call","ktoken","credit").contains(unit))
            throw BusinessException.badRequest("MODEL_BILLING_UNIT_INVALID", "不支持此计费单位");
    }

    /**
     * The provider model recorded with a charge. Eligibility only compares endpointId, so an endpoint without a model
     * (some providers name it elsewhere) records its own ID instead of failing the charge. Build and compare through here.
     */
    public static String providerModelOf(com.aistareco.aep.model.AiModelEndpoint endpoint) {
        String model=endpoint.getModel();
        return model!=null&&!model.isBlank()?model.trim():"endpoint:"+endpoint.getId();
    }

    /** Usage metadata normalization; promotion eligibility is always endpoint-only. */
    public ModelBillingTarget allSpecifications() {
        return new ModelBillingTarget(appCode,action,endpointId,providerModel,"*",unit);
    }
    /** Promotions belong to the existing endpoint row, independent of product, operation or metering. */
    public boolean matches(ModelBillingTarget actual) {
        return actual!=null && endpointId.equals(actual.endpointId());
    }
    public String endpointKey() {
        return digest("endpoint:"+endpointId);
    }
    private static String digest(String value) {
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}
    }

    public String key() {
        // Length prefixes prevent ambiguous identities even if provider model names contain separators.
        StringBuilder canonical = new StringBuilder();
        for(String s : new String[]{appCode,action,endpointId,providerModel,specKey,unit})
            canonical.append(s.length()).append(':').append(s);
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(canonical.toString().getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
