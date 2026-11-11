package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.enrollment.model.ProductEnrollment.*;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.ipstudio.dto.StudioSegmentedDtos.*;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.repository.*;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.*;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;
import javax.imageio.ImageIO;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real HTTP adapter, persistence, native workers/ledger, file mirroring and ReShot; only the video vendor is local.
 * Opt-in because a normal test run must not download model weights or require a configured inference runtime. */
@EnabledIfEnvironmentVariable(named="STUDIO_DEPTH_REAL",matches="1")
// 2026-11-11 深度复刻和元素替换改成和分镜复刻一样先拉片（要真实的视频理解模型）、再按原片分段，这条单段直出的真实链路要按新流程重写（TODO.md「爆款复刻三种方式」）
@Disabled("按新流程重写前不跑")
@SpringBootTest(properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:studio-clone-it;MODE=MySQL;NON_KEYWORDS=CAST;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000",
        "aep.seed.dev-data.enabled=false","aep.cdn.driver=local","aep.dev-auth.enabled=false",
        "aep.dev-fake-llm.enabled=false","aep.dap.monthly-grant=0","aep.material.video.poll-interval-seconds=1"})
@ActiveProfiles("test") @AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class StudioCloneTaskIntegrationTest {
    static Path directory;
    static HttpServer http;
    static final ExecutorService httpThreads=Executors.newFixedThreadPool(2);
    static final ObjectMapper JSON=new ObjectMapper();
    static final List<JsonNode> submissions=new CopyOnWriteArrayList<>();
    static final AtomicBoolean releaseVideo=new AtomicBoolean();
    static String base;

    @DynamicPropertySource static void environment(DynamicPropertyRegistry properties) throws Exception {
        directory=Files.createTempDirectory("studio-clone-it-");
        // Development LAN address is explicit: real upstream URL validation correctly refuses localhost assets.
        String host=Objects.requireNonNull(System.getenv("STUDIO_CLONE_CDN_HOST"),"STUDIO_CLONE_CDN_HOST is required");
        http=HttpServer.create(new InetSocketAddress(host,0),0);
        http.setExecutor(httpThreads);
        http.createContext("/",StudioCloneTaskIntegrationTest::serve);http.start();
        base="http://"+host+":"+http.getAddress().getPort();
        properties.add("aep.storage.local-dir",()->directory.resolve("files").toString());
        properties.add("aep.cdn.local-root",()->directory.resolve("cdn").toString());
        properties.add("aep.cdn.public-base-url",()->base+"/cdn");
        properties.add("aep.studio.depth.command",()->System.getenv("STUDIO_DEPTH_HOME")+"/venv/bin/reshot");
        properties.add("aep.studio.depth.checkpoint",()->System.getenv("STUDIO_DEPTH_HOME")+"/weights/video_depth_anything_vits.pth");
    }

    static void serve(HttpExchange exchange) throws java.io.IOException {
        String path=exchange.getRequestURI().getPath();byte[] bytes;String type="application/json";
        if("POST".equals(exchange.getRequestMethod())&&"/tasks".equals(path)) {
            submissions.add(JSON.readTree(exchange.getRequestBody()));
            bytes=JSON.writeValueAsBytes(Map.of("id","local-"+submissions.size(),"status","processing"));
        } else if(path.startsWith("/tasks/")) {
            bytes=JSON.writeValueAsBytes(releaseVideo.get()?Map.of("status","succeeded","video_url",base+"/output.mp4"):Map.of("status","processing"));
        } else {
            Path file="/output.mp4".equals(path)?directory.resolve("output.mp4")
                    :directory.resolve("cdn").resolve(path.replaceFirst("^/cdn/","")).normalize();
            if(!file.startsWith(directory)||!Files.isRegularFile(file)){exchange.sendResponseHeaders(404,-1);exchange.close();return;}
            bytes=Files.readAllBytes(file);type=path.endsWith(".png")?"image/png":"video/mp4";
        }
        exchange.getResponseHeaders().set("Content-Type",type);exchange.sendResponseHeaders(200,bytes.length);
        try(var out=exchange.getResponseBody()){out.write(bytes);}
    }

    @Autowired StudioVideoTaskService tasks;
    @Autowired StudioPlanExecutor executor;
    @Autowired IpPlanExecutionRepository executions;
    @Autowired IpProjectRepository projects;
    @Autowired IpRunRepository runs;
    @Autowired FileStorageService storage;
    @Autowired AepUserRepository users;
    @Autowired EnrollmentService enrollment;
    @Autowired CreditService credits;
    @Autowired WalletRepository wallets;
    @Autowired CreditHoldRepository holds;
    @Autowired AiModelEndpointRepository endpoints;
    @Autowired AiAppEndpointCandidateRepository candidates;
    @Autowired AiAppBindingRepository bindings;
    @Autowired PlatformConfigService configs;
    @Autowired MaterialVideoJobRepository videoJobs;
    @Autowired MockMvc mvc;

    @BeforeAll static void outputFixture() throws Exception {
        var process=new ProcessBuilder("ffmpeg","-v","error","-nostdin","-y","-f","lavfi","-i",
                "testsrc2=s=320x180:r=24:d=5","-c:v","libx264","-threads","2","-pix_fmt","yuv420p",directory.resolve("output.mp4").toString())
                .redirectError(ProcessBuilder.Redirect.INHERIT).start();
        assertTrue(process.waitFor(30,TimeUnit.SECONDS));assertEquals(0,process.exitValue());
    }
    @AfterAll static void cleanup() throws Exception {
        if(http!=null)http.stop(0);httpThreads.shutdownNow();
        if(directory!=null)try(var paths=Files.walk(directory)){for(Path p:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(p);}
    }

    @Test void depthTaskRunsRealControlBeforeNativeVideoAndRecoversFromTheApi() throws Exception {exercise("depth");}
    @Test void replacementTaskUsesOriginalVideoWithoutCreatingAControlRun() throws Exception {exercise("replacement");}
    @Test void promptOnlyReplacementCompletesWithoutInventingAnImageReference() throws Exception {exercise("replacement",false);}

    void exercise(String kind) throws Exception {exercise(kind,true);}
    void exercise(String kind,boolean usePicture) throws Exception {
        submissions.clear();releaseVideo.set(false);
        String owner="clone-"+UUID.randomUUID().toString().substring(0,12),endpoint="ep-"+owner,project="p-"+owner;
        users.save(AepUser.builder().id(owner).username(owner).displayName("复刻链路测试")
                .status(AepUser.UserStatus.ACTIVE).kind(AepUser.AccountKind.PERSONAL).phoneVerified(true).createdAt(Instant.now()).build());
        enrollment.upsert(owner,"aiavatar",EnrollmentStatus.ACTIVE,EnrollmentSource.ADMIN,null);
        credits.creditAccount(owner,500,LedgerEntry.LedgerEntryType.GIFT,"test",owner,"测试积分");
        var legacy=VideoStudioService.contract(5,15);
        var contract=new VideoStudioContract(List.of(legacy.modes().get(3)),legacy.tiers(),5,15,4000,100);
        var spec=new AiVideoRequestSpec("json-template",contract,"/tasks","/tasks/{id}",Map.of(),null,null,
                Map.of("universal_reference_video",Map.of("prompt","${prompt}","seconds","${seconds}","references","${references}")));
        endpoints.save(AiModelEndpoint.builder().id(endpoint).name("本地复刻测试").model("local-clone")
                .providerType(AiModelProviderType.OPENAI_COMPATIBLE).baseUrl(base).upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("local-test"))
                .billingMode(AiModelBillingMode.PER_SECOND).videoRequestSpecJson(spec.json()).enabled(true).build());
        candidates.save(AiAppEndpointCandidate.builder().id("c-"+owner).purpose(AiModelPurpose.VIDEO_GENERATION).endpointId(endpoint).creditCostOverride(2L).enabled(true).build());
        bindings.save(AiAppBinding.builder().purpose(AiModelPurpose.VIDEO_GENERATION).endpointId(endpoint).build());
        configs.upsert("ai.app-model-group.studio.video",JSON.valueToTree(Map.of("defaultEndpointId",endpoint,"endpointIds",List.of(endpoint))),"本地测试","test");
        var source=storage.store(Files.readAllBytes(Path.of(System.getenv("STUDIO_DEPTH_SOURCE"))),IpProjectService.CATEGORY_SOURCE,owner,"mp4","video/mp4");
        var image=new BufferedImage(320,180,BufferedImage.TYPE_INT_RGB);var graphics=image.createGraphics();
        graphics.setColor(java.awt.Color.GREEN);graphics.fillRect(0,0,320,180);graphics.dispose();var png=new ByteArrayOutputStream();ImageIO.write(image,"png",png);
        var picture=storage.store(png.toByteArray(),IpProjectService.CATEGORY_SOURCE,owner,"png","image/png");
        ObjectNode doc=JSON.createObjectNode();var nodes=doc.putArray("nodes");
        nodes.addObject().put("id","source").put("type","video").put("title","测试原片").putObject("metadata").put("storageKey",source.key());
        nodes.addObject().put("id","product").put("type","image").put("title","替换图片").putObject("metadata").put("storageKey",picture.key());
        doc.putArray("connections");doc.putObject("viewport").put("x",0).put("y",0).put("k",1);
        projects.saveAndFlush(IpProject.builder().id(project).ownerUserId(owner).name("复刻测试").sceneId("recreation").status("draft")
                .docJson(doc.toString()).createdAt(Instant.now()).updatedAt(Instant.now()).build());
        var quote=tasks.price(owner,kind,endpoint,null,"544p",5,"16:9",usePicture?1:0,false,false,false);
        var config=new SegmentedVideoRequest(owner,"recreation",usePicture?"把主体换成所附图片中的绿色产品":"把主体换成一个绿色的长方形产品",false,Map.of(),"zh",5,"16:9",endpoint,"544p",false,
                usePicture?List.of(new SegmentedMaterial("product","替换图片","image")):List.of(),quote.cap(),null);
        var request=new StudioVideoTaskService.Create(owner,kind,"recreation","复刻测试",config,null,quote.cap(),"source",JSON.createObjectNode(),null);
        var accepted=tasks.start(owner,project,request);
        String id=accepted.id();assertEquals("running",accepted.execution().status());
        // The browser may change its draft after acceptance; the execution must use the accepted keys.
        var changed=projects.findById(project).orElseThrow();
        ((ObjectNode)doc.path("nodes").path(1).path("metadata")).put("storageKey",picture.key().replace(".png","-changed.png"));
        changed.setDocJson(doc.toString());projects.saveAndFlush(changed);
        await(()->!submissions.isEmpty(),id,150);
        assertEquals(1,submissions.size());
        String wire=submissions.get(0).toString();assertEquals(usePicture,wire.contains(picture.key()),wire);
        var nativeRows=runs.findByProjectIdOrderByCreatedAtDesc(project);
        var control=nativeRows.stream().filter(r->"studio-video-control".equals(r.getKind())).findFirst();
        if("depth".equals(kind)) {
            assertTrue(control.isPresent());assertEquals("done",control.get().getStatus());
            var output=JSON.readTree(control.get().getOutputJson());String depthKey=output.path("storageKey").asText();
            assertFalse(depthKey.isBlank());assertFalse(output.path("mock").asBoolean());
            assertTrue(wire.contains(depthKey),wire);assertFalse(wire.contains(source.key()),wire);assertEquals(0,control.get().getCost());
        } else {assertTrue(control.isEmpty());assertTrue(wire.contains(source.key()),wire);}
        assertTrue(wallets.findByUserId(owner).orElseThrow().getPendingBalance()>0);
        assertEquals(id,tasks.start(owner,project,request).id());assertEquals(1,submissions.size(),"replay must not generate again");
        releaseVideo.set(true);
        await(()->"done".equals(tasks.get(owner,id).execution().status()),id,45);
        var completed=tasks.get(owner,id);assertTrue(completed.execution().steps().stream().allMatch(s->"done".equals(s.status())));
        var videoStep=completed.execution().steps().stream().filter(s->"video".equals(s.operation())).findFirst().orElseThrow();
        var videoRun=runs.findById(videoStep.runIds().get(0)).orElseThrow();
        JsonNode inputs=JSON.readTree(videoRun.getInputJson());String jobId=inputs.path("_exec").path("nativeVideoJobIds").path(0).asText();
        var job=videoJobs.findById(jobId).orElseThrow();assertEquals("succeeded",job.getStatus());
        String outputKey=storage.keyOfStoredUrl(job.getVideoUrl());assertNotNull(outputKey);assertTrue(Files.size(storage.openForRead(outputKey))>10000);
        assertEquals(CreditHold.Status.COMMITTED,holds.findByReferenceTypeAndReferenceId("material_video_job",jobId).orElseThrow().getStatus());
        assertEquals(500-quote.estimated(),wallets.findByUserId(owner).orElseThrow().getTotalBalance());
        assertEquals(0,wallets.findByUserId(owner).orElseThrow().getPendingBalance());
        for(int n=0;n<3;n++) {
            String body=mvc.perform(get("/api/v1/ip-studio/video-tasks/"+id).with(user(owner)).header("X-App-Code","aiavatar"))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            assertTrue(body.contains(id));assertTrue(body.contains("done"));
        }
        assertEquals(1,submissions.size());
    }

    void await(BooleanSupplier condition,String id,int seconds) throws Exception {
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(seconds);
        while(System.nanoTime()<deadline) {executor.advance(id);if(condition.getAsBoolean())return;Thread.sleep(100);}
        fail("Task did not reach expected state: "+JSON.writeValueAsString(tasks.get(executions.findById(id).orElseThrow().getOwnerUserId(),id)));
    }
}
