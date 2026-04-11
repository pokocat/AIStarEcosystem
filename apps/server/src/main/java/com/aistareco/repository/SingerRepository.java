package com.aistareco.repository;

import com.aistareco.model.Singer;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SingerRepository extends JpaRepository<Singer, String> {}
