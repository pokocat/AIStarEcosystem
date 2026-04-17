package com.aistareco.aep.service;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class AepUserService {

    private final AepUserRepository userRepo;

    public AepUserService(AepUserRepository userRepo) {
        this.userRepo = userRepo;
    }

    public Page<AepUserDto> list(AepUser.UserStatus status, AepUser.AccountKind kind, Pageable pageable) {
        Page<AepUser> page;
        if (status != null && kind != null) {
            page = userRepo.findByStatusAndKind(status, kind, pageable);
        } else if (status != null) {
            page = userRepo.findByStatus(status, pageable);
        } else if (kind != null) {
            page = userRepo.findByKind(kind, pageable);
        } else {
            page = userRepo.findAll(pageable);
        }
        return page.map(AepUserDto::from);
    }

    public AepUserDto findById(String id) {
        return userRepo.findById(id)
                .map(AepUserDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));
    }

    public AepUserDto create(Map<String, Object> body) {
        AepUser user = AepUser.builder()
                .id(UUID.randomUUID().toString())
                .username(getString(body, "username"))
                .email(getString(body, "email"))
                .phone(getString(body, "phone"))
                .displayName(getString(body, "displayName"))
                .avatarUrl(getString(body, "avatarUrl"))
                .walletAddress(getString(body, "walletAddress"))
                .kind(parseEnum(body, "kind", AepUser.AccountKind.class, AepUser.AccountKind.PERSONAL))
                .status(AepUser.UserStatus.ACTIVE)
                .emailVerified(false)
                .phoneVerified(false)
                .langPreference(getString(body, "langPreference"))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        return AepUserDto.from(userRepo.save(user));
    }

    public AepUserDto update(String id, Map<String, Object> body) {
        AepUser user = userRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));
        if (body.containsKey("email")) user.setEmail(getString(body, "email"));
        if (body.containsKey("phone")) user.setPhone(getString(body, "phone"));
        if (body.containsKey("displayName")) user.setDisplayName(getString(body, "displayName"));
        if (body.containsKey("avatarUrl")) user.setAvatarUrl(getString(body, "avatarUrl"));
        if (body.containsKey("walletAddress")) user.setWalletAddress(getString(body, "walletAddress"));
        if (body.containsKey("kind")) user.setKind(AepUser.AccountKind.valueOf(getString(body, "kind").toUpperCase()));
        if (body.containsKey("status")) user.setStatus(AepUser.UserStatus.valueOf(getString(body, "status").toUpperCase()));
        if (body.containsKey("langPreference")) user.setLangPreference(getString(body, "langPreference"));
        user.setUpdatedAt(Instant.now());
        return AepUserDto.from(userRepo.save(user));
    }

    public void delete(String id) {
        AepUser user = userRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));
        user.setStatus(AepUser.UserStatus.DELETED);
        user.setUpdatedAt(Instant.now());
        userRepo.save(user);
    }

    private String getString(Map<String, Object> body, String key) {
        Object val = body.get(key);
        return val != null ? val.toString() : null;
    }

    private <E extends Enum<E>> E parseEnum(Map<String, Object> body, String key, Class<E> enumClass, E defaultVal) {
        Object val = body.get(key);
        if (val == null) return defaultVal;
        try {
            return Enum.valueOf(enumClass, val.toString().toUpperCase());
        } catch (IllegalArgumentException e) {
            return defaultVal;
        }
    }
}
