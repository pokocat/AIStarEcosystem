package com.aistareco.aep.ipstudio.repository;
import com.aistareco.aep.ipstudio.model.IpSavedAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface IpSavedAssetRepository extends JpaRepository<IpSavedAsset,String> {
    List<IpSavedAsset> findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(String owner);
    Optional<IpSavedAsset> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id,String owner);
}
