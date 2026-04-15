package com.aistareco.aep.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class AdminSecurityUtils {

    private AdminSecurityUtils() {
    }

    public static AdminPrincipal currentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AdminPrincipal principal)) {
            return null;
        }
        return principal;
    }

    public static String currentUserId() {
        AdminPrincipal principal = currentPrincipal();
        return principal != null ? principal.userId() : null;
    }
}
