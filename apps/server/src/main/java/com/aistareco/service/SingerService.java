package com.aistareco.service;

import com.aistareco.common.BusinessException;
import com.aistareco.dto.*;
import com.aistareco.model.*;
import com.aistareco.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SingerService {

    private final SingerRepository         singerRepo;
    private final OfficialIpRepository     officialIpRepo;
    private final PersonaPresetRepository  personaPresetRepo;
    private final WardrobeItemRepository   wardrobeItemRepo;
    private final PoseRepository           poseRepo;
    private final ExpressionRepository     expressionRepo;
    private final GestureRepository        gestureRepo;

    public SingerWorkspacePayload getWorkspace(String lang) {
        return new SingerWorkspacePayload(
                singerRepo.findAll().stream().map(s -> toDetail(s, lang)).toList(),
                officialIpRepo.findAll().stream().map(ip -> toIpTemplate(ip, lang)).toList(),
                personaPresetRepo.findAll().stream().map(p -> toPreset(p, lang)).toList(),
                wardrobeItemRepo.findAll().stream().map(w -> toWardrobe(w, lang)).toList(),
                poseRepo.findAll().stream().map(p -> toPose(p, lang)).toList(),
                expressionRepo.findAll().stream().map(e -> toExpression(e, lang)).toList(),
                gestureRepo.findAll().stream().map(g -> toGesture(g, lang)).toList()
        );
    }

    public SingerDetailDto create(String lang) {
        Singer singer = Singer.builder()
                .id("singer-" + UUID.randomUUID().toString().substring(0, 8))
                .nameZh("新歌手").nameEn("New Singer")
                .styleZh("未定义").styleEn("Undefined")
                .status("draft").quality("common")
                .avatarUrl("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400")
                .createdAt(LocalDate.now().toString())
                .songsCount(0).fansCount(0).popularity(0)
                .tags(List.of("new"))
                .sweetness(70).energy(80).mystery(50)
                .build();
        return toDetail(singerRepo.save(singer), lang);
    }

    public SingerDetailDto update(String id, SingerDetailDto dto, String lang) {
        Singer singer = singerRepo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SINGER_NOT_FOUND", "Singer not found"));
        singer.setNameZh(dto.name());
        singer.setNameEn(dto.name());
        singer.setStyleZh(dto.style());
        singer.setStyleEn(dto.style());
        singer.setStatus(dto.status());
        singer.setQuality(dto.quality());
        singer.setAvatarUrl(dto.avatarUrl());
        singer.setSongsCount(dto.songsCount());
        singer.setFansCount(dto.fansCount());
        singer.setPopularity(dto.popularity());
        singer.setTags(dto.tags());
        if (dto.parameters() != null) {
            singer.setSweetness(dto.parameters().sweetness());
            singer.setEnergy(dto.parameters().energy());
            singer.setMystery(dto.parameters().mystery());
        }
        return toDetail(singerRepo.save(singer), lang);
    }

    public void delete(String id) {
        if (!singerRepo.existsById(id)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "SINGER_NOT_FOUND", "Singer not found");
        }
        singerRepo.deleteById(id);
    }

    // ── Mappers ──────────────────────────────────────────────────────────────

    private SingerDetailDto toDetail(Singer s, String lang) {
        return new SingerDetailDto(
                s.getId(),
                "zh".equals(lang) ? s.getNameZh() : s.getNameEn(),
                "zh".equals(lang) ? s.getStyleZh() : s.getStyleEn(),
                s.getStatus(), s.getAvatarUrl(), s.getQuality(), s.getCreatedAt(),
                s.getSongsCount(), s.getFansCount(), s.getPopularity(),
                s.getTags(),
                new PersonaParamsDto(s.getSweetness(), s.getEnergy(), s.getMystery())
        );
    }

    private OfficialIpTemplateDto toIpTemplate(OfficialIp ip, String lang) {
        return new OfficialIpTemplateDto(
                ip.getId(),
                "zh".equals(lang) ? ip.getNameZh() : ip.getNameEn(),
                ip.getAvatarUrl(),
                "zh".equals(lang) ? ip.getStyleZh() : ip.getStyleEn(),
                ip.getRarity(), ip.getTags(),
                new PersonaParamsDto(ip.getSweetness(), ip.getEnergy(), ip.getMystery())
        );
    }

    private PersonaPresetDto toPreset(PersonaPreset p, String lang) {
        return new PersonaPresetDto(
                p.getId(),
                "zh".equals(lang) ? p.getNameZh() : p.getNameEn(),
                p.getIcon(),
                new PersonaParamsDto(p.getSweetness(), p.getEnergy(), p.getMystery())
        );
    }

    private WardrobeItemDto toWardrobe(WardrobeItem w, String lang) {
        return new WardrobeItemDto(
                w.getId(),
                "zh".equals(lang) ? w.getNameZh() : w.getNameEn(),
                w.getCategory(), w.getImageUrl(), w.getRarity(), w.getPrice(), w.getTags(),
                w.isLocked()   ? true : null,
                w.isNewItem()  ? true : null,
                w.isTrending() ? true : null
        );
    }

    private PosePresetDto toPose(Pose p, String lang) {
        return new PosePresetDto(
                p.getId(),
                "zh".equals(lang) ? p.getNameZh() : p.getNameEn(),
                p.getCategory(), p.getThumbnail(), p.getDifficulty(),
                p.isLocked()  ? true : null,
                p.isNewItem() ? true : null
        );
    }

    private ExpressionPresetDto toExpression(Expression e, String lang) {
        return new ExpressionPresetDto(
                e.getId(),
                "zh".equals(lang) ? e.getNameZh() : e.getNameEn(),
                e.getEmoji(), e.getIntensity(), e.getCategory()
        );
    }

    private GesturePresetDto toGesture(Gesture g, String lang) {
        return new GesturePresetDto(
                g.getId(),
                "zh".equals(lang) ? g.getNameZh() : g.getNameEn(),
                g.getIcon(), g.getCategory()
        );
    }
}
