package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarIpAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

import java.util.Optional;

/** StarIpAsset 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarIpAssetRepository extends JpaRepository<StarIpAsset, String> {

    List<StarIpAsset> findByStarIdOrderByTypeAsc(String starId);
    Optional<StarIpAsset> findByStarIdAndType(String starId, StarIpAsset.AssetType type);
}
