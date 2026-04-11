package com.aistareco.service;

import com.aistareco.dto.*;
import com.aistareco.model.Track;
import com.aistareco.repository.TrackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TrackService {

    private final TrackRepository trackRepo;

    public TrackWorkspacePayload getWorkspace(String lang) {
        List<TrackSummaryDto> tracks = trackRepo.findAll().stream()
                .map(t -> toSummary(t, lang))
                .toList();
        return new TrackWorkspacePayload(
                tracks, chartEntries(), lyrics(), discoverySpotlight(lang), recommendations(lang),
                List.of("Analyzing", "Composing", "Arranging", "Mastering", "Finalizing")
        );
    }

    public TrackSummaryDto generate(String lang, Map<String, Object> request) {
        String style  = (String) request.getOrDefault("style", "Electronic");
        Object durObj = request.get("durationSec");
        int    dur    = durObj instanceof Number n ? n.intValue() : 180;

        Track track = Track.builder()
                .id("track-" + UUID.randomUUID().toString().substring(0, 8))
                .titleZh("新曲目 - " + style)
                .titleEn("New Track - " + style)
                .style(style)
                .durationSec(dur)
                .durationLabel(formatDuration(dur))
                .status("Published")
                .date(LocalDate.now().toString())
                .plays(0L)
                .singerId((String) request.get("singerId"))
                .build();
        return toSummary(trackRepo.save(track), lang);
    }

    private TrackSummaryDto toSummary(Track t, String lang) {
        String title = "zh".equals(lang) ? t.getTitleZh() : t.getTitleEn();
        return new TrackSummaryDto(
                t.getId(), title, t.getStyle(),
                t.getDurationSec(), t.getDurationLabel(),
                t.getStatus(), t.getDate(), t.getPlays()
        );
    }

    private String formatDuration(int sec) {
        return String.format("%d:%02d", sec / 60, sec % 60);
    }

    private List<ChartEntryDto> chartEntries() {
        return List.of(
                new ChartEntryDto("chart-1", "Neon Rain",       "Neon V",        12450, "up",   "https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=400&q=80"),
                new ChartEntryDto("chart-2", "Cyber Heartbeat", "Project: Zero", 10890, "up",   "https://images.unsplash.com/photo-1514525253440-b393452e2347?w=400&q=80"),
                new ChartEntryDto("chart-3", "Digital Tears",   "Luna Soft",     9800,  "down", "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80"),
                new ChartEntryDto("chart-4", "Void Echo",       "Echo Bot",      8500,  "same", "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&q=80"),
                new ChartEntryDto("chart-5", "System Error",    "Glitch Gang",   7200,  "up",   "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&q=80")
        );
    }

    private List<Map<String, Object>> lyrics() {
        return List.of(
                Map.of("time", 0,  "text", "Neon rain falling down..."),
                Map.of("time", 4,  "text", "Washing away the dust of this town."),
                Map.of("time", 8,  "text", "I see your ghost in the hologram,"),
                Map.of("time", 12, "text", "Running through the wires, who I am?"),
                Map.of("time", 16, "text", "(Instrumental Break)"),
                Map.of("time", 24, "text", "Cyber heart, beating slow,"),
                Map.of("time", 28, "text", "Where the data streams, there I go.")
        );
    }

    private Map<String, Object> discoverySpotlight(String lang) {
        return Map.of(
                "badge",    "zh".equals(lang) ? "本周最热" : "Hot This Week",
                "title",    "Neon Rain",
                "artist",   "Neon V",
                "coverUrl", "https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=400&q=80",
                "subtitle", "zh".equals(lang) ? "赛博朋克风格新作" : "Cyberpunk style release"
        );
    }

    private List<Map<String, Object>> recommendations(String lang) {
        return List.of(
                Map.of("id", "rec-1", "title", "Midnight Pulse", "artist", "Neon V",       "coverUrl", "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=200"),
                Map.of("id", "rec-2", "title", "Digital Soul",   "artist", "Luna Soft",    "coverUrl", "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200"),
                Map.of("id", "rec-3", "title", "Pixel Dreams",   "artist", "Project: Zero","coverUrl", "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=200")
        );
    }
}
