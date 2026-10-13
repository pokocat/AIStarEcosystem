package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.service.ErrorLogService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Failure diagnostics share ErrorLog and existing output JSON; no second task state or schema. */
@Service
public class StudioRunErrorLog {
    private static final Logger log = LoggerFactory.getLogger(StudioRunErrorLog.class);
    private final ErrorLogService errors;
    private final ObjectMapper mapper;
    public StudioRunErrorLog(ErrorLogService errors, ObjectMapper mapper) { this.errors = errors; this.mapper = mapper; }
    public void attach(IpRun run, Throwable cause) {
        if ("IP_RUN_CANCELLED".equals(run.getErrorCode())) return;
        try {
            ObjectNode output = run.getOutputJson() == null ? mapper.createObjectNode() : (ObjectNode) mapper.readTree(run.getOutputJson());
            if (output.hasNonNull("logId")) return;
            Throwable error = cause != null ? cause : new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, run.getErrorCode(), run.getErrorMessage());
            String id = errors.recordTask(error, run.getErrorCode(), run.getOwnerUserId(), run.getId());
            if (id != null) {
                output.put("logId", id);
                run.setOutputJson(mapper.writeValueAsString(output));
                log.warn("[ipstudio] failure run={} code={} logId={}", run.getId(), run.getErrorCode(), id);
            }
        } catch (Exception error) { log.warn("[ipstudio] failure diagnostics unavailable run={}", run.getId(), error); }
    }
}
