package com.aistareco.aep.service;
import com.aistareco.aep.controller.ModelResultsController;
import com.aistareco.aep.model.AiModelUsageRecord;
import com.aistareco.aep.repository.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class ModelOutputArchiveTest {
 @Test void archiveKeepsLongPlainTextAndMalformedJsonVerbatim() throws Exception {
  var repo=mock(AiModelUsageRecordRepository.class);
  var row=AiModelUsageRecord.builder().id("r").userId("owner").appCode("aiavatar").requestId("q").responseBodyJson("{\"choices\":[]}").build();
  when(repo.findFirstByRequestIdOrderByCreatedAtDesc("q")).thenReturn(Optional.of(row));
  var service=new AiModelUsageService(repo,mock(AiModelEndpointRepository.class),mock(AepUserRepository.class),mock(TenantRepository.class),mock(MembershipRepository.class));
  String text="未整理的长篇原文\\q\n".repeat(10000);
  service.preserveOutput("q",text,"length");
  var body=new ObjectMapper().readTree(row.getResponseBodyJson());
  assertEquals(text,body.path("preservedContent").asText());assertTrue(body.has("choices"));
  when(repo.findByIdAndUserIdAndAppCode("r","owner","aiavatar")).thenReturn(Optional.of(row));
  var controller=new ModelResultsController(repo,new ObjectMapper());
  assertEquals(text,controller.detail(()->"owner","aiavatar","r").data().content());
  assertThrows(BusinessException.class,()->controller.detail(()->"someone-else","aiavatar","r"));
  assertThrows(BusinessException.class,()->controller.detail(()->"owner","drama","r"));
 }
 @Test void unauthenticatedCallerCannotListAnyOutputs(){
  var repo=mock(AiModelUsageRecordRepository.class);var controller=new ModelResultsController(repo,new ObjectMapper());
  assertThrows(BusinessException.class,()->controller.list(null,"aiavatar",0));verifyNoInteractions(repo);
 }
}
