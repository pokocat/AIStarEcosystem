package com.aistareco.aep.enrollment.config;

import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentSource;
import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentStatus;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.service.PlatformSupport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 一次性回填 {@code product_enrollment}（v0.149，docs/unified-identity-plan.md §12.2）。
 *
 * <p>老账号的权益此前只记在 {@code aep_users.platforms} CSV 里：</p>
 * <ul>
 *   <li>CSV 有值 → 每个平台一条 {@code ACTIVE/LEGACY}</li>
 *   <li>CSV 为空（历史语义 = 全集，见 {@code PlatformSupport.effective}）→ 五个子产品各一条 {@code ACTIVE/LEGACY}</li>
 * </ul>
 *
 * <p>幂等：只处理「一条 enrollment 行都没有」的账号，重复启动是 0 写入。分页扫描，
 * 单批 {@value #BATCH_SIZE}，避免一次性把用户表读进内存。</p>
 */
@Component
@Order(110)
public class EnrollmentBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentBackfill.class);
    private static final int BATCH_SIZE = 500;

    private final AepUserRepository userRepo;
    private final EnrollmentService enrollmentService;

    public EnrollmentBackfill(AepUserRepository userRepo, EnrollmentService enrollmentService) {
        this.userRepo = userRepo;
        this.enrollmentService = enrollmentService;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            int created = backfill();
            if (created > 0) {
                log.info("[enrollment] backfilled {} enrollment row(s) from legacy platforms CSV", created);
            }
        } catch (Exception e) {
            // 回填失败不阻断启动：MeDto.platforms 对「无 enrollment 行」的账号仍回落读 CSV。
            log.warn("[enrollment] backfill failed: {}", e.getMessage());
        }
    }

    /** @return 新建的 enrollment 行数 */
    public int backfill() {
        int created = 0;
        int page = 0;
        while (true) {
            Page<AepUser> slice = userRepo.findAll(
                    PageRequest.of(page, BATCH_SIZE, Sort.by(Sort.Direction.ASC, "id")));
            if (slice.isEmpty()) break;

            Map<String, String> csvById = slice.getContent().stream()
                    .collect(Collectors.toMap(AepUser::getId,
                            u -> u.getPlatforms() == null ? "" : u.getPlatforms(),
                            (a, b) -> a));
            List<String> missing = enrollmentService.filterUsersWithoutEnrollment(
                    List.copyOf(csvById.keySet()));
            for (String userId : missing) {
                // CSV 为空 = 历史「全集」语义
                List<String> products = PlatformSupport.effective(csvById.get(userId));
                for (String product : products) {
                    enrollmentService.upsert(userId, product,
                            EnrollmentStatus.ACTIVE, EnrollmentSource.LEGACY, null);
                    created++;
                }
            }
            if (!slice.hasNext()) break;
            page++;
        }
        return created;
    }
}
