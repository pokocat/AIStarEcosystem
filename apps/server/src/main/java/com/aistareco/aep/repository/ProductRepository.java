package com.aistareco.aep.repository;

import com.aistareco.aep.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, String> {

    List<Product> findAllByOrderByUpdatedAtDesc();

    List<Product> findByCategoryOrderByUpdatedAtDesc(String category);

    Optional<Product> findFirstByLink(String link);

    Optional<Product> findFirstByNameIgnoreCase(String name);
}
