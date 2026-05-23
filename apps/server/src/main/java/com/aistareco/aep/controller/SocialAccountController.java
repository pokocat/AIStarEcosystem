package com.aistareco.aep.controller;

import com.aistareco.aep.dto.SocialAccountBindInitDto;
import com.aistareco.aep.dto.SocialAccountBindInputDto;
import com.aistareco.aep.dto.SocialAccountBindPollResultDto;
import com.aistareco.aep.dto.SocialAccountDto;
import com.aistareco.aep.service.SocialAccountService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 当前用户的社交账号绑定 API。
 *
 * 路由：/api/me/social-accounts/*
 * 需 JWT (AepSecurityConfig: /api/me/** authenticated)。
 *
 * Wire 见 specs/openapi.yaml 2.22 + 3.x social-distribution。
 */
@RestController
@RequestMapping("/api/me/social-accounts")
public class SocialAccountController {

    private final SocialAccountService service;

    public SocialAccountController(SocialAccountService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<SocialAccountDto>> list(Principal principal) {
        return ApiResponse.of(service.listByUser(principal.getName()));
    }

    @PostMapping("/bind-init")
    public ApiResponse<SocialAccountBindInitDto> bindInit(Principal principal,
                                                          @RequestBody SocialAccountBindInputDto input) {
        return ApiResponse.of(service.initBind(
                principal.getName(),
                input != null ? input.platform() : null,
                input != null ? input.accountName() : null
        ));
    }

    @GetMapping("/bind-poll")
    public ApiResponse<SocialAccountBindPollResultDto> bindPoll(Principal principal,
                                                                  @RequestParam("ticket") String ticket) {
        return ApiResponse.of(service.pollBind(principal.getName(), ticket));
    }

    @PostMapping("/bind-interaction")
    public ResponseEntity<Void> bindInteraction(Principal principal,
                                                 @RequestParam("ticket") String ticket,
                                                 @RequestBody SubmitBindInteractionRequest body) {
        service.submitBindInteraction(principal.getName(), ticket, body != null ? body.code() : null);
        return ResponseEntity.noContent().build();
    }

    /** 用户在前端关掉/取消扫码弹窗时调用，杀掉 sau-service 进行中的 playwright，并清掉 PENDING 行。 */
    @PostMapping("/bind-cancel")
    public ResponseEntity<Void> bindCancel(Principal principal,
                                            @RequestParam("ticket") String ticket) {
        service.cancelBind(principal.getName(), ticket);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/verify")
    public ApiResponse<SocialAccountDto> verify(Principal principal, @PathVariable("id") String id) {
        return ApiResponse.of(service.verify(principal.getName(), id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> unbind(Principal principal, @PathVariable("id") String id) {
        service.unbind(principal.getName(), id);
        return ResponseEntity.noContent().build();
    }

    public record SubmitBindInteractionRequest(String code) {}
}
