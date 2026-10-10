package com.aistareco.aep.service;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class AiModelUsageAdminServiceTest {
    @Test void redactedMediaCannotBeReplayedAsAStringOrChargedAgain() {
        var repo=mock(AiModelUsageRecordRepository.class);var endpoints=mock(AiModelEndpointRepository.class);var invoke=mock(AiModelInvocationService.class);
        var record=new AiModelUsageRecord();record.setId("r");record.setProviderId("ep");record.setRequestBodyJson("{\"messages\":[{\"role\":\"user\",\"content\":[{\"type\":\"image_url\",\"image_url\":{\"url\":\"[image payload omitted]\"}}]}]}");
        when(repo.findById("r")).thenReturn(Optional.of(record));when(endpoints.findById("ep")).thenReturn(Optional.of(new AiModelEndpoint()));
        var service=new AiModelUsageAdminService(repo,endpoints,mock(AiModelUsageService.class),invoke,new com.fasterxml.jackson.databind.ObjectMapper());
        assertEquals("LLM_REPLAY_MEDIA_UNAVAILABLE",assertThrows(BusinessException.class,()->service.replay("r")).getCode());verifyNoInteractions(invoke);
    }
}
