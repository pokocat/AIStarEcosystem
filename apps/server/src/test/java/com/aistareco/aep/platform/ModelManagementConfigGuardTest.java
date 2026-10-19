package com.aistareco.aep.platform;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.aistareco.aep.service.PlatformConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class ModelManagementConfigGuardTest {
 @Test void absentStableGuardFailsClosedInsteadOfPretendingMissingRowIsLocked(){
  var repo=mock(PlatformConfigRepository.class);when(repo.lockByConfigKey("celebrity.action-pricing")).thenReturn(Optional.empty());var config=new PlatformConfigService(repo,new ObjectMapper());
  var e=assertThrows(ResponseStatusException.class,()->config.lockRequired("celebrity.action-pricing"));assertEquals(HttpStatus.SERVICE_UNAVAILABLE,e.getStatusCode());verify(repo).lockByConfigKey("celebrity.action-pricing");verifyNoMoreInteractions(repo);
 }
}
