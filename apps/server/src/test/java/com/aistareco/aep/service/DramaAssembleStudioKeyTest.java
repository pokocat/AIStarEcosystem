package com.aistareco.aep.service;

import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Studio 成片 key 前缀与归属闸同源（S0 产品问题：合成成片保存触发 IP_ASSET_KEY_INVALID）。 */
class DramaAssembleStudioKeyTest {
    @Test void prefixMatchesOwnershipRuleForOddUserIds() {
        for (String uid : new String[]{"u123", "user.name@id", "uid with space", "奇怪/字符"}) {
            String prefix = DramaAssembleService.studioAssemblyPrefix(uid);
            assertEquals(FileStorageService.ownedKeyPrefix(IpProjectService.CATEGORY_GEN, uid), prefix, uid);
            assertTrue(prefix.startsWith("ipstudio_gen/"), prefix);
            assertTrue(prefix.endsWith("/"), prefix);
        }
    }
}
