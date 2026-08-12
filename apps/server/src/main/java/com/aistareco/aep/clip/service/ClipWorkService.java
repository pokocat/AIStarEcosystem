package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.dto.ClipDtos.*;
import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
public class ClipWorkService {
    private static final Set<String> PLATFORMS=Set.of("douyin","kuaishou","xiaohongshu","shipinhao");
    private final ClipProjectRepository projects;private final ClipRenderJobRepository jobs;private final FileStorageService storage;private final ShiliuService shiliu;private final ClipAssetThumbnailExtractor thumbnails;
    public ClipWorkService(ClipProjectRepository projects,ClipRenderJobRepository jobs,FileStorageService storage,ShiliuService shiliu,ClipAssetThumbnailExtractor thumbnails){this.projects=projects;this.jobs=jobs;this.storage=storage;this.shiliu=shiliu;this.thumbnails=thumbnails;}
    public List<WorkDto> list(String owner){return projects.findByExternalOwnerIdAndDeletedAtIsNullOrderByUpdatedAtDesc(owner).stream().filter(p->Set.of("generating","done").contains(p.getStatus())).map(this::dto).toList();}
    public WorkDto get(String owner,String id){ClipProject p=projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull(id,owner).orElseThrow(()->BusinessException.notFound("CLIP_WORK_NOT_FOUND","作品不存在或无权访问"));if(!Set.of("generating","done").contains(p.getStatus()))throw BusinessException.notFound("CLIP_WORK_NOT_FOUND","作品不存在");return dto(p);}
    @Transactional public Map<String,Object> publish(String owner,String id,String platform){if(!PLATFORMS.contains(platform))throw BusinessException.badRequest("CLIP_PUBLISH_PLATFORM_UNSUPPORTED","暂不支持该发布平台");ClipProject p=projects.findByIdAndExternalOwnerIdAndDeletedAtIsNull(id,owner).orElseThrow(()->BusinessException.notFound("CLIP_WORK_NOT_FOUND","作品不存在或无权访问"));if(!"done".equals(p.getStatus()))throw new com.aistareco.common.BusinessException(org.springframework.http.HttpStatus.CONFLICT,"CLIP_WORK_NOT_READY","成片尚未完成");if(!shiliu.mockMode())throw new com.aistareco.common.BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"CLIP_PUBLISH_NOT_CONFIGURED","平台发布能力仍在接入验收中");Map<String,Object> payload=new LinkedHashMap<>(p.getPayloadJson());List<Map<String,String>> stats=publishStats(payload);stats.add(Map.of("platform",platformLabel(platform),"text","Mock 已提交"));payload.put("publishStats",stats);p.setPayloadJson(payload);p.setUpdatedAt(Instant.now());projects.save(p);return Map.of("ok",true,"status","submitted","platform",platform,"mock",true);}
    private WorkDto dto(ClipProject p){ClipRenderJob j=jobs.findFirstByProjectIdAndExternalOwnerIdOrderByCreatedAtDesc(p.getId(),p.getExternalOwnerId()).orElse(null);if(j!=null&&j.getThumbnailCdnKey()==null&&j.getOutputCdnKey()!=null){try{var thumb=thumbnails.extract(p.getExternalOwnerId(),j.getOutputCdnKey());j.setThumbnailCdnKey(thumb.key());jobs.save(j);}catch(Exception ignored){}}List<Map<String,String>> stats=publishStats(p.getPayloadJson());String status=!stats.isEmpty()?"published":"generating".equals(p.getStatus())?"generating":"done";return new WorkDto(p.getId(),p.getId(),p.getTitle(),status,p.getDurationSec(),p.getAvatarSeconds(),p.getCreditsHeld(),j==null?null:storage.signedUrl(j.getOutputCdnKey()),j==null?null:storage.signedUrl(j.getThumbnailCdnKey()),stats,aiWatermark(p.getPayloadJson()));}
    private static boolean aiWatermark(Map<String,Object> payload){Map<String,Object> style=ClipDtos.safeMapValue(payload.get("subtitleStyle"));return style!=null&&Boolean.TRUE.equals(style.get("aiWatermark"));}
    @SuppressWarnings("unchecked") private static List<Map<String,String>> publishStats(Map<String,Object> payload){Object value=payload.get("publishStats");List<Map<String,String>> result=new ArrayList<>();if(value instanceof List<?> list)for(Object item:list)if(item instanceof Map<?,?> map){Map<String,String> row=new LinkedHashMap<>();map.forEach((k,v)->row.put(String.valueOf(k),String.valueOf(v)));result.add(row);}return result;}
    private static String platformLabel(String p){return switch(p){case"douyin"->"抖音";case"kuaishou"->"快手";case"xiaohongshu"->"小红书";default->"视频号";};}
}
