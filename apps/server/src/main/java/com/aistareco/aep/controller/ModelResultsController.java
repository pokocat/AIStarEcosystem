package com.aistareco.aep.controller;

import com.aistareco.aep.repository.AiModelUsageRecordRepository;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.List;
import java.time.Instant;

/** The caller's own full model output. No prompts, credentials or another product's records. */
@RestController
@RequestMapping("/api/me/model-results")
public class ModelResultsController {
    private final AiModelUsageRecordRepository records;
    private final ObjectMapper json;
    public ModelResultsController(AiModelUsageRecordRepository records,ObjectMapper json){this.records=records;this.json=json;}
    public record Summary(String id,String model,String purpose,Instant createdAt){}
    public record Detail(String id,String content,String finishReason){}
    private String owner(Principal p){if(p==null)throw new BusinessException(org.springframework.http.HttpStatus.UNAUTHORIZED,"AUTH_REQUIRED","请先登录");return p.getName();}
    @GetMapping
    public ApiResponse<List<Summary>> list(Principal p,@RequestHeader("X-App-Code") String app,@RequestParam(defaultValue="0") int page){
        return ApiResponse.of(records.preserved(owner(p),app,"%\"preservedContent\"%",PageRequest.of(Math.max(0,page),20)).stream()
                .map(r->new Summary(r.getId(),r.getProviderName(),r.getPurpose(),r.getCreatedAt())).toList());
    }
    @GetMapping("/{id}")
    public ApiResponse<Detail> detail(Principal p,@RequestHeader("X-App-Code") String app,@PathVariable String id) throws Exception {
        var row=records.findByIdAndUserIdAndAppCode(id,owner(p),app).orElseThrow(()->BusinessException.notFound("MODEL_RESULT_NOT_FOUND","这份生成内容不存在"));
        com.fasterxml.jackson.databind.JsonNode body;
        try {body=json.readTree(row.getResponseBodyJson());}
        catch(Exception absent){throw BusinessException.notFound("MODEL_RESULT_NOT_FOUND","这份生成内容不存在");}
        if(body==null||!body.path("preservedContent").isTextual())throw BusinessException.notFound("MODEL_RESULT_NOT_FOUND","这份生成内容不存在");
        return ApiResponse.of(new Detail(id,body.path("preservedContent").asText(),body.path("preservedFinishReason").asText()));
    }
}
