package com.aistareco.aep.dap.controller;

import com.aistareco.aep.dap.dto.DapDtos.AccountDto;
import com.aistareco.aep.dap.dto.DapDtos.CaptureDto;
import com.aistareco.aep.dap.dto.DapDtos.JobDto;
import com.aistareco.aep.dap.dto.DapRequests.CreateCaptureRequest;
import com.aistareco.aep.dap.dto.DapRequests.CreateLicenseRequest;
import com.aistareco.aep.dap.dto.DapRequests.VoicePreviewRequest;
import com.aistareco.aep.dap.service.DapAccountService;
import com.aistareco.aep.dap.service.DapCaptureService;
import com.aistareco.aep.dap.service.DapCatalogService;
import com.aistareco.aep.dap.service.DapJobService;
import com.aistareco.aep.dap.service.DapLicenseService;
import com.aistareco.aep.dap.service.DapVoiceService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 数字人资产平台 · 捕获 / 授权 / 音色 / 任务 / 账户 / 目录（/api/v1/**）。
 */
@RestController
@RequestMapping("/api/v1")
public class DapMiscController {

    private final DapCaptureService captureService;
    private final DapLicenseService licenseService;
    private final DapVoiceService voiceService;
    private final DapJobService jobService;
    private final DapAccountService accountService;
    private final DapCatalogService catalog;

    public DapMiscController(DapCaptureService captureService,
                             DapLicenseService licenseService,
                             DapVoiceService voiceService,
                             DapJobService jobService,
                             DapAccountService accountService,
                             DapCatalogService catalog) {
        this.captureService = captureService;
        this.licenseService = licenseService;
        this.voiceService = voiceService;
        this.jobService = jobService;
        this.accountService = accountService;
        this.catalog = catalog;
    }

    private static String uid(Principal p) {
        if (p == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        return p.getName();
    }

    // ── 真人捕获 ──────────────────────────────────────────────

    @PostMapping("/captures")
    public ApiResponse<CaptureDto> createCapture(Principal principal, @RequestBody CreateCaptureRequest req) {
        return ApiResponse.of(captureService.create(uid(principal), req.avatarId()));
    }

    @PostMapping("/captures/{id}/footage")
    public ApiResponse<CaptureDto> footage(Principal principal, @PathVariable String id,
                                           @RequestParam("file") MultipartFile file) {
        return ApiResponse.of(captureService.uploadFootage(uid(principal), id, file));
    }

    @PostMapping("/captures/{id}/verify")
    public ApiResponse<Map<String, Object>> verify(Principal principal, @PathVariable String id) {
        return ApiResponse.of(captureService.verify(uid(principal), id));
    }

    // ── 授权 ──────────────────────────────────────────────────

    @GetMapping("/licenses")
    public ApiResponse<List<Map<String, Object>>> licenses(Principal principal,
                                                           @RequestParam(required = false) String status) {
        return ApiResponse.of(licenseService.list(uid(principal), status));
    }

    @PostMapping("/licenses")
    public ApiResponse<Map<String, Object>> createLicense(Principal principal,
                                                          @RequestBody CreateLicenseRequest req) {
        return ApiResponse.of(licenseService.create(uid(principal), req));
    }

    @GetMapping("/licenses/{id}")
    public ApiResponse<Map<String, Object>> license(Principal principal, @PathVariable String id) {
        return ApiResponse.of(licenseService.get(uid(principal), id));
    }

    @GetMapping("/licenses/{id}/certificate")
    public ApiResponse<Map<String, Object>> certificate(Principal principal, @PathVariable String id) {
        return ApiResponse.of(licenseService.certificate(uid(principal), id));
    }

    @PostMapping("/licenses/{id}/renew")
    public ApiResponse<Map<String, Object>> renew(Principal principal, @PathVariable String id) {
        return ApiResponse.of(licenseService.renew(uid(principal), id));
    }

    // ── 音色 ──────────────────────────────────────────────────

    @GetMapping("/voices/builtin")
    public ApiResponse<List<Map<String, Object>>> builtinVoices() {
        return ApiResponse.of(catalog.builtinVoices());
    }

    @GetMapping("/voices/mine")
    public ApiResponse<List<Map<String, Object>>> myVoices(Principal principal) {
        return ApiResponse.of(voiceService.mine(uid(principal)));
    }

    @PostMapping("/voices/preview")
    public ApiResponse<Map<String, Object>> previewVoice(Principal principal,
                                                         @RequestBody VoicePreviewRequest req) {
        return ApiResponse.of(voiceService.preview(uid(principal), req.voiceId()));
    }

    @PostMapping("/voices/clone")
    public ApiResponse<Map<String, Object>> cloneVoice(Principal principal,
                                                       @RequestParam("file") MultipartFile file,
                                                       @RequestParam(required = false) String name,
                                                       @RequestParam(required = false) String avatarId,
                                                       @RequestParam(required = false) String gender) {
        return ApiResponse.of(voiceService.clone(uid(principal), file, name, avatarId, gender));
    }

    // ── 任务 ──────────────────────────────────────────────────

    @GetMapping("/jobs")
    public ApiResponse<List<Map<String, Object>>> jobs(Principal principal,
                                                       @RequestParam(required = false) String status,
                                                       @RequestParam(required = false) String avatarId) {
        return ApiResponse.of(jobService.list(uid(principal), status, avatarId).stream()
                .map(JobDto::toWire).toList());
    }

    @GetMapping("/jobs/{id}")
    public ApiResponse<Map<String, Object>> job(Principal principal, @PathVariable String id) {
        return ApiResponse.of(jobService.get(uid(principal), id).toWire());
    }

    @PostMapping("/jobs/{id}/retry")
    public ApiResponse<Map<String, Object>> retry(Principal principal, @PathVariable String id) {
        return ApiResponse.of(jobService.retry(uid(principal), id).toWire());
    }

    @PostMapping("/jobs/{id}/cancel")
    public ApiResponse<Map<String, Object>> cancel(Principal principal, @PathVariable String id) {
        jobService.cancel(uid(principal), id);
        return ApiResponse.of(Map.of("cancelRequested", true));
    }

    // ── 账户 / 目录 ────────────────────────────────────────────

    @GetMapping("/account")
    public ApiResponse<AccountDto> account(Principal principal) {
        return ApiResponse.of(accountService.account(uid(principal)));
    }

    @GetMapping("/applications")
    public ApiResponse<List<Map<String, Object>>> applications() {
        return ApiResponse.of(catalog.applications());
    }

    @GetMapping("/scenes")
    public ApiResponse<List<Map<String, Object>>> scenes() {
        return ApiResponse.of(catalog.scenes());
    }

    @GetMapping("/templates")
    public ApiResponse<List<Map<String, Object>>> templates() {
        return ApiResponse.of(catalog.templates());
    }
}
