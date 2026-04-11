package com.aistareco.data;

import com.aistareco.model.*;
import com.aistareco.repository.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final SingerRepository              singerRepo;
    private final OfficialIpRepository          officialIpRepo;
    private final PersonaPresetRepository       personaPresetRepo;
    private final WardrobeItemRepository        wardrobeItemRepo;
    private final PoseRepository                poseRepo;
    private final ExpressionRepository          expressionRepo;
    private final GestureRepository             gestureRepo;
    private final TrackRepository               trackRepo;
    private final MarketplaceListingRepository  listingRepo;
    private final NftCollectionRepository       nftRepo;

    @Override
    public void run(String... args) {
        seedSingers();
        seedOfficialIps();
        seedPersonaPresets();
        seedWardrobeItems();
        seedPoses();
        seedExpressions();
        seedGestures();
        seedTracks();
        seedMarketplaceListings();
        seedNftCollections();
        log.info("Data seeding complete.");
    }

    // ── Seed methods ──────────────────────────────────────────────────────────

    private void seedSingers() {
        if (singerRepo.count() > 0) return;
        singerRepo.saveAll(List.of(
            Singer.builder().id("singer-1").nameZh("霓虹战士").nameEn("Neon Warrior")
                .styleZh("电子舞曲").styleEn("EDM").status("active").quality("legendary")
                .avatarUrl("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400")
                .createdAt("2026-03-15").songsCount(12).fansCount(58200).popularity(95)
                .tags(List.of("cyberpunk","edm","female")).sweetness(40).energy(95).mystery(80).build(),
            Singer.builder().id("singer-2").nameZh("云裳仙子").nameEn("Cloud Fairy")
                .styleZh("古风流行").styleEn("Ancient Pop").status("active").quality("epic")
                .avatarUrl("https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400")
                .createdAt("2026-03-20").songsCount(8).fansCount(32100).popularity(88)
                .tags(List.of("traditional","pop","elegant")).sweetness(90).energy(60).mystery(70).build(),
            Singer.builder().id("singer-3").nameZh("星际漂流").nameEn("Stellar Drift")
                .styleZh("太空摇滚").styleEn("Space Rock").status("draft").quality("rare")
                .avatarUrl("https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400")
                .createdAt("2026-03-28").songsCount(3).fansCount(8900).popularity(72)
                .tags(List.of("rock","space","experimental")).sweetness(55).energy(82).mystery(76).build(),
            Singer.builder().id("singer-4").nameZh("午夜DJ").nameEn("Midnight DJ")
                .styleZh("深宅电音").styleEn("Deep House").status("active").quality("epic")
                .avatarUrl("https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400")
                .createdAt("2026-03-10").songsCount(15).fansCount(42300).popularity(90)
                .tags(List.of("house","electronic","party")).sweetness(62).energy(91).mystery(58).build()
        ));
    }

    private void seedOfficialIps() {
        if (officialIpRepo.count() > 0) return;
        officialIpRepo.saveAll(List.of(
            OfficialIp.builder().id("ip-1").nameZh("霓虹战士").nameEn("Neon Warrior")
                .styleZh("电子舞曲").styleEn("EDM").rarity("legendary")
                .avatarUrl("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400")
                .tags(List.of("cyberpunk","edm")).sweetness(40).energy(95).mystery(80).build(),
            OfficialIp.builder().id("ip-2").nameZh("云裳仙子").nameEn("Cloud Fairy")
                .styleZh("古风流行").styleEn("Ancient Pop").rarity("epic")
                .avatarUrl("https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400")
                .tags(List.of("traditional","elegant")).sweetness(90).energy(60).mystery(70).build(),
            OfficialIp.builder().id("ip-3").nameZh("机械核心").nameEn("Mech Core")
                .styleZh("工业摇滚").styleEn("Industrial Rock").rarity("epic")
                .avatarUrl("https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400")
                .tags(List.of("rock","mechanical")).sweetness(30).energy(90).mystery(85).build(),
            OfficialIp.builder().id("ip-4").nameZh("星辰歌者").nameEn("Star Singer")
                .styleZh("梦幻流行").styleEn("Dream Pop").rarity("rare")
                .avatarUrl("https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400")
                .tags(List.of("dreamy","pop")).sweetness(85).energy(70).mystery(75).build()
        ));
    }

    private void seedPersonaPresets() {
        if (personaPresetRepo.count() > 0) return;
        personaPresetRepo.saveAll(List.of(
            PersonaPreset.builder().id("preset-1").nameZh("甜美少女").nameEn("Sweet Girl").icon("🌸").sweetness(95).energy(75).mystery(40).build(),
            PersonaPreset.builder().id("preset-2").nameZh("冷酷女王").nameEn("Cool Queen").icon("👑").sweetness(30).energy(85).mystery(90).build(),
            PersonaPreset.builder().id("preset-3").nameZh("活力青春").nameEn("Energetic Youth").icon("⚡").sweetness(70).energy(95).mystery(50).build(),
            PersonaPreset.builder().id("preset-4").nameZh("神秘精灵").nameEn("Mystic Elf").icon("🌙").sweetness(60).energy(55).mystery(95).build()
        ));
    }

    private void seedWardrobeItems() {
        if (wardrobeItemRepo.count() > 0) return;
        wardrobeItemRepo.saveAll(List.of(
            WardrobeItem.builder().id("t1").nameZh("赛博夹克").nameEn("Cyber Jacket").category("top")
                .imageUrl("https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300").rarity("epic").price(299)
                .tags(List.of("cyberpunk","jacket")).newItem(true).build(),
            WardrobeItem.builder().id("t2").nameZh("霓虹T恤").nameEn("Neon Tee").category("top")
                .imageUrl("https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=300").rarity("common").price(99)
                .tags(List.of("casual","neon")).trending(true).build(),
            WardrobeItem.builder().id("t3").nameZh("全息外套").nameEn("Holo Coat").category("top")
                .imageUrl("https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300").rarity("legendary").price(999)
                .tags(List.of("hologram","premium")).locked(true).build(),
            WardrobeItem.builder().id("b1").nameZh("霓虹裤").nameEn("Neon Pants").category("bottom")
                .imageUrl("https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=300").rarity("common").price(199)
                .tags(List.of("pants","neon")).build(),
            WardrobeItem.builder().id("b2").nameZh("机械战裤").nameEn("Mech Pants").category("bottom")
                .imageUrl("https://images.unsplash.com/photo-1542272604-787c3835535d?w=300").rarity("epic").price(499)
                .tags(List.of("mechanical","combat")).build(),
            WardrobeItem.builder().id("a1").nameZh("全息护目镜").nameEn("Holo Goggles").category("accessory")
                .imageUrl("https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=300").rarity("epic").price(599)
                .tags(List.of("goggles","tech")).build(),
            WardrobeItem.builder().id("a2").nameZh("赛博项圈").nameEn("Cyber Collar").category("accessory")
                .imageUrl("https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300").rarity("rare").price(299)
                .tags(List.of("collar","neon")).newItem(true).build(),
            WardrobeItem.builder().id("s1").nameZh("霓虹战靴").nameEn("Neon Boots").category("shoes")
                .imageUrl("https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=300").rarity("rare").price(399)
                .tags(List.of("boots","combat")).build(),
            WardrobeItem.builder().id("s2").nameZh("悬浮鞋").nameEn("Hover Shoes").category("shoes")
                .imageUrl("https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=300").rarity("legendary").price(1499)
                .tags(List.of("hover","future")).locked(true).build(),
            WardrobeItem.builder().id("h1").nameZh("霓虹双马尾").nameEn("Neon Twintails").category("hair")
                .imageUrl("https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=300").rarity("rare").price(399)
                .tags(List.of("twintails","colorful")).build(),
            WardrobeItem.builder().id("h2").nameZh("量子短发").nameEn("Quantum Bob").category("hair")
                .imageUrl("https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300").rarity("common").price(199)
                .tags(List.of("short","modern")).newItem(true).build()
        ));
    }

    private void seedPoses() {
        if (poseRepo.count() > 0) return;
        poseRepo.saveAll(List.of(
            Pose.builder().id("pose-1").nameZh("自信站姿").nameEn("Confident Stand").category("standing")
                .thumbnail("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300").difficulty("easy").newItem(true).build(),
            Pose.builder().id("pose-2").nameZh("休闲倚靠").nameEn("Casual Lean").category("standing")
                .thumbnail("https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300").difficulty("easy").build(),
            Pose.builder().id("pose-3").nameZh("超模姿态").nameEn("Model Pose").category("standing")
                .thumbnail("https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300").difficulty("medium").build(),
            Pose.builder().id("pose-4").nameZh("优雅端坐").nameEn("Elegant Sit").category("sitting")
                .thumbnail("https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300").difficulty("easy").build(),
            Pose.builder().id("pose-5").nameZh("爵士舞步").nameEn("Jazz Dance").category("dancing")
                .thumbnail("https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=300").difficulty("hard").build(),
            Pose.builder().id("pose-6").nameZh("麦克风握姿").nameEn("Mic Hold").category("singing")
                .thumbnail("https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=300").difficulty("easy").build(),
            Pose.builder().id("pose-7").nameZh("飞吻动作").nameEn("Blow Kiss").category("action")
                .thumbnail("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300").difficulty("easy").build(),
            Pose.builder().id("pose-8").nameZh("战斗姿态").nameEn("Combat Stance").category("standing")
                .thumbnail("https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300").difficulty("hard").locked(true).build()
        ));
    }

    private void seedExpressions() {
        if (expressionRepo.count() > 0) return;
        expressionRepo.saveAll(List.of(
            Expression.builder().id("exp-1").nameZh("开心").nameEn("Happy").emoji("😊").intensity(80).category("happy").build(),
            Expression.builder().id("exp-2").nameZh("大笑").nameEn("Laughing").emoji("😆").intensity(100).category("happy").build(),
            Expression.builder().id("exp-3").nameZh("微笑").nameEn("Smile").emoji("🙂").intensity(60).category("happy").build(),
            Expression.builder().id("exp-4").nameZh("悲伤").nameEn("Sad").emoji("😢").intensity(70).category("sad").build(),
            Expression.builder().id("exp-5").nameZh("酷炫").nameEn("Cool").emoji("😎").intensity(85).category("cool").build(),
            Expression.builder().id("exp-6").nameZh("惊讶").nameEn("Surprised").emoji("😲").intensity(80).category("surprised").build(),
            Expression.builder().id("exp-7").nameZh("害羞").nameEn("Shy").emoji("😳").intensity(70).category("other").build(),
            Expression.builder().id("exp-8").nameZh("爱心").nameEn("Love").emoji("😍").intensity(90).category("happy").build()
        ));
    }

    private void seedGestures() {
        if (gestureRepo.count() > 0) return;
        gestureRepo.saveAll(List.of(
            Gesture.builder().id("gesture-1").nameZh("比心").nameEn("Heart").icon("❤️").category("love").build(),
            Gesture.builder().id("gesture-2").nameZh("点赞").nameEn("Thumbs Up").icon("👍").category("approval").build(),
            Gesture.builder().id("gesture-3").nameZh("和平手势").nameEn("Peace").icon("✌️").category("peace").build(),
            Gesture.builder().id("gesture-4").nameZh("摇滚手势").nameEn("Rock On").icon("🤘").category("rock").build(),
            Gesture.builder().id("gesture-5").nameZh("挥手").nameEn("Wave").icon("👋").category("greeting").build()
        ));
    }

    private void seedTracks() {
        if (trackRepo.count() > 0) return;
        trackRepo.saveAll(List.of(
            Track.builder().id("track-101").titleZh("Neon Tears").titleEn("Neon Tears")
                .style("Synthwave").durationSec(214).durationLabel("3:34").status("Published").date("2026-03-10").plays(450000L).build(),
            Track.builder().id("track-102").titleZh("Cyber City Vibe").titleEn("Cyber City Vibe")
                .style("Future Bass").durationSec(188).durationLabel("3:08").status("Draft").date("2026-03-12").plays(0L).build(),
            Track.builder().id("track-103").titleZh("Electric Dreams").titleEn("Electric Dreams")
                .style("Cyberpunk Pop").durationSec(205).durationLabel("3:25").status("Published").date("2026-03-18").plays(980000L).build()
        ));
    }

    private void seedMarketplaceListings() {
        if (listingRepo.count() > 0) return;
        listingRepo.saveAll(List.of(
            MarketplaceListing.builder().id("listing-1").artistId("singer-1").name("Neon Warrior").style("EDM")
                .avatarUrl("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400")
                .priceLabel("¥ 8,800").owner("Creator Guild").songs(12).followersLabel("25k")
                .description("Cyberpunk dance-pop virtual idol ready for campaign scaling.").autoReplyEnabled(true).build(),
            MarketplaceListing.builder().id("listing-2").artistId("singer-2").name("Cloud Fairy").style("Ancient Pop")
                .avatarUrl("https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400")
                .priceLabel("¥ 10,000").owner("Creator Guild").songs(15).followersLabel("33k")
                .description("High-retention idol suited for fantasy-themed campaigns.").autoReplyEnabled(false).build(),
            MarketplaceListing.builder().id("listing-3").artistId("singer-4").name("Midnight DJ").style("Deep House")
                .avatarUrl("https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400")
                .priceLabel("¥ 11,200").owner("Creator Guild").songs(18).followersLabel("41k")
                .description("Festival-ready DJ profile with strong club distribution fit.").autoReplyEnabled(false).build()
        ));
    }

    private void seedNftCollections() {
        if (nftRepo.count() > 0) return;
        nftRepo.saveAll(List.of(
            NftCollection.builder().id("nft-1").name("Neon Genesis #102")
                .coverUrl("https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=400")
                .priceLabel("¥ 19.9").remaining(12).rarity("rare").trackId("track-101").build(),
            NftCollection.builder().id("nft-2").name("Neon Genesis #202")
                .coverUrl("https://images.unsplash.com/photo-1514525253440-b393452e2347?w=400")
                .priceLabel("¥ 29.9").remaining(8).rarity("epic").trackId("track-102").build(),
            NftCollection.builder().id("nft-3").name("Neon Genesis #302")
                .coverUrl("https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400")
                .priceLabel("¥ 39.9").remaining(5).rarity("legendary").trackId("track-103").build()
        ));
    }
}
