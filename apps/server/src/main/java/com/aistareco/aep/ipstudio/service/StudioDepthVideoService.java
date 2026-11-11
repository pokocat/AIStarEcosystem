package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.file.*;
import java.util.*;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

/**
 * Motion-control video for 深度复刻, following ReShot's published workflow (github.com/maosika-ai/reshot, Apache-2.0):
 * <ul>
 *   <li>The reference is first re-timed to constant 24 fps by its real timestamps. ReShot picks frames as index / fps,
 *       so variable-frame-rate phone footage drifted up to 1.25 s against the original (2026-11-08, 9862).</li>
 *   <li>When the DWPose runtime is installed, a skeleton video is tried first and kept when whole bodies are visible in
 *       most frames (dance, outfit changes, a person lying under a top-down camera, where depth shows nothing but the
 *       floor). Otherwise a temporal depth map (Video Depth Anything Small) is made. Close-ups go to depth: ReShot notes the
 *       estimator then draws guessed shoulders and hips along the frame edge.</li>
 *   <li>The control video is kept small ({@code --max-res 320}): ReShot found a full-size silhouette pulls the new
 *       character's face shape towards the person in the reference.</li>
 * </ul>
 * Only trusted, operator-configured executables/weights are used; user text never becomes a command argument.
 */
@Service
public class StudioDepthVideoService {
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(StudioDepthVideoService.class);
    /** ReShot's MiniMax H3 / Seedance presets both resample control videos to 24 fps. */
    static final int CONTROL_FPS=24;
    /** OpenPose-18 body indices in ReShot's keypoint layout: shoulders, hips, knees. */
    private static final int[] BODY_JOINTS={2,5,8,11,9,12};
    /** 肩宽超过画面宽度这个比例算近景：9862 车内近景中位 0.459，骨骼把方向盘后看不到的腿也画了出来；9861 俯拍躺姿 0.147。 */
    private static final double VISIBLE=0.3,EDGE=0.02,CLOSE_UP_SHOULDERS=0.35;
    private final Semaphore slot=new Semaphore(1,true);
    private final FileStorageService storage;
    private final IpProjectService projects;
    private final FfmpegRunner ffmpeg;
    private final ObjectMapper mapper;
    private final String command,checkpoint,poseCheckpointDir;
    private final long timeoutMs;
    private final int maxRes;
    private final double poseCoverage;

    public StudioDepthVideoService(FileStorageService storage,IpProjectService projects,FfmpegRunner ffmpeg,ObjectMapper mapper,
            String command,String checkpoint,long timeoutMs) {
        this(storage,projects,ffmpeg,mapper,command,checkpoint,timeoutMs,"",320,0.5);
    }
    @Autowired
    public StudioDepthVideoService(FileStorageService storage,IpProjectService projects,FfmpegRunner ffmpeg,ObjectMapper mapper,
            @Value("${aep.studio.depth.command:}") String command,@Value("${aep.studio.depth.checkpoint:}") String checkpoint,
            @Value("${aep.studio.depth.timeout-ms:1200000}") long timeoutMs,
            @Value("${aep.studio.depth.pose-checkpoint-dir:}") String poseCheckpointDir,
            @Value("${aep.studio.depth.max-res:320}") int maxRes,
            @Value("${aep.studio.depth.pose-min-coverage:0.5}") double poseCoverage) {
        this.storage=storage;this.projects=projects;this.ffmpeg=ffmpeg;this.mapper=mapper;
        this.command=command;this.checkpoint=checkpoint;this.timeoutMs=Math.min(1800000,Math.max(1000,timeoutMs));
        this.poseCheckpointDir=poseCheckpointDir==null?"":poseCheckpointDir.strip();
        this.maxRes=Math.max(160,Math.min(1280,maxRes));this.poseCoverage=Math.max(0,Math.min(1,poseCoverage));
    }
    public boolean configured() {return executable(command)&&!checkpoint.isBlank()&&Files.isRegularFile(Path.of(checkpoint));}
    /** DWPose weights are optional; without them every reference uses depth. */
    public boolean poseConfigured() {
        if(poseCheckpointDir.isBlank()||!Path.of(poseCheckpointDir).isAbsolute())return false;
        Path dir=Path.of(poseCheckpointDir);
        return Files.isRegularFile(dir.resolve("yolox_l.onnx"))&&Files.isRegularFile(dir.resolve("dw-ll_ucoco_384.onnx"));
    }
    private static boolean executable(String command) {return !command.isBlank()&&Path.of(command).isAbsolute()&&Files.isExecutable(Path.of(command));}
    public void requireConfigured() {
        if(!configured())throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"STUDIO_DEPTH_NOT_CONFIGURED","深度复刻暂不可用，请联系平台处理。");
    }
    public record Source(String key,double seconds,int width,int height) {}
    /** Decode real bytes before accepting a task; do not trust client duration metadata. */
    public Source source(String user,String key) {
        String owned=projects.requireOwnedAssetKey(user,key);
        try {return inspect(owned,storage.openForRead(owned));}
        catch(BusinessException e){throw e;}
        catch(Exception e){throw BusinessException.badRequest("STUDIO_CLONE_VIDEO_INVALID","参考视频无法读取，请更换可播放的视频。");}
    }
    private Source inspect(String key,Path path) throws Exception {
        var info=mapper.readTree(ffmpeg.runFfprobe(List.of("-v","error","-show_streams","-show_format","-of","json",path.toString())));
        double seconds=info.path("format").path("duration").asDouble();int width=0,height=0,count=0;
        for(var stream:info.path("streams"))if("video".equals(stream.path("codec_type").asText())) {
            width=stream.path("width").asInt();height=stream.path("height").asInt();count++;
            // The picture is what the control video follows; an audio tail must not count (2026-11-08 review).
            double own=stream.path("duration").asDouble(0);if(own>0)seconds=own;
        }
        if(count!=1||width<=0||height<=0||!Double.isFinite(seconds)||seconds<=0||Files.size(path)>200L*1024*1024)
            throw BusinessException.badRequest("STUDIO_CLONE_VIDEO_INVALID","请选择不超过 200 MB、可播放的单画面视频。");
        return new Source(key,seconds,width,height);
    }
    public ObjectNode convert(String user,String key,BooleanSupplier heartbeat) throws Exception {
        requireConfigured();Source source=source(user,key);
        // Process the complete reference. Channel-specific duration limits are checked when the task is accepted.
        if(source.seconds()>60.05)throw BusinessException.badRequest("STUDIO_CLONE_VIDEO_TOO_LONG","参考视频最长 60 秒，请先裁剪后重试。");
        boolean acquired=false;Path directory=null;
        try {
            while(!(acquired=slot.tryAcquire(1,TimeUnit.SECONDS)))if(!heartbeat.getAsBoolean())throw new InterruptedException("canceled");
            if(!heartbeat.getAsBoolean())throw new InterruptedException("canceled");
            long started=System.nanoTime();
            directory=Files.createTempDirectory("studio-depth-");
            Path timed=directory.resolve("reference-24fps.mp4");
            // Real timestamps → constant frame clock. The fps filter reads PTS, so VFR footage keeps its timing.
            ffmpeg.runFfmpeg(List.of("-v","error","-nostdin","-y","-i",storage.openForRead(source.key()).toString(),"-map","0:v:0","-an",
                    "-vf","fps="+CONTROL_FPS+",setsar=1","-c:v","libx264","-preset","veryfast","-crf","14","-pix_fmt","yuv420p",timed.toString()),
                    remaining(started));
            Source reference=inspect("",timed);
            String control="depth";Double coverage=null;Path output=null;
            if(poseConfigured()) {
                Path pose=directory.resolve("pose.mp4"),keypoints=directory.resolve("pose.json");
                try {
                    reshot(List.of(command,timed.toString(),"-o",pose.toString(),"--control","pose","--checkpoint-dir",poseCheckpointDir,
                            "--keypoints",keypoints.toString(),"--target","h3","--max-res",String.valueOf(maxRes)),directory,"pose",started,heartbeat);
                    coverage=bodyCoverage(mapper.readTree(keypoints.toFile()));
                    if(coverage>=poseCoverage){control="pose";output=pose;}
                } catch(InterruptedException e){throw e;}
                catch(Exception e){log.warn("[studio-depth] pose pass failed, using depth user={} source={} reason={}",user,key,e.toString());}
            }
            if(output==null) {
                output=directory.resolve("depth.mp4");
                reshot(List.of(command,timed.toString(),"-o",output.toString(),"--control","depth","--model","small","--checkpoint",checkpoint,
                        "--target","h3","--quality","fast","--max-res",String.valueOf(maxRes)),directory,"depth",started,heartbeat);
            }
            Source result=inspect("",output);
            if(Math.abs(result.seconds()-reference.seconds())>0.15)throw new java.io.IOException("control duration changed "+reference.seconds()+" -> "+result.seconds());
            if(!heartbeat.getAsBoolean())throw new InterruptedException("canceled");
            var stored=storage.store(Files.readAllBytes(output),IpProjectService.CATEGORY_GEN,user,"mp4","video/mp4");
            log.info("[studio-depth] control video done user={} source={} control={} poseCoverage={} seconds={} size={}x{}",
                    user,key,control,coverage,result.seconds(),result.width(),result.height());
            ObjectNode out=mapper.createObjectNode().put("storageKey",stored.key()).put("sourceStorageKey",source.key())
                    .put("durationSec",result.seconds()).put("width",result.width()).put("height",result.height())
                    .put("controlType",control).put("fps",CONTROL_FPS).put("processor","reshot-"+("pose".equals(control)?"dwpose":"vda-small")).put("mock",false);
            if(coverage!=null)out.put("poseCoverage",Math.round(coverage*1000)/1000.0);
            return out;
        } catch(InterruptedException e){Thread.currentThread().interrupt();throw e;}
        catch(BusinessException e){throw e;}
        catch(Exception e){log.warn("[studio-depth] processing failed user={} source={} reason={}",user,key,e.toString());
            throw new BusinessException(HttpStatus.BAD_GATEWAY,"STUDIO_DEPTH_FAILED","参考视频的动作提取没有完成，请重试。已完成的内容已保留。");}
        finally {
            if(acquired)slot.release();
            if(directory!=null)try(var paths=Files.walk(directory)){for(Path p:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(p);}
                catch(Exception cleanup){log.warn("[studio-depth] temporary cleanup failed directory={} reason={}",directory,cleanup.toString());}
        }
    }
    private long remaining(long started) throws java.io.IOException {
        long left=timeoutMs-TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-started);
        if(left<=0)throw new java.io.IOException("control video timeout");
        return left;
    }
    /** One ReShot run. Its memory preflight stays on: no --force. */
    private void reshot(List<String> args,Path directory,String label,long started,BooleanSupplier heartbeat) throws Exception {
        Path logFile=directory.resolve(label+".log");Process process=null;
        try {
            process=new ProcessBuilder(args).redirectErrorStream(true).redirectOutput(logFile.toFile()).start();
            while(!process.waitFor(1,TimeUnit.SECONDS)) {
                if(!heartbeat.getAsBoolean())throw new InterruptedException("canceled");
                remaining(started);
            }
            if(process.exitValue()!=0) {
                String detail=new String(Files.readAllBytes(logFile),java.nio.charset.StandardCharsets.UTF_8);
                log.warn("[studio-depth] reshot {} failed exit={} detail={}",label,process.exitValue(),detail.substring(Math.max(0,detail.length()-4000)));
                throw new java.io.IOException("reshot "+label+" failed");
            }
        } finally {
            if(process!=null&&process.isAlive()){process.descendants().forEach(ProcessHandle::destroy);process.destroyForcibly();}
        }
    }
    /**
     * Share of frames in which at least one person shows four of the six large body joints (shoulders, hips, knees)
     * confidently and inside the picture, and is not a close-up (shoulders wider than 35% of the frame: the estimator
     * then invents the hidden legs). Threshold 0.5, not higher: occluded frames and platform end cards have nobody in
     * them (9861: 0.592 with a fan blade sweeping over and a 3 s end card, its skeletons still clearly the better control).
     */
    static double bodyCoverage(JsonNode clip) {
        int width=clip.path("width").asInt(),height=clip.path("height").asInt(),frames=0,covered=0;
        if(width<=0||height<=0)return 0;
        for(JsonNode frame:clip.path("frames")) {
            frames++;
            for(JsonNode person:frame.path("people")) {
                int seen=0;
                for(int joint:BODY_JOINTS) {
                    double score=person.path("scores").path(joint).asDouble(0);
                    JsonNode point=person.path("keypoints").path(joint);
                    double x=point.path(0).asDouble(-1)/width,y=point.path(1).asDouble(-1)/height;
                    if(score>VISIBLE&&x>EDGE&&x<1-EDGE&&y>EDGE&&y<1-EDGE)seen++;
                }
                double shoulders=person.path("scores").path(2).asDouble(0)>VISIBLE&&person.path("scores").path(5).asDouble(0)>VISIBLE
                        ?Math.abs(person.path("keypoints").path(2).path(0).asDouble()-person.path("keypoints").path(5).path(0).asDouble())/width:0;
                if(seen>=4&&shoulders<=CLOSE_UP_SHOULDERS){covered++;break;}
            }
        }
        return frames==0?0:(double)covered/frames;
    }
}
