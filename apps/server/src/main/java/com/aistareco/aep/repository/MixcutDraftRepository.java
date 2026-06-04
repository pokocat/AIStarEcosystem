package com.aistareco.aep.repository;

import com.aistareco.aep.model.MixcutDraft;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MixcutDraftRepository extends JpaRepository<MixcutDraft, String> {
    /** 当前用户的实例 / 草稿，按最近更新倒序。 */
    List<MixcutDraft> findByUserIdOrderByUpdatedAtDesc(String userId);
}
