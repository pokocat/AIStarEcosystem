package com.aistareco.aep.ipstudio.segmented;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class SegmentedPlanTest {
    @Test void everySegmentButTheLastUsesTheModelsFullLength() {
        assertEquals(List.of(15, 15, 15, 15), SegmentedPlan.split(60, 5, 15));
        assertEquals(List.of(30, 30), SegmentedPlan.split(60, 4, 30));
        assertEquals(List.of(30, 15), SegmentedPlan.split(45, 4, 30));
        assertEquals(List.of(15, 15, 10), SegmentedPlan.split(40, 5, 15));
    }

    @Test void aRemainderTooShortForTheModelBorrowsFromTheSegmentBefore() {
        // 46 秒以前切成 15+15+15+1，模型做不了 1 秒。
        assertEquals(List.of(15, 15, 11, 5), SegmentedPlan.split(46, 5, 15));
        assertEquals(46, SegmentedPlan.split(46, 5, 15).stream().mapToInt(i -> i).sum());
        assertEquals(List.of(26, 4), SegmentedPlan.split(30 , 4, 26));
    }

    @Test void aModelWithOneLengthOnlyRoundsUp() {
        assertEquals(List.of(5, 5, 5), SegmentedPlan.split(12, 5, 5));
    }

    @Test void shotsFollowTheSecondsAndAThirtySecondSegmentGetsTwoBoards() {
        var fifteen = SegmentedPlan.segments(15, 5, 15, false).get(0);
        assertEquals(1, fifteen.boards());
        assertEquals(3, fifteen.shotsLo());
        assertEquals(4, fifteen.shotsHi());
        var thirty = SegmentedPlan.segments(30, 4, 30, false).get(0);
        assertEquals(2, thirty.boards());
        assertEquals(6, thirty.shotsLo());
        assertEquals(8, thirty.shotsHi());
        var five = SegmentedPlan.segments(5, 5, 15, false).get(0);
        assertEquals(1, five.boards());
        assertTrue(five.shotsHi() <= 2);
    }

    @Test void aFirstFrameOnlyModelGetsOneShotPerSegment() {
        var segments = SegmentedPlan.segments(30, 5, 10, true);
        assertEquals(3, segments.size());
        segments.forEach(s -> { assertEquals(1, s.shotsHi()); assertEquals(1, s.boards()); });
    }

    @Test void startTimesRunOnFromOneSegmentToTheNext() {
        var segments = SegmentedPlan.segments(46, 5, 15, false);
        assertEquals(0, segments.get(0).startSec());
        assertEquals(15, segments.get(1).startSec());
        assertEquals(41, segments.get(3).startSec());
    }
}
