package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;

/** Immutable owned-key snapshots; image bytes exist only during the provider call. No signed URLs in runs. */
public final class StudioVisualContext {
    private static final ObjectMapper OM=new ObjectMapper();
    public static final int MAX_FRAMES=16;
    private final FileStorageService storage;
    public StudioVisualContext(FileStorageService storage){this.storage=storage;}

    // A matching admin-declared model entry is required. A model name or URL is not capability evidence.
    public static boolean supportsVision(AiModelEndpoint endpoint) {
        if(endpoint==null || endpoint.getModelsJson()==null)return false;
        try {for(JsonNode model:OM.readTree(endpoint.getModelsJson()))
            if(Objects.equals(endpoint.getModel(),model.path("id").asText()) && model.path("supportsVision").asBoolean(false))return true;
        }catch(Exception ignored){}
        return false;
    }

    public static ArrayNode snapshot(JsonNode doc,List<String> nodeIds,IpProjectService projects,String owner) {
        ArrayNode result=OM.createArrayNode();int frames=0;
        for(String id:new LinkedHashSet<>(nodeIds==null?List.<String>of():nodeIds)) {
            JsonNode node=IpDocs.node(doc,id);if(node==null)throw bad("STUDIO_CONTEXT_NOT_FOUND","引用的画布内容不存在，请重新选择");
            String type=node.path("type").asText();if(!Set.of("image","video").contains(type))continue;
            String key=IpDocs.primaryStorageKey(node);
            if(key==null)throw bad("STUDIO_VISUAL_MISSING","「"+node.path("title").asText()+"」还没有可读画面，请先完成素材或关闭读取画面");
            projects.requireOwnedAssetKey(owner,key);
            frames+="video".equals(type)?4:1;
            if(frames>MAX_FRAMES)throw bad("STUDIO_VISUAL_LIMIT","本次最多读取 16 张画面；每段视频占 4 张，请减少引用");
            result.addObject().put("nodeId",id).put("title",node.path("title").asText()).put("type",type).put("storageKey",key);
        }
        return result;
    }

    public List<Map<String,Object>> parts(String prompt,JsonNode snapshots) {
        List<Map<String,Object>> result=new ArrayList<>();result.add(text(prompt));
        for(JsonNode item:snapshots) {
            Path file;
            try {file=storage.openForRead(item.path("storageKey").asText());}
            catch(Exception e){throw bad("STUDIO_VISUAL_UNREADABLE","引用的素材无法读取，请重新选择");}
            String label="画布对象 ID="+item.path("nodeId").asText()+"，名称="+item.path("title").asText();
            try {
                if("video".equals(item.path("type").asText())) {
                    if(Files.size(file)>128L*1024*1024)throw bad("STUDIO_VISUAL_LIMIT","视频最多 128 MB，请先剪短");
                    JsonNode probe=StudioLipSyncMedia.probe(file);
                    double duration=probe.path("format").path("duration").asDouble();
                    if(!Double.isFinite(duration)||duration<=0||duration>60)throw bad("STUDIO_VISUAL_LIMIT","读取画面的视频需在 60 秒内，请先剪短");
                    if(!java.util.stream.StreamSupport.stream(probe.path("streams").spliterator(),false).anyMatch(s->"video".equals(s.path("codec_type").asText())))throw bad("STUDIO_VISUAL_UNREADABLE","所选视频没有可读画面");
                    result.add(text(label+"。以下为按时间顺序采样的 4 帧，不包含音轨或全部连续动作。"));
                    for(int i=0;i<4;i++) {
                        double at=duration*(i+0.5)/4;
                        result.add(text(String.format(Locale.ROOT,"视频采样 %d/4，时间 %.2f 秒",i+1,at)));
                        result.add(image(frame(file,at)));
                    }
                } else {
                    if(Files.size(file)>8L*1024*1024)throw bad("STUDIO_VISUAL_LIMIT","单张图片最多 8 MB，请压缩后重新上传");
                    result.add(text(label+"。以下为该对象实际选中的图片。"));result.add(image(Files.readAllBytes(file)));
                }
            }catch(BusinessException e){throw e;}
            catch(Exception e){throw bad("STUDIO_VISUAL_UNREADABLE","「"+item.path("title").asText()+"」无法解码，请重新选择可播放的素材");}
        }
        return result;
    }
    private static byte[] frame(Path video,double at) throws Exception {
        Path output=Files.createTempFile("studio-visual-",".jpg");
        try {
            Process process=new ProcessBuilder("ffmpeg","-nostdin","-v","error","-ss",Double.toString(at),"-i",video.toString(),"-frames:v","1","-vf","scale=768:768:force_original_aspect_ratio=decrease","-y",output.toString()).redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD).start();
            if(!process.waitFor(20,TimeUnit.SECONDS)){process.destroyForcibly();throw new IllegalStateException("Frame timeout");}
            if(process.exitValue()!=0||Files.size(output)==0)throw new IllegalArgumentException("Frame missing");
            return Files.readAllBytes(output);
        }finally{Files.deleteIfExists(output);}
    }
    private static Map<String,Object> text(String text){return Map.of("type","text","text",text==null?"":text);}
    private static Map<String,Object> image(byte[] bytes) throws Exception {
        // Probe dimensions before decoding, bounding allocation even for small compressed files.
        BufferedImage source;
        try(var input=ImageIO.createImageInputStream(new java.io.ByteArrayInputStream(bytes))){
            var readers=ImageIO.getImageReaders(input);if(!readers.hasNext())throw new IllegalArgumentException("Unknown image");
            var reader=readers.next();try{reader.setInput(input);long pixels=(long)reader.getWidth(0)*reader.getHeight(0);if(pixels<=0||pixels>24_000_000)throw bad("STUDIO_VISUAL_LIMIT","图片最多 2400 万像素，请缩小后重试");source=reader.read(0);}finally{reader.dispose();}
        }
        double ratio=Math.min(1,768.0/Math.max(source.getWidth(),source.getHeight()));
        BufferedImage out=new BufferedImage(Math.max(1,(int)(source.getWidth()*ratio)),Math.max(1,(int)(source.getHeight()*ratio)),BufferedImage.TYPE_INT_RGB);
        var graphics=out.createGraphics();try{graphics.setColor(Color.WHITE);graphics.fillRect(0,0,out.getWidth(),out.getHeight());graphics.drawImage(source,0,0,out.getWidth(),out.getHeight(),null);}finally{graphics.dispose();}
        ByteArrayOutputStream encoded=new ByteArrayOutputStream();ImageIO.write(out,"jpg",encoded);
        return Map.of("type","image_url","image_url",Map.of("url","data:image/jpeg;base64,"+Base64.getEncoder().encodeToString(encoded.toByteArray())));
    }
    private static BusinessException bad(String code,String message){return BusinessException.badRequest(code,message);}
}
