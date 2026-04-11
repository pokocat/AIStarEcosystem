package com.aistareco.repository;

import com.aistareco.model.WardrobeItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WardrobeItemRepository extends JpaRepository<WardrobeItem, String> {}
