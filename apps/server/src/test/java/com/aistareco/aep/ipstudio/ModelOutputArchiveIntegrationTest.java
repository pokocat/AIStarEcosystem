package com.aistareco.aep.ipstudio;

import com.aistareco.aep.controller.ModelResultsController;
import com.aistareco.aep.model.AiModelUsageRecord;
import com.aistareco.aep.repository.AiModelUsageRecordRepository;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql=false,properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop"})
@Import({AiModelUsageService.class,ModelResultsController.class,ModelOutputArchiveIntegrationTest.Config.class})
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class ModelOutputArchiveIntegrationTest {
 @org.springframework.boot.test.context.TestConfiguration static class Config {
  @org.springframework.context.annotation.Bean com.fasterxml.jackson.databind.ObjectMapper mapper(){return new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules();}
 }
 @Autowired AiModelUsageRecordRepository records;
 @Autowired AiModelUsageService usage;
 @Autowired ModelResultsController controller;
 @Test void persistedLongOutputHasOwnerAndProductIsolationAndSurvivesFormattingFailure() throws Exception {
  var row=AiModelUsageRecord.builder().id("archive-test").requestId("archive-request").userId("owner").appCode("aiavatar")
    .providerName("Test model").responseBodyJson("{\"choices\":[]}").build();
  records.saveAndFlush(row);
  String text="长篇原文\\q\n<script>不可执行</script>".repeat(4000);
  usage.preserveOutput("archive-request",text,"length");
  assertEquals(1,controller.list(()->"owner","aiavatar",0,null).data().size());
  assertEquals(text,controller.detail(()->"owner","aiavatar",row.getId()).data().content());
  assertTrue(controller.list(()->"other","aiavatar",0,null).data().isEmpty());
  assertTrue(controller.list(()->"owner","drama",0,null).data().isEmpty());
  assertThrows(BusinessException.class,()->controller.detail(()->"other","aiavatar",row.getId()));
 }

 /** V80：任务执行时的调用记下任务编号，任务历史按它找到原文；别的任务、别的账号看不到。用单独的账号，不与上一条用例的计数互相影响。 */
 @Test void outputRecordedInsideATaskIsFoundByThatTaskOnly() {
  try (var task=com.aistareco.aep.service.AiModelUsageContext.bind("task-owner","aiavatar","IPR-task-1")) {
   usage.recordObserved("ep-1","Test model","m","DAP_PERSONA",1L,1L,2L,true,"task-request",null,null,null,null);
  }
  usage.preserveOutput("task-request","第一镜：开场","stop");
  assertEquals("IPR-task-1",records.findFirstByRequestIdOrderByCreatedAtDesc("task-request").orElseThrow().getTaskId());
  assertEquals(1,controller.list(()->"task-owner","aiavatar",0,"IPR-task-1").data().size());
  assertTrue(controller.list(()->"task-owner","aiavatar",0,"IPR-task-2").data().isEmpty());
  assertTrue(controller.list(()->"other","aiavatar",0,"IPR-task-1").data().isEmpty());
  assertEquals(java.util.List.of("IPR-task-1"),records.tasksWithPreserved("task-owner","aiavatar",java.util.List.of("IPR-task-1","IPR-task-2"),"%\"preservedContent\"%"));
 }
}
