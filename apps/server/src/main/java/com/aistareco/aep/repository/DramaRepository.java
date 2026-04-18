package com.aistareco.aep.repository;

import com.aistareco.aep.model.Drama;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DramaRepository extends JpaRepository<Drama, String> {
}
