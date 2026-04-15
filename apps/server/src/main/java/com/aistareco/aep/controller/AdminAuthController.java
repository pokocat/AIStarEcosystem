package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdminAuthRequest;
import com.aistareco.aep.dto.AdminAuthResponse;
import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.security.AdminPrincipal;
import com.aistareco.aep.service.AdminAuthenticationService;
import com.aistareco.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/auth")
public class AdminAuthController {

    private final AdminAuthenticationService authenticationService;

    public AdminAuthController(AdminAuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @PostMapping("/login")
    public ApiResponse<AdminAuthResponse> login(
            @RequestBody AdminAuthRequest request,
            HttpServletRequest servletRequest
    ) {
        return ApiResponse.of(authenticationService.login(request, servletRequest));
    }

    @GetMapping("/me")
    public ApiResponse<AepUserDto> me(@AuthenticationPrincipal AdminPrincipal principal) {
        return ApiResponse.of(authenticationService.currentAdmin(principal));
    }
}
