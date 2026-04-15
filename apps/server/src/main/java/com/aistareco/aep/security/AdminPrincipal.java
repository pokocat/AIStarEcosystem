package com.aistareco.aep.security;

import com.aistareco.aep.model.AepUser;

public record AdminPrincipal(
        String userId,
        String username,
        AepUser.UserRole role
) {
}
