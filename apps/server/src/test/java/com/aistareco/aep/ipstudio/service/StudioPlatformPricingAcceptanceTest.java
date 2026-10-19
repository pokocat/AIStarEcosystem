package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioSpeechDtos.*;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Opt-in acceptance against local real platform HTTP plus H2 ledger and a fake speech supplier. */
@DataJpaTest(showSql=false,properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop"})
@Import(CreditService.class)
@Transactional(propagation=Propagation.NOT_SUPPORTED)
@EnabledIfEnvironmentVariable(named="STUDIO_PRICING_FIXTURE_CREDENTIAL",matches=".+")
class StudioPlatformPricingAcceptanceTest {
 @Autowired IpRunRepository runs;@Autowired CreditService credits;@Autowired WalletRepository wallets;
 @Autowired LedgerEntryRepository ledger;@Autowired AiModelEndpointRepository endpoints;
 @Autowired PlatformTransactionManager manager;
 final ObjectMapper json=new ObjectMapper();
 @Test void realPlatformPriceIsFrozenSettledAndAcknowledgedWithoutPaidProvider() throws Exception {
  String base=System.getenv("STUDIO_PRICING_FIXTURE_BASE_URL");
  if(!base.equals("http://localhost:4410"))throw new IllegalArgumentException("Local acceptance only");
  var env=mock(Environment.class);when(env.getActiveProfiles()).thenReturn(new String[]{"dev"});
  var platform=new StudioPlatformPricing(true,base,System.getenv("STUDIO_PRICING_FIXTURE_CREDENTIAL"),System.getenv("STUDIO_PRICING_FIXTURE_BRAND_ID"),"aistar-aiavatar",true,env,runs,json,manager);
  var pricing=new StudioPointPricing(mock(PlatformConfigService.class));ReflectionTestUtils.setField(pricing,"platform",platform);
  var projects=mock(IpProjectService.class);var models=mock(AiModelInvocationService.class);
  var provider=mock(JusuanSpeechClient.class);var dispatch=mock(StudioSpeechWorker.class);
  var endpoint=AiModelEndpoint.builder().id("ai-jusuan-qwen3-tts").name("本地配音夹具").model("qwen3-tts").baseUrl("https://api.jusuanhub.com/v1").enabled(true).providerType(AiModelProviderType.OPENAI_COMPATIBLE).upstreamApiKeyEncrypted("not-used-local-fake-provider").build();
  endpoints.save(endpoint);
  var candidate=AiAppEndpointCandidate.builder().creditCostOverride(999L).enabled(true).build();
  when(models.resolveEndpoint(AiModelPurpose.DAP_AUDIO,endpoint.getId())).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,candidate,true)));
  when(provider.voices(any())).thenReturn(List.of(new SpeechVoice("Vivian","Vivian","zh-CN","preset")));
  var service=new StudioSpeechService(projects,runs,models,provider,dispatch,credits,json);ReflectionTestUtils.setField(service,"pricing",pricing);
  String owner="local-pricing-owner",project="local-pricing-project",key=UUID.randomUUID().toString();
  credits.adjustUserCredits(owner,Map.of("amount",100L,"description","本地配音计价验收"));
  var request=new SpeechRequest(key,"n",endpoint.getId(),"欢迎。","Vivian",null,20L);
  var tx=new TransactionTemplate(manager);
  tx.executeWithoutResult(s->service.submit(owner,project,request));
  IpRun run=runs.findByProjectIdAndClientRequestId(project,key).orElseThrow();
  assertEquals(20,run.getCost());assertEquals(80,wallets.findByUserId(owner).orElseThrow().getTotalBalance());assertEquals(20,wallets.findByUserId(owner).orElseThrow().getPendingBalance());
  String release=json.readTree(run.getInputJson()).path("_exec").path("pointPricing").path("platformReleaseId").asText();assertFalse(release.isBlank());
  assertEquals("supplier_points",json.readTree(run.getInputJson()).path("_exec").path("pointPricing").path("platformSnapshot").path("costSnapshot").path("definition").path("currency").asText());
  reset(models); // An accepted-key replay survives configuration unavailability and creates no second hold.
  tx.executeWithoutResult(s->service.submit(owner,project,request));
  assertEquals(1,ledger.findByUserIdOrderByCreatedAtDesc(owner).stream().filter(e->e.getEntryType()==LedgerEntry.LedgerEntryType.FREEZE).count());
  var storage=mock(FileStorageService.class);
  when(provider.submit(any(),anyString(),anyString(),eq(run.getId()),eq(owner))).thenReturn(new JusuanSpeechClient.Job("fixture-job","https://local-provider.invalid/v1/jobs/fixture-job?model=qwen3-tts"));
  when(provider.poll(any(),anyString(),anyString(),eq(run.getId()),eq(owner))).thenReturn(json.readTree("{\"status\":\"succeeded\",\"outputs\":[{\"contentUrl\":\"https://local-provider.invalid/v1/assets/fixture/content?model=qwen3-tts\"}]}"));
  when(provider.download(any(),anyString(),anyString(),anyString(),anyString())).thenReturn(new JusuanSpeechClient.Audio(new byte[200],"wav","audio/wav",3.2));
  when(storage.store(any(byte[].class),anyString(),eq(owner),eq("wav"),eq("audio/wav"))).thenReturn(new FileStorageService.StoredFile("ipstudio_gen/fixture/speech.wav",null,null,null,200,"audio/wav"));
  var worker=new StudioSpeechWorker(runs,endpoints,provider,storage,credits,mock(AiModelUsageService.class),json,manager);
  worker.step(run.getId());worker.step(run.getId());worker.step(run.getId());
  var complete=runs.findById(run.getId()).orElseThrow();assertEquals("done",complete.getStatus());assertEquals(6,complete.getCost());
  var wallet=wallets.findByUserId(owner).orElseThrow();assertEquals(94,wallet.getTotalBalance());assertEquals(0,wallet.getPendingBalance());
  var entries=ledger.findByUserIdOrderByCreatedAtDesc(owner);assertEquals(1,entries.stream().filter(e->e.getEntryType()==LedgerEntry.LedgerEntryType.SPEND).count());assertEquals(1,entries.stream().filter(e->e.getEntryType()==LedgerEntry.LedgerEntryType.UNFREEZE).count());
  verify(provider,times(1)).submit(any(),anyString(),anyString(),anyString(),anyString());
  platform.deliverReceipts();platform.deliverReceipts();
  assertTrue(json.readTree(runs.findById(run.getId()).orElseThrow().getInputJson()).path("_exec").path("pricingReported").asBoolean());
  assertEquals(release,json.readTree(complete.getInputJson()).path("_exec").path("pointPricing").path("platformReleaseId").asText());
 }
}
