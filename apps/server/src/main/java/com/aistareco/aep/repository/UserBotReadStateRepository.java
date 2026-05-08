package com.aistareco.aep.repository;

import com.aistareco.aep.model.UserBotReadState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserBotReadStateRepository extends JpaRepository<UserBotReadState, String> {
    Optional<UserBotReadState> findByUserIdAndBotId(String userId, String botId);
}
