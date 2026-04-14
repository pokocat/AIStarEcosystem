package com.aistareco.aep.repository;

import com.aistareco.aep.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, String>,
        PagingAndSortingRepository<Product, String> {

    Optional<Product> findByCode(String code);

    boolean existsByCode(String code);
}
