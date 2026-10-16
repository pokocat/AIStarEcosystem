package com.aistareco.aep.service;
import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class EndpointDraftProbeTest {
 private final AiModelEndpointRepository repo=mock(AiModelEndpointRepository.class);
 private final AiModelInvocationService invocation=mock(AiModelInvocationService.class);
 private final AiModelEndpointAdminService service=new AiModelEndpointAdminService(repo,mock(AiAppBindingRepository.class),invocation);
 @Test void previewsCurrentCredentialsWithoutSavingOrGenerating() {
  var req=new AiModelDiscoveryRequestDto("OPENAI","https://8.8.8.8/v1","fixture-key");
  when(invocation.listModels(AiModelProviderType.OPENAI,req.baseUrl(),req.apiKey())).thenReturn(AiModelDiscoveryResultDto.ok(200,List.of()));
  assertTrue(service.probeDraft(null,req).ok());
  verify(invocation).listModels(AiModelProviderType.OPENAI,req.baseUrl(),req.apiKey());
  verifyNoMoreInteractions(invocation); verifyNoInteractions(repo);
 }
 @Test void rejectsPrivateOrCredentialBearingUrlsBeforeAnyRequest() {
  for(String url:List.of("http://8.8.8.8/v1","https://127.0.0.1/v1","https://169.254.169.254/v1","https://user:secret@8.8.8.8/v1","https://8.8.8.8/v1?key=secret"))
   assertFalse(service.probeDraft(null,new AiModelDiscoveryRequestDto("OPENAI",url,"fixture")).ok());
  verifyNoInteractions(invocation,repo);
 }
 @Test void cannotSendSavedCredentialToChangedSupplier() {
  when(repo.findById("saved")).thenReturn(Optional.of(AiModelEndpoint.builder().id("saved").baseUrl("https://1.1.1.1/v1").build()));
  assertThrows(BusinessException.class,()->service.probeDraft("saved",new AiModelDiscoveryRequestDto("OPENAI","https://8.8.8.8/v1",null)));
  verifyNoInteractions(invocation);
 }
}
