package com.aistareco.aep.repository;

import com.aistareco.aep.model.SellingChannel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SellingChannelRepository extends JpaRepository<SellingChannel, String> {
    Optional<SellingChannel> findByCode(String code);
}
