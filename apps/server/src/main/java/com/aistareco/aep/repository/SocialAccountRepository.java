package com.aistareco.aep.repository;

import com.aistareco.aep.model.SocialAccount;
import com.aistareco.aep.model.SocialAccountStatus;
import com.aistareco.aep.model.SocialPlatform;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SocialAccountRepository extends JpaRepository<SocialAccount, String> {

    List<SocialAccount> findByUserIdOrderByBoundAtDesc(String userId);

    Optional<SocialAccount> findByIdAndUserId(String id, String userId);

    Optional<SocialAccount> findByUserIdAndPlatformAndAccountName(String userId,
                                                                  SocialPlatform platform,
                                                                  String accountName);

    List<SocialAccount> findByUserIdAndStatus(String userId, SocialAccountStatus status);
}
