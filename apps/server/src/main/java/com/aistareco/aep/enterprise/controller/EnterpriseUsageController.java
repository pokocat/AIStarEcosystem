package com.aistareco.aep.enterprise.controller;
import com.aistareco.aep.enterprise.dto.EnterpriseUsageDto;
import com.aistareco.aep.enterprise.service.EnterpriseQueryService;
import com.aistareco.aep.dto.PageEnvelope;
import org.springframework.web.bind.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import java.security.Principal;
@RestController @RequestMapping("/api/v1/ip-studio/enterprises/{id}/usage")
@ConditionalOnProperty(name="aep.enterprise.enabled",havingValue="true")
public class EnterpriseUsageController {
    private final EnterpriseQueryService service;
    public EnterpriseUsageController(EnterpriseQueryService service){this.service=service;}
    @GetMapping public PageEnvelope<EnterpriseUsageDto> list(Principal p,@PathVariable String id,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int limit){return PageEnvelope.from(service.usage(p.getName(),id,page,limit));}
}
