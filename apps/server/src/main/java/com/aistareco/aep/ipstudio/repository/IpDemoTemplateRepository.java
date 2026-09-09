package com.aistareco.aep.ipstudio.repository;

import com.aistareco.aep.ipstudio.model.IpDemoTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IpDemoTemplateRepository extends JpaRepository<IpDemoTemplate, String> {

    /** 目录里要展示的示例：启用的，按排序。 */
    List<IpDemoTemplate> findByEnabledTrueOrderBySortOrderAscCreatedAtAsc();

    /** 按种类取启用中的（模板进目录、实例进画布列表，两条列表分开查）。 */
    List<IpDemoTemplate> findByKindAndEnabledTrueOrderBySortOrderAscCreatedAtAsc(String kind);

    /**
     * 只更展示信息这三列。
     *
     * <p>不用 {@code save(entity)}：实体没有 @Version，Hibernate 默认整行 UPDATE ——
     * 并发时会把别的写路径（重新发布）刚写进去的 doc/kind/cover 一起盖回旧值。
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update IpDemoTemplate d set d.name = :name, d.summary = :summary, "
            + "d.sortOrder = :sortOrder, d.updatedAt = :now where d.id = :id")
    int updateMeta(@Param("id") String id, @Param("name") String name,
                   @Param("summary") String summary, @Param("sortOrder") int sortOrder,
                   @Param("now") java.time.Instant now);
}
