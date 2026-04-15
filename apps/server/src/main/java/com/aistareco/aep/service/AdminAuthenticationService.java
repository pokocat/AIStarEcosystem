package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdminAuthRequest;
import com.aistareco.aep.dto.AdminAuthResponse;
import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.security.AdminPrincipal;
import com.aistareco.aep.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.EnumSet;

@Service
public class AdminAuthenticationService {

    private static final EnumSet<AepUser.UserRole> ADMIN_ROLES = EnumSet.of(
            AepUser.UserRole.PLATFORM_OWNER,
            AepUser.UserRole.PLATFORM_OPERATOR,
            AepUser.UserRole.FINANCE_ADMIN,
            AepUser.UserRole.CHANNEL_MANAGER
    );

    private final AepUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService auditService;

    public AdminAuthenticationService(
            AepUserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuditService auditService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditService = auditService;
    }

    public AdminAuthResponse login(AdminAuthRequest request, HttpServletRequest servletRequest) {
        String identifier = request.username() != null ? request.username().trim() : "";
        String password = request.password() != null ? request.password() : "";

        AepUser user = userRepository.findByUsername(identifier)
                .or(() -> userRepository.findByEmail(identifier))
                .orElseThrow(() -> invalidCredentials(identifier, servletRequest));

        if (!ADMIN_ROLES.contains(user.getRole())
                || user.getPasswordHash() == null
                || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw invalidCredentials(identifier, servletRequest);
        }

        if (user.getStatus() != AepUser.UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin account is not active");
        }

        user.setLastLoginAt(Instant.now());
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        String token = jwtService.generateAdminToken(user.getId(), user.getUsername(), user.getRole());
        auditService.record(
                user.getId(),
                null,
                "admin.auth.login",
                "admin_user",
                user.getId(),
                servletRequest.getRemoteAddr(),
                servletRequest.getHeader("User-Agent"),
                com.aistareco.aep.model.AuditLog.AuditResult.SUCCESS,
                "管理员登录成功"
        );

        return new AdminAuthResponse(
                token,
                Instant.now().plusMillis(jwtService.getExpirationMs()),
                AepUserDto.from(user)
        );
    }

    public AepUserDto currentAdmin(AdminPrincipal principal) {
        AepUser user = userRepository.findById(principal.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin user not found"));
        return AepUserDto.from(user);
    }

    private ResponseStatusException invalidCredentials(String identifier, HttpServletRequest request) {
        auditService.record(
                null,
                null,
                "admin.auth.login",
                "admin_user",
                identifier,
                request.getRemoteAddr(),
                request.getHeader("User-Agent"),
                com.aistareco.aep.model.AuditLog.AuditResult.FAILURE,
                "管理员登录失败"
        );
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username/email or password");
    }
}
