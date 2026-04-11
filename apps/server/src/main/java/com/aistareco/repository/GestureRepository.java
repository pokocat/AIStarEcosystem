package com.aistareco.repository;

import com.aistareco.model.Gesture;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GestureRepository extends JpaRepository<Gesture, String> {}
