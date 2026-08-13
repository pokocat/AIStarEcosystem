package com.aistareco.aep.clip.repository;
import com.aistareco.aep.clip.model.ClipAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface ClipAssetRepository extends JpaRepository<ClipAsset, String> {
    Optional<ClipAsset> findByIdAndExternalOwnerIdAndDeletedAtIsNull(String id, String owner);
    List<ClipAsset> findByExternalOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(String owner);
    List<ClipAsset> findByPresetTrueAndDeletedAtIsNullOrderByCreatedAtDesc();

    /** 用户已占用的存储字节数。预置素材是平台提供的，不计入用户配额。 */
    @Query("select coalesce(sum(a.bytes), 0) from ClipAsset a where a.externalOwnerId = :owner and a.deletedAt is null")
    long sumBytesByOwner(@Param("owner") String owner);

    long countByExternalOwnerIdAndDeletedAtIsNull(String owner);
}
