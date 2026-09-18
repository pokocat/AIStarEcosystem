package com.aistareco.aep.impersonation;

import com.aistareco.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
public class ImpersonationController {
    private final ImpersonationService service;
    public ImpersonationController(ImpersonationService service) { this.service = service; }
    public record Start(String product) {}
    public record Exchange(String code, String product) {}
    @PostMapping("/api/admin/aep-users/{id}/impersonate")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<ImpersonationService.Started> start(@PathVariable String id, @RequestBody Start body,
            Authentication auth, HttpServletRequest request, HttpServletResponse response) {
        noStore(response); return ApiResponse.of(service.start(auth, id, body.product(), request));
    }
    @PostMapping("/api/auth/impersonation/exchange")
    public ApiResponse<ImpersonationService.LoggedIn> exchange(@RequestBody Exchange body,
            HttpServletRequest request, HttpServletResponse response) {
        noStore(response); return ApiResponse.of(service.exchange(body.code(), body.product(), request.getHeader("Origin"), request));
    }
    @PostMapping("/api/auth/impersonation/exit")
    public ApiResponse<Map<String, Boolean>> exit(HttpServletRequest request, HttpServletResponse response) {
        noStore(response);
        String header = request.getHeader("Authorization");
        service.exit(header != null && header.startsWith("Bearer ") ? header.substring(7).trim() : null, request);
        return ApiResponse.of(Map.of("closed", true));
    }
    private static void noStore(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store"); response.setHeader("Referrer-Policy", "no-referrer");
    }
}
