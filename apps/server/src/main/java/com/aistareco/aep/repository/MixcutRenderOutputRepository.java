package com.aistareco.aep.repository;

import com.aistareco.aep.model.MixcutRenderOutput;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;

public interface MixcutRenderOutputRepository extends JpaRepository<MixcutRenderOutput, String> {

    /** 软删后 30 天到期的行，给清理调度器用。 */
    List<MixcutRenderOutput> findByDeletedAtIsNotNullAndDeletedAtBefore(OffsetDateTime cutoff);
}
