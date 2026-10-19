package com.aistareco.aep.ipstudio.execution;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/** Stable identities derived from the execution; the same inputs always give the same ids (no counters, no clocks). */
public final class StudioPlanExecutionIds {
    private StudioPlanExecutionIds() {}

    /** Per-step output node id the client projects: {@code <executionId>-<a|p>-<stepId>}; at most 59 characters. */
    public static String nodeId(String executionId,String stage,String stepId) {
        return executionId+"-"+("production".equals(stage)?"p":"a")+"-"+stepId;
    }
    /** A film-study segment clip of a recreation step, projected as its own video node. */
    public static String segmentNodeId(String executionId,String stage,String stepId,int segmentNo) {
        return nodeId(executionId,stage,stepId)+"-s"+segmentNo;
    }
    /** Native request identity of one attempt; network retries reuse it, only a user-confirmed retry bumps the attempt. */
    public static String requestId(String executionId,String stage,String stepId,int attempt) {
        return "pe-"+sha1(executionId+"|"+stage+"|"+stepId+"|"+attempt).substring(0,40);
    }
    public static String approvalId(String executionId,String stage,String planRunId,String fingerprint) {
        return "apr-"+sha1(executionId+"|"+stage+"|"+planRunId+"|"+fingerprint).substring(0,32);
    }
    static String sha1(String value) {
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1").digest(value.getBytes(StandardCharsets.UTF_8)));}
        catch(Exception e){throw new IllegalStateException(e);}
    }
    static String sha256(String value) {
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}
        catch(Exception e){throw new IllegalStateException(e);}
    }
}
