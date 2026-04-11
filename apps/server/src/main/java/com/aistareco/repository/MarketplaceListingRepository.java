package com.aistareco.repository;

import com.aistareco.model.MarketplaceListing;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketplaceListingRepository extends JpaRepository<MarketplaceListing, String> {}
