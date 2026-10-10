package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.service.picgen.FontRegistry;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.List;
import java.util.*;
import java.util.zip.*;
import javax.imageio.ImageIO;

/** Deterministic Chinese asset board and original-file bundle. No provider call, no credits. */
@Service
public class StudioTemplatePackageService {
    private final IpProjectService projects;private final StudioTemplateExecutionService execution;
    private final FileStorageService storage;private final FontRegistry fonts;private final ObjectMapper mapper;
    public StudioTemplatePackageService(IpProjectService projects,StudioTemplateExecutionService execution,FileStorageService storage,FontRegistry fonts,ObjectMapper mapper){this.projects=projects;this.execution=execution;this.storage=storage;this.fonts=fonts;this.mapper=mapper;}

    @Transactional(readOnly=true)
    public List<AssetPackage> list(String owner,String projectId) {
        var p=projects.required(owner,projectId);var snap=projects.parseOrEmptyObject(p.getTemplateInstanceJson());List<AssetPackage> result=new ArrayList<>();
        for(var item:snap.path("packages"))result.add(signed(item));return result;
    }
    @Transactional
    public AssetPackage create(String owner,String projectId,PackageRequest req) {
        IpProject p=projects.requiredForUpdate(owner,projectId);
        if(req==null || req.title()==null || req.title().isBlank() || req.title().length()>80 || req.description()!=null&&req.description().length()>300 || req.stepIds()==null || req.stepIds().isEmpty() || req.stepIds().size()>20 || new HashSet<>(req.stepIds()).size()!=req.stepIds().size())throw bad("请填写标题并选择 1 到 20 个不同输出");
        var state=execution.read(owner,projectId);List<ExecutionStep> selected=new ArrayList<>();int imageCount=(int)state.steps().stream().filter(s->!"video".equals(s.operation())).count();
        for(String id:req.stepIds()) {
            var step=state.steps().stream().filter(s->s.id().equals(id)).findFirst().orElseThrow(()->bad("所选步骤不存在"));
            if("video".equals(step.operation()))throw bad("资产展示板仅包含图片，请在画布中下载或整理视频成片");
            if(!"done".equals(step.status()) || !step.accepted() || step.storageKey()==null)throw bad("请先检查并采用每个输出，过期或失败图片不能进入新资产包");selected.add(step);
        }
        ObjectNode manifest=mapper.createObjectNode();manifest.put("projectId",projectId).put("versionId",state.versionId()).put("version",state.version()).put("title",req.title().trim()).put("description",req.description()==null?"":req.description()).put("complete",selected.size()==imageCount);
        var items=manifest.putArray("images");
        for(var step:selected){var item=items.addObject().put("stepId",step.id()).put("title",step.title()).put("role",step.outputRole()).put("runId",step.run().id()).put("storageKey",step.storageKey());if(step.adoption()!=null)item.set("adoption",mapper.valueToTree(step.adoption()));}
        String fingerprint=sha(manifest.toString());var snapshot=(ObjectNode)projects.parseOrEmptyObject(p.getTemplateInstanceJson());
        var history=snapshot.withArray("packages");for(var previous:history)if(fingerprint.equals(previous.path("fingerprint").asText()))return signed(previous);
        try {
            List<byte[]> originals=new ArrayList<>();List<BufferedImage> images=new ArrayList<>();long bytes=0;
            for(var step:selected) {
                String key=projects.requireOwnedAssetKey(owner,step.storageKey());var file=storage.openForRead(key);long length=java.nio.file.Files.size(file);bytes+=length;
                if(length>20*1024*1024 || bytes>128*1024*1024)throw bad("素材过大，请减少输出后分包");
                byte[] data=java.nio.file.Files.readAllBytes(file);BufferedImage image=decode(data);originals.add(data);images.add(image);
            }
            BufferedImage board=render(req.title().trim(),req.description(),selected,images,imageCount,fonts);
            ByteArrayOutputStream png=new ByteArrayOutputStream();ImageIO.write(board,"png",png);
            var boardFile=storage.store(png.toByteArray(),IpProjectService.CATEGORY_GEN,owner,"png","image/png");
            ByteArrayOutputStream bundle=new ByteArrayOutputStream();
            try(var zip=new ZipOutputStream(bundle,StandardCharsets.UTF_8)) {
                put(zip,"asset-board.png",png.toByteArray());put(zip,"manifest.json",mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(manifest));
                for(int i=0;i<selected.size();i++) {String key=selected.get(i).storageKey();String ext=key.substring(key.lastIndexOf('.')+1).toLowerCase(Locale.ROOT);if(!Set.of("jpg","jpeg","png","webp").contains(ext))ext="img";put(zip,String.format(Locale.ROOT,"images/%02d-%s.%s",i+1,selected.get(i).id(),ext),originals.get(i));}
            }
            var bundleFile=storage.store(bundle.toByteArray(),IpProjectService.CATEGORY_GEN,owner,"zip","application/zip");
            var item=history.addObject().put("id","PKG-"+UUID.randomUUID().toString().replace("-","").substring(0,20)).put("title",req.title().trim()).put("versionId",state.versionId()).put("boardKey",boardFile.key()).put("bundleKey",bundleFile.key()).put("width",board.getWidth()).put("height",board.getHeight()).put("imageCount",selected.size()).put("requiredCount",imageCount).put("complete",selected.size()==imageCount).put("createdAt",Instant.now().toString()).put("fingerprint",fingerprint);
            p.setTemplateInstanceJson(snapshot.toString());projects.save(p);return signed(item);
        }catch(BusinessException e){throw e;}catch(Exception e){throw bad("资产包排版失败，请重试；没有调用模型或扣费");}
    }
    private AssetPackage signed(JsonNode p){return new AssetPackage(p.path("id").asText(),p.path("title").asText(),p.path("versionId").asText(),p.path("boardKey").asText(),storage.signedUrl(p.path("boardKey").asText()),p.path("bundleKey").asText(),storage.signedUrl(p.path("bundleKey").asText()),p.path("width").asInt(),p.path("height").asInt(),p.path("imageCount").asInt(),p.path("requiredCount").asInt(),p.path("complete").asBoolean(),p.path("createdAt").asText());}
    static BufferedImage decode(byte[] data)throws IOException {
        try(var input=ImageIO.createImageInputStream(new ByteArrayInputStream(data))){var readers=ImageIO.getImageReaders(input);if(!readers.hasNext())throw bad("输出不是可读取的图片");var reader=readers.next();try{reader.setInput(input);int w=reader.getWidth(0),h=reader.getHeight(0);if(w<1||h<1||(long)w*h>32_000_000)throw bad("图片尺寸超过排版范围");return reader.read(0);}finally{reader.dispose();}}
    }
    static BufferedImage render(String title,String description,List<ExecutionStep> steps,List<BufferedImage> images,int required,FontRegistry fonts) {
        String all=title+(description==null?"":description)+"人物资产包完整已选部分输出"+steps.stream().map(ExecutionStep::title).reduce("",String::concat);
        Font font=fonts.byKind(FontRegistry.Kind.SANS).stream().map(FontRegistry.RegisteredFont::font).filter(f->f.canDisplayUpTo(all)<0).findFirst().orElse(new Font(Font.SANS_SERIF,Font.PLAIN,24));
        if(font.canDisplayUpTo(all)>=0)throw bad("中文字体未安装，不能生成可读展示板");
        int cols=steps.size()==1?1:3;int rows=(steps.size()+cols-1)/cols;int width=1600,height=310+rows*560;
        var board=new BufferedImage(width,height,BufferedImage.TYPE_INT_RGB);var g=board.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);g.setColor(new Color(247,247,244));g.fillRect(0,0,width,height);g.setColor(new Color(24,32,42));g.setFont(font.deriveFont(Font.BOLD,46));wrap(g,title,70,85,1460,58,2);
            g.setFont(font.deriveFont(Font.PLAIN,24));String info="人物资产包 · "+steps.size()+" / "+required+" 张 · "+(steps.size()==required?"完整输出":"部分输出");g.drawString(info,70,205);
            if(description!=null&&!description.isBlank()){g.setColor(new Color(80,87,95));g.setFont(font.deriveFont(22f));wrap(g,description,70,250,1460,30,2);}
            int cell=(width-140-(cols-1)*24)/cols;
            for(int i=0;i<steps.size();i++) {
                int x=70+(i%cols)*(cell+24),y=320+(i/cols)*560;g.setColor(Color.WHITE);g.fillRoundRect(x,y,cell,532,20,20);
                var image=images.get(i);double scale=Math.min((cell-32d)/image.getWidth(),450d/image.getHeight());int w=(int)(image.getWidth()*scale),h=(int)(image.getHeight()*scale);g.drawImage(image,x+(cell-w)/2,y+18+(450-h)/2,w,h,null);
                g.setColor(new Color(24,32,42));g.setFont(font.deriveFont(Font.BOLD,24));wrap(g,steps.get(i).title(),x+20,y+495,cell-40,28,1);
            }
        }finally{g.dispose();}return board;
    }
    private static void wrap(Graphics2D g,String text,int x,int y,int width,int leading,int maxLines){StringBuilder line=new StringBuilder();int no=0;for(int offset=0;offset<text.length();) {int cp=text.codePointAt(offset);offset+=Character.charCount(cp);String c=new String(Character.toChars(cp));if(g.getFontMetrics().stringWidth(line+c)>width){g.drawString(line.toString(),x,y+no*leading);line.setLength(0);if(++no==maxLines)return;}line.append(c);}if(no<maxLines)g.drawString(line.toString(),x,y+no*leading);}
    private static void put(ZipOutputStream zip,String name,byte[] data)throws IOException{zip.putNextEntry(new ZipEntry(name));zip.write(data);zip.closeEntry();}
    private static String sha(String data){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private static BusinessException bad(String message){return BusinessException.badRequest("STUDIO_TEMPLATE_PACKAGE_INVALID",message);}
}
