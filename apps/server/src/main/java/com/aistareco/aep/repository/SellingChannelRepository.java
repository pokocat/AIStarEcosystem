package com.aistareco.aep.repository;

import com.aistareco.aep.model.SellingChannel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SellingChannelRepository extends JpaRepository<SellingChannel, String> {
    @org.springframework.data.jpa.repository.Query("select x from SellingChannel x where trim(trailing from x.code) = trim(trailing from :code)")
    Optional<SellingChannel> findByCode(@org.springframework.data.repository.query.Param("code") String code);
}
