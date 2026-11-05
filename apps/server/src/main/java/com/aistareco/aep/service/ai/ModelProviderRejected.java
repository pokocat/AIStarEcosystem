package com.aistareco.aep.service.ai;

/**
 * A supplier answered a model call with a non-2xx status. Published by {@link UpstreamModelHttp} so observers
 * can react without the HTTP layer depending on them. The body is the supplier's raw response: internal use only.
 */
public record ModelProviderRejected(String endpointId, String endpointName, String model, int status, String body) {}
