package com.aistareco.aep.enrollment;

import com.aistareco.aep.enrollment.config.ProductRouteTable;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class StudioDistributionRoutesTest {
    @Test void studioSharesExistingOwnerScopedAccountsAndReadOnlyJobs() {
        for(String path:new String[]{"/api/me/social-accounts","/api/me/social-accounts/bind-init","/api/me/social-accounts/a/verify"})
            assertTrue(ProductRouteTable.resolve(path,"POST").products().contains("aiavatar"));
        for(String path:new String[]{"/api/me/publish-jobs","/api/me/publish-jobs/batches","/api/me/publish-jobs/batches/old-batch","/api/me/publish-jobs/old-job"})
            assertTrue(ProductRouteTable.resolve(path,"GET").products().contains("aiavatar"));
        for(String path:new String[]{"/api/me/publish-jobs","/api/me/publish-jobs/old-job/retry","/api/me/publish-jobs/batches/old-batch/cancel"})
            assertFalse(ProductRouteTable.resolve(path,"POST").products().contains("aiavatar"));
        assertFalse(ProductRouteTable.resolve("/api/me/mixcut/jobs","GET").products().contains("aiavatar"));
    }
}
