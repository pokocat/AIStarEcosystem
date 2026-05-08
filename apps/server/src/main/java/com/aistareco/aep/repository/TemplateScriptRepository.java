package com.aistareco.aep.repository;

import com.aistareco.aep.model.TemplateScript;
import com.aistareco.aep.model.TemplateScriptStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TemplateScriptRepository extends JpaRepository<TemplateScript, String> {

    /** 取某 template 的某状态全部（按 version 升序）。 */
    List<TemplateScript> findByTemplateIdAndStatusOrderByVersionAsc(
            String templateId, TemplateScriptStatus status);

    /** 取某 template 当前 published 的最新版本（业务上仅一条）。 */
    Optional<TemplateScript> findTopByTemplateIdAndStatusOrderByVersionDesc(
            String templateId, TemplateScriptStatus status);

    /** 取某 template 的所有版本（按 version 倒序），用于版本历史。 */
    List<TemplateScript> findByTemplateIdOrderByVersionDesc(String templateId);

    /** 取某 template 的最大 version（构造新草稿 version 用）。 */
    default int nextVersionFor(String templateId) {
        return findByTemplateIdOrderByVersionDesc(templateId).stream()
                .findFirst()
                .map(s -> s.getVersion() == null ? 1 : s.getVersion() + 1)
                .orElse(1);
    }
}
