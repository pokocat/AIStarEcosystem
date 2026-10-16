package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.nio.file.*;
import java.util.concurrent.TimeUnit;

/** Direct Hypit native-frame and visual-boundary adapter, pinned and bundled in the JAR. */
@Service
public class StudioHypitMedia {
    static final String REVISION="dc2b7a8f31b1ef1443a79ca448548d69e3ceb6a0";
    private static final ObjectMapper JSON=new ObjectMapper();
    private final String node;
    private volatile Path script;
    private volatile boolean ready;
    public StudioHypitMedia(@Value("${aep.ipstudio.recreation.hypit-node:${AEP_STUDIO_HYPIT_NODE:node}}") String node){this.node=node;}
    public synchronized void requireReady() {
        if(ready)return;
        try {
            if(script==null){script=Files.createTempFile("studio-hypit-media-",".mjs");try(var source=StudioHypitMedia.class.getResourceAsStream("/hypit-media/cli.mjs")){if(source==null)throw new IllegalStateException("Missing adapter");Files.copy(source,script,StandardCopyOption.REPLACE_EXISTING);}script.toFile().deleteOnExit();}
            Path version=Files.createTempFile("studio-hypit-version-",".json");
            try {
                var process=builder(script.toString(),"--version").redirectOutput(version.toFile()).start();
                if(!process.waitFor(15,TimeUnit.SECONDS)){process.destroyForcibly();throw new IllegalStateException("Node timeout");}
                JsonNode info=JSON.readTree(Files.readString(version));
                if(process.exitValue()!=0||!REVISION.equals(info.path("revision").asText())||!"hypit-media".equals(info.path("engine").asText()))throw new IllegalStateException("Unexpected adapter");
                var media=configureMediaRuntime(new ProcessBuilder("ffmpeg","-v","error","-f","lavfi","-i","color=s=16x16:d=0.04","-vf","scale=16:16:force_divisible_by=2","-fps_mode","passthrough","-frames:v","1","-f","null","-"))
                        .redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD).start();
                if(!media.waitFor(15,TimeUnit.SECONDS)){media.destroyForcibly();throw new IllegalStateException("FFmpeg timeout");}
                if(media.exitValue()!=0)throw new IllegalStateException("FFmpeg runtime unsupported");
                ready=true;
            }finally{Files.deleteIfExists(version);}
        } catch(Exception e){throw new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"STUDIO_HYPIT_UNAVAILABLE","视频处理工具不可用，请配置Node.js 22以上、FFmpeg 5.1以上及Hypit媒体适配器");}
    }
    JsonNode read(Path source,Path directory,double duration) throws Exception {
        requireReady();var process=builder(script.toString(),source.toAbsolutePath().toString(),directory.toAbsolutePath().toString(),Double.toString(duration)).redirectOutput(ProcessBuilder.Redirect.DISCARD).start();
        if(!process.waitFor(240,TimeUnit.SECONDS)){process.destroyForcibly();throw new IllegalStateException("Hypit media timeout");}
        if(process.exitValue()!=0)throw new IllegalArgumentException("Hypit media extraction failed");
        JsonNode manifest=JSON.readTree(Files.readString(directory.resolve("hypit-evidence.json")));
        if(!REVISION.equals(manifest.path("revision").asText())||!manifest.path("frames").isArray()||manifest.path("frames").isEmpty()||manifest.path("frames").size()>18000)throw new IllegalArgumentException("Invalid Hypit evidence");
        Path root=directory.toRealPath();double previous=-1;
        for(var frame:manifest.path("frames")) {
            double time=frame.path("at").asDouble(-1);Path path=Path.of(frame.path("path").asText()).toRealPath();
            if(!Double.isFinite(time)||time<previous||time<0||time>duration+.1||!path.startsWith(root)||!Files.isRegularFile(path))throw new IllegalArgumentException("Invalid native frame");previous=time;
        }
        return manifest;
    }
    private ProcessBuilder builder(String... arguments) {
        var command=new java.util.ArrayList<String>();command.add(node);command.addAll(java.util.List.of(arguments));var process=new ProcessBuilder(command).redirectError(ProcessBuilder.Redirect.DISCARD);
        String path=System.getenv("PATH"),temp=System.getenv("TMPDIR");process.environment().clear();if(path!=null)process.environment().put("PATH",path);if(temp!=null)process.environment().put("TMPDIR",temp);
        return configureMediaRuntime(process);
    }
    static ProcessBuilder configureMediaRuntime(ProcessBuilder process) {
        String directory=System.getenv("AEP_STUDIO_RECREATION_MEDIA_BIN");
        if(directory!=null&&!directory.isBlank()) {
            process.environment().put("PATH",directory+java.io.File.pathSeparator+process.environment().getOrDefault("PATH","/usr/local/bin:/usr/bin:/bin"));
            // Java executable lookup can use the parent PATH; select our media binary explicitly.
            var command=new java.util.ArrayList<>(process.command());
            if(!command.isEmpty()&&java.util.Set.of("ffmpeg","ffprobe").contains(command.get(0))) {
                command.set(0,Path.of(directory,command.get(0)).toString());process.command(command);
            }
        }
        return process;
    }
}
