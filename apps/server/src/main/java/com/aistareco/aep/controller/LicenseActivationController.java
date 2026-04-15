package com.aistareco.aep.controller;

import com.aistareco.aep.service.LicenseActivationService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Public endpoint for account registration via license key activation.
 * License keys can be imported by system admins or synced from external CRM systems (future).
 */
@RestController
@RequestMapping("/api/auth")
public class LicenseActivationController {

    private final LicenseActivationService activationService;

    public LicenseActivationController(LicenseActivationService activationService) {
        this.activationService = activationService;
    }

    /**
     * Activate a license key to register or onboard an account.
     * Accepts: { "code": "RAW-LICENSE-KEY", "username": "...", "email": "...", "phone": "..." }
     * The code is the raw license key that gets SHA-256 hashed for lookup.
     */
    @PostMapping("/activate")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> activate(@RequestBody Map<String, String> body) {
        return ApiResponse.of(activationService.activate(body));
    }
}
