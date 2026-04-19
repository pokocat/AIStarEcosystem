package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdminStudioDto;
import com.aistareco.aep.dto.StudioDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.StudioRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Studio（经纪公司 / 工作室 / 个人创作者）业务服务。
 * Admin 端通过聚合名下 DigitalIp 的指标得到 artistCount / songCount / revenue 等只读字段。
 */
@Service
public class StudioService {

    private final StudioRepository studioRepo;
    private final DigitalIpRepository ipRepo;
    private final AepUserRepository userRepo;

    public StudioService(StudioRepository studioRepo, DigitalIpRepository ipRepo,
                          AepUserRepository userRepo) {
        this.studioRepo = studioRepo;
        this.ipRepo = ipRepo;
        this.userRepo = userRepo;
    }

    public Page<AdminStudioDto> listAdmin(Pageable pageable) {
        return studioRepo.findAll(pageable).map(this::toAdminDto);
    }

    public AdminStudioDto findAdminById(String id) {
        return toAdminDto(loadOrThrow(id));
    }

    public StudioDto update(String id, Map<String, Object> body) {
        Studio s = loadOrThrow(id);
        if (body.containsKey("name")) s.setName(getString(body, "name"));
        if (body.containsKey("bio")) s.setBio(getString(body, "bio"));
        if (body.containsKey("logoUrl")) s.setLogoUrl(getString(body, "logoUrl"));
        if (body.containsKey("contactEmail")) s.setContactEmail(getString(body, "contactEmail"));
        if (body.containsKey("contactPhone")) s.setContactPhone(getString(body, "contactPhone"));
        if (body.containsKey("kind")) {
            s.setKind(Studio.StudioKind.valueOf(getString(body, "kind").toUpperCase(Locale.ROOT)));
        }
        if (body.containsKey("status")) {
            s.setStatus(Studio.StudioStatus.valueOf(getString(body, "status").toUpperCase(Locale.ROOT)));
        }
        s.setUpdatedAt(Instant.now());
        return StudioDto.from(studioRepo.save(s));
    }

    private AdminStudioDto toAdminDto(Studio s) {
        List<DigitalIp> ips = ipRepo.findByStudioId(s.getId());
        int artistCount = ips.size();
        int songCount = ips.stream().mapToInt(DigitalIp::getStatSongs).sum();
        long totalRevenue = ips.stream().mapToLong(DigitalIp::getStatRevenueCredits).sum();
        long monthlyRevenue = ips.stream().mapToLong(DigitalIp::getStatMonthlyRevenueCredits).sum();
        String ownerUsername = userRepo.findById(s.getOwnerUserId())
                .map(AepUser::getUsername)
                .orElse(null);
        return AdminStudioDto.from(s, ownerUsername, artistCount, songCount, totalRevenue, monthlyRevenue);
    }

    private Studio loadOrThrow(String id) {
        return studioRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Studio not found: " + id));
    }

    private String getString(Map<String, Object> body, String key) {
        Object val = body.get(key);
        return val != null ? val.toString() : null;
    }
}
