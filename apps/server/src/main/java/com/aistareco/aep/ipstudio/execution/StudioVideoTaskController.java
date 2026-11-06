package com.aistareco.aep.ipstudio.execution;

import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;

@RestController
@RequestMapping("/api/v1/ip-studio")
public class StudioVideoTaskController {
    private final StudioVideoTaskService service;
    public StudioVideoTaskController(StudioVideoTaskService service) {this.service=service;}
    @GetMapping("/studio/video-task-price")
    public ApiResponse<StudioVideoTaskService.Quote> price(Principal p,@RequestParam String kind,@RequestParam(required=false) String model,
            @RequestParam(required=false) String mode,@RequestParam(required=false) String tier,@RequestParam int duration,@RequestParam String ratio,
            @RequestParam(defaultValue="0") int images,@RequestParam(defaultValue="false") boolean character,
            @RequestParam(defaultValue="false") boolean voice,@RequestParam(defaultValue="true") boolean optimize) {
        return ApiResponse.of(service.price(p.getName(),kind,model,mode,tier,duration,ratio,images,character,voice,optimize));
    }
    @PostMapping("/projects/{id}/video-tasks")
    public ApiResponse<StudioVideoTaskService.Task> start(Principal p,@PathVariable String id,@RequestBody StudioVideoTaskService.Create request) {
        return ApiResponse.of(service.start(p.getName(),id,request));
    }
    @GetMapping("/video-tasks")
    public ApiResponse<StudioVideoTaskService.Tasks> list(Principal p,@RequestParam(defaultValue="0") int page) {return ApiResponse.of(service.list(p.getName(),page));}
    @GetMapping("/video-tasks/{id}")
    public ApiResponse<StudioVideoTaskService.Task> get(Principal p,@PathVariable String id) {return ApiResponse.of(service.get(p.getName(),id));}
}
