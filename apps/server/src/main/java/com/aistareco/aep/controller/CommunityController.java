package com.aistareco.aep.controller;

import com.aistareco.aep.dto.CommunityEventDto;
import com.aistareco.aep.dto.CommunityPostDto;
import com.aistareco.aep.dto.EventRsvpDto;
import com.aistareco.aep.dto.FanActivityDto;
import com.aistareco.aep.dto.FanGrowthPointDto;
import com.aistareco.aep.dto.FanTierDto;
import com.aistareco.aep.model.CommunityPost;
import com.aistareco.aep.model.EventRsvp;
import com.aistareco.aep.repository.CommunityEventRepository;
import com.aistareco.aep.repository.CommunityPostRepository;
import com.aistareco.aep.repository.EventRsvpRepository;
import com.aistareco.aep.repository.FanActivityRepository;
import com.aistareco.aep.repository.FanGrowthPointRepository;
import com.aistareco.aep.repository.FanTierRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 用户侧社区 / 粉丝运营只读视图：/api/community/*。
 * 管理写入仍走 {@link AdminCommunityController}。
 */
@RestController
@RequestMapping("/api/community")
public class CommunityController {

    private final FanTierRepository fanTierRepo;
    private final FanGrowthPointRepository fanGrowthRepo;
    private final FanActivityRepository fanActivityRepo;
    private final CommunityEventRepository communityEventRepo;
    private final CommunityPostRepository postRepo;
    private final EventRsvpRepository rsvpRepo;

    public CommunityController(FanTierRepository fanTierRepo,
                               FanGrowthPointRepository fanGrowthRepo,
                               FanActivityRepository fanActivityRepo,
                               CommunityEventRepository communityEventRepo,
                               CommunityPostRepository postRepo,
                               EventRsvpRepository rsvpRepo) {
        this.fanTierRepo = fanTierRepo;
        this.fanGrowthRepo = fanGrowthRepo;
        this.fanActivityRepo = fanActivityRepo;
        this.communityEventRepo = communityEventRepo;
        this.postRepo = postRepo;
        this.rsvpRepo = rsvpRepo;
    }

    @GetMapping("/fan-tiers")
    public ApiResponse<List<FanTierDto>> fanTiers() {
        return ApiResponse.of(fanTierRepo.findAll(Sort.by("id").ascending())
                .stream().map(FanTierDto::from).toList());
    }

    @GetMapping("/fan-growth")
    public ApiResponse<List<FanGrowthPointDto>> fanGrowth() {
        return ApiResponse.of(fanGrowthRepo.findAll(Sort.by("id").ascending())
                .stream().map(FanGrowthPointDto::from).toList());
    }

    @GetMapping("/activities")
    public ApiResponse<List<FanActivityDto>> activities() {
        return ApiResponse.of(fanActivityRepo.findAll(Sort.by("id").ascending())
                .stream().map(FanActivityDto::from).toList());
    }

    @GetMapping("/events")
    public ApiResponse<List<CommunityEventDto>> events() {
        return ApiResponse.of(communityEventRepo.findAll(Sort.by("id").ascending())
                .stream().map(CommunityEventDto::from).toList());
    }

    // ── Posts ───────────────────────────────────────────────────────────────

    @GetMapping("/posts")
    public ApiResponse<List<CommunityPostDto>> listPosts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<CommunityPostDto> items = postRepo.findAllByOrderByCreatedAtDesc(
                        PageRequest.of(page, size))
                .stream().map(CommunityPostDto::from).toList();
        return ApiResponse.of(items);
    }

    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    @SuppressWarnings("unchecked")
    public ApiResponse<CommunityPostDto> createPost(Principal principal,
                                                     @RequestBody Map<String, Object> body) {
        String content = body.get("content") != null ? body.get("content").toString() : "";
        Object rawMedia = body.get("mediaUrls");
        List<String> media = rawMedia instanceof List<?> l
                ? l.stream().map(Object::toString).toList() : List.of();
        CommunityPost post = CommunityPost.builder()
                .id(UUID.randomUUID().toString())
                .userId(principal.getName())
                .artistId(body.get("artistId") == null ? null : body.get("artistId").toString())
                .content(content)
                .mediaUrls(media)
                .createdAt(Instant.now())
                .build();
        postRepo.save(post);
        return ApiResponse.of(CommunityPostDto.from(post));
    }

    // ── Event RSVP ──────────────────────────────────────────────────────────

    @PostMapping("/events/{eventId}/rsvp")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<EventRsvpDto> rsvp(Principal principal, @PathVariable String eventId) {
        EventRsvp rsvp = rsvpRepo.findByEventIdAndUserId(eventId, principal.getName())
                .orElseGet(() -> EventRsvp.builder()
                        .eventId(eventId)
                        .userId(principal.getName())
                        .createdAt(Instant.now())
                        .build());
        if (rsvp.getCreatedAt() == null) rsvp.setCreatedAt(Instant.now());
        rsvpRepo.save(rsvp);
        return ApiResponse.of(EventRsvpDto.from(rsvp));
    }

    @DeleteMapping("/events/{eventId}/rsvp")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelRsvp(Principal principal, @PathVariable String eventId) {
        rsvpRepo.findByEventIdAndUserId(eventId, principal.getName())
                .ifPresent(rsvpRepo::delete);
    }

    @GetMapping("/events/{eventId}/rsvps")
    public ApiResponse<Map<String, Object>> eventRsvps(@PathVariable String eventId) {
        return ApiResponse.of(Map.of("eventId", eventId, "count", rsvpRepo.countByEventId(eventId)));
    }
}
