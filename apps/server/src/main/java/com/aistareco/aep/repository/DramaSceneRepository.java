package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaScene;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DramaSceneRepository extends JpaRepository<DramaScene, String> {

    /** 懒回填幂等闸：该项目是否已有任一场景实体行（含软删）。 */
    boolean existsByProjectId(String projectId);

    List<DramaScene> findByProjectId(String projectId);

    List<DramaScene> findByProjectIdAndDeletedAtIsNull(String projectId);

    Optional<DramaScene> findByIdAndProjectIdAndDeletedAtIsNull(String id, String projectId);
}
