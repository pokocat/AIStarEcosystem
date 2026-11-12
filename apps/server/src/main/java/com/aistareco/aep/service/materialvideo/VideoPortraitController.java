package com.aistareco.aep.service.materialvideo;

import com.aistareco.common.ApiResponse;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/ip-studio/asset-library")
public class VideoPortraitController {
    private final ArkPortraitLibrary portraits;
    @org.springframework.beans.factory.annotation.Autowired private VideoPortraitReviewService reviews;
    public VideoPortraitController(ArkPortraitLibrary portraits){this.portraits=portraits;}
    public record Check(String model,java.util.List<String> keys){}
    @PostMapping("/check") public ApiResponse<VideoPortraitReviewService.Preparation> check(Principal p,@RequestBody Check b){return ApiResponse.of(reviews.check(p.getName(),b.model(),b.keys()));}
    public record Register(String libraryId,String key,String mediaType,String label){}
    public record Declaration(String kind,String personId,boolean accepted,String agreementVersion){}
    public record BatchDeclaration(List<String> ids, String kind, String personId, boolean accepted, String agreementVersion) {}
    public record PersonRequest(String libraryId,String name,String clientRequestId,boolean accepted,String agreementVersion){}
    @GetMapping("/reviews/{id}") public ApiResponse<VideoPortraitReviewService.Review> review(Principal p,@PathVariable String id){return ApiResponse.of(reviews.get(p.getName(),id));}
    @PostMapping("/reviews/{id}/resume") public ApiResponse<VideoPortraitReviewService.Review> resume(Principal p,@PathVariable String id){return ApiResponse.of(reviews.resume(p.getName(),id));}
    @GetMapping public ResponseEntity<ApiResponse<ArkPortraitLibrary.Overview>> list(Principal p){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.of(portraits.overview(p.getName())));}
    @PostMapping("/items") public ApiResponse<ArkPortraitLibrary.Item> register(Principal p,@RequestBody Register b){return ApiResponse.of(portraits.register(p.getName(),b.libraryId(),b.key(),b.mediaType(),b.label()));}
    @PostMapping("/items/{id}/declaration") public ApiResponse<ArkPortraitLibrary.Item> declare(Principal p,@PathVariable String id,@RequestBody Declaration b){return ApiResponse.of(portraits.declare(p.getName(),id,b.kind(),b.personId(),b.accepted(),b.agreementVersion()));}
    @PostMapping("/items/declarations")
    public ApiResponse<List<ArkPortraitLibrary.Item>> declareBatch(Principal p, @RequestBody BatchDeclaration b) {
        return ApiResponse.of(portraits.declareBatch(p.getName(), b.ids(), b.kind(), b.personId(), b.accepted(), b.agreementVersion()));
    }
    @PostMapping("/items/{id}/refresh") public ApiResponse<ArkPortraitLibrary.Item> refresh(Principal p,@PathVariable String id){return ApiResponse.of(portraits.refreshItem(p.getName(),id));}
    @PostMapping("/persons") public ResponseEntity<ApiResponse<ArkPortraitLibrary.Person>> start(Principal p,@RequestBody PersonRequest b){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.of(portraits.startPerson(p.getName(),b.libraryId(),b.name(),b.clientRequestId(),b.accepted(),b.agreementVersion())));}
    @PostMapping("/persons/{id}/refresh") public ApiResponse<ArkPortraitLibrary.Person> person(Principal p,@PathVariable String id){return ApiResponse.of(portraits.refreshPerson(p.getName(),id));}
    @DeleteMapping("/persons/{id}") public ApiResponse<Void> revoke(Principal p,@PathVariable String id){portraits.revoke(p.getName(),id);return ApiResponse.of(null);}
}
