package com.aistareco.aep.repository;

import com.aistareco.aep.model.UserInventory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserInventoryRepository extends JpaRepository<UserInventory, String> {

    List<UserInventory> findByUserIdOrderByAcquiredAtDesc(String userId);

    List<UserInventory> findByUserIdAndItemTypeOrderByAcquiredAtDesc(String userId, UserInventory.ItemType itemType);

    Optional<UserInventory> findByUserIdAndItemTypeAndItemId(String userId, UserInventory.ItemType itemType, String itemId);

    boolean existsByUserIdAndItemTypeAndItemId(String userId, UserInventory.ItemType itemType, String itemId);
}
