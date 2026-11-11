package com.aistareco.aep.controller;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.repository.MixcutAssetRepository;
import com.aistareco.aep.service.mixcut.MixcutAssetService;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.nio.file.*;
import java.util.*;

/** Preserve the existing public, unlisted static-file URL when a node's local copy is absent. */
@RestController
public class MixcutAssetFileController {
    private final MixcutProperties props;
    private final MixcutAssetRepository repo;
    private final MixcutAssetService assets;
    public MixcutAssetFileController(MixcutProperties props,MixcutAssetRepository repo,MixcutAssetService assets){this.props=props;this.repo=repo;this.assets=assets;}
    @GetMapping("${aep.mixcut.asset-public-url-base:/static/mixcut-assets}/{*path}")
    public ResponseEntity<Resource> file(@PathVariable("path")String path)throws IOException {
        String relative=path.startsWith("/")?path.substring(1):path;
        if(relative.isBlank() || relative.contains("\\") || relative.contains("%") || Arrays.asList(relative.split("/")).contains(".."))return ResponseEntity.notFound().build();
        Path root=Path.of(props.getAssetDir()).toAbsolutePath().normalize(),local=root.resolve(relative).normalize();
        if(!local.startsWith(root))return ResponseEntity.notFound().build();
        if(Files.isRegularFile(local)) {
            if(!local.toRealPath().startsWith(root.toRealPath()))return ResponseEntity.notFound().build();
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new FileSystemResource(local));
        }
        var asset=repo.findFirstByFileUrl(props.getAssetPublicUrlBase()+"/"+relative).orElse(null);
        if(asset==null || asset.getCdnKey()==null || asset.getCdnKey().isBlank())return ResponseEntity.notFound().build();
        // Do not read the DB's arbitrary localPath here: static URLs remain confined to assetDir.
        java.io.File cached=assets.sharedFileForKnownAsset(asset);
        if(cached==null)return ResponseEntity.notFound().build();
        MediaType type=MediaType.APPLICATION_OCTET_STREAM;
        if(asset.getMimeType()!=null)try{type=MediaType.parseMediaType(asset.getMimeType());}catch(InvalidMediaTypeException ignored){}
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(type).body(new FileSystemResource(cached));
    }
}
