package com.aistareco.aep.ipstudio;

import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class StudioFixtureProviderTest {
    @TempDir Path directory;
    @Test void productionAndMysqlCannotEnableFixtureResponses() throws Exception {
        Files.writeString(directory.resolve("manifest.json"),"{}");
        for(String profile:new String[]{"prod","production","mysql"}) {
            MockEnvironment environment=new MockEnvironment();environment.setActiveProfiles(profile);
            assertThrows(IllegalStateException.class,()->new StudioFixtureProvider(true,directory.toString(),environment,new ObjectMapper()).validate());
        }
    }
    @Test void missingFilesFailRatherThanReturningFakeSuccess() throws Exception {
        Files.writeString(directory.resolve("manifest.json"),"{\"images\":[\"../not-allowed.jpg\"],\"video\":\"missing.mp4\"}");
        var provider=new StudioFixtureProvider(true,directory.toString(),new MockEnvironment(),new ObjectMapper());
        provider.validate();
        assertThrows(com.aistareco.common.BusinessException.class,()->provider.image("prompt"));
        assertThrows(com.aistareco.common.BusinessException.class,provider::video);
        assertThrows(com.aistareco.common.BusinessException.class,provider::script);
    }
    @Test void disabledFixtureProviderNeverRequiresOrReadsLocalMedia() {
        var provider=new StudioFixtureProvider(false,directory.toString(),new MockEnvironment(),new ObjectMapper());
        assertDoesNotThrow(provider::validate);assertFalse(provider.enabled());assertThrows(IllegalStateException.class,provider::video);
    }
}
