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

    @org.springframework.data.jpa.repository.Query("select x from SocialAccount x where x.userId=:userId and x.platform=:platform and trim(trailing from x.accountName)=trim(trailing from :accountName)")
    Optional<SocialAccount> findByUserIdAndPlatformAndAccountName(@org.springframework.data.repository.query.Param("userId") String userId,
                                                                  @org.springframework.data.repository.query.Param("platform") SocialPlatform platform,
                                                                  @org.springframework.data.repository.query.Param("accountName") String accountName);

    List<SocialAccount> findByUserIdAndStatus(String userId, SocialAccountStatus status);
}
