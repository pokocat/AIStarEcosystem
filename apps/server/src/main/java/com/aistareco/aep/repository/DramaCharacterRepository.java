package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaCharacter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DramaCharacterRepository extends JpaRepository<DramaCharacter, String> {

    /** 懒回填幂等闸：该项目是否已有任一角色实体行（含软删）。 */
    boolean existsByProjectId(String projectId);

    /** 双写对齐：项目全部角色行（含软删），用于 upsert / 软删对齐。 */
    List<DramaCharacter> findByProjectId(String projectId);

    /** 渲染真值 / overlay：项目未删角色行。 */
    List<DramaCharacter> findByProjectIdAndDeletedAtIsNull(String projectId);

    Optional<DramaCharacter> findByIdAndProjectIdAndDeletedAtIsNull(String id, String projectId);
}
