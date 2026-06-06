package com.aistareco.aep.service;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class OperatorPermissionService {

    public boolean currentUserCanOperate() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        return auth.getAuthorities().stream().anyMatch(a -> {
            String name = a.getAuthority();
            return "ROLE_OPERATOR".equals(name) || "ROLE_SUPER_ADMIN".equals(name);
        });
    }
}
