package com.aistareco.aep.card.repository;

import com.aistareco.aep.card.model.CardProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CardProfileRepository extends JpaRepository<CardProfile, String> {

    /** 公开读的唯一入口。软删与未发布的过滤放在 service，便于区分 404 与「尚未发布」。 */
    Optional<CardProfile> findBySlug(String slug);

    List<CardProfile> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    /** 形象被删 / 授权撤销时，反查受影响的名片 —— 必须能通知到主人。 */
    List<CardProfile> findByAvatarIdAndDeletedAtIsNull(String avatarId);
}
