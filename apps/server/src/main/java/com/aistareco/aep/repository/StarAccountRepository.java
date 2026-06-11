package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** StarAccount 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarAccountRepository extends JpaRepository<StarAccount, String> {

    Optional<StarAccount> findByUserId(String userId);
    Optional<StarAccount> findByStarId(String starId);
}
