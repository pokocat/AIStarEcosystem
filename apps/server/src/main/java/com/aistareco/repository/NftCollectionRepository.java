package com.aistareco.repository;

import com.aistareco.model.NftCollection;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NftCollectionRepository extends JpaRepository<NftCollection, String> {}
