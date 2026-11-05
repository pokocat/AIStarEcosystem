package com.aistareco.aep.ipstudio.segmented;

import java.util.ArrayList;
import java.util.List;

/**
 * 比单段上限长的视频怎么切段（AI 视频页的长视频，docs/studio-segmented-video.md）。段数和每段秒数只在这里算，页面显示的也是这里算出来的。
 *
 * <p>切法是用满模型时长：前面每段都用到上限，最后一段放余数；余数比模型下限短时从前一段借，
 * 46 秒、单段 5–15 秒 → 15 + 15 + 11 + 5，不会切出模型做不了的 1 秒。
 */
public final class SegmentedPlan {
    private SegmentedPlan() {}

    /** 最多分几段：再多接缝太多，也说明选的模型单段太短。 */
    public static final int MAX_SEGMENTS = 12;
    /** 一张分镜图最多放几镜（2×2）。 */
    public static final int SHOTS_PER_BOARD = 4;
    /** 比这个秒数长的一段配两张分镜图，一段最多 8 镜。 */
    public static final int ONE_BOARD_SECONDS = 15;

    /** 一段：从第几秒开始、多长、写几个镜头、配几张分镜图。 */
    public record Segment(int no, int startSec, int seconds, int shotsLo, int shotsHi, int boards) {}

    public static List<Integer> split(int total, int min, int max) {
        if (total <= 0 || max <= 0 || min <= 0 || min > max) throw new IllegalArgumentException("segment bounds");
        int count = (total + max - 1) / max;
        int[] out = new int[count];
        for (int i = 0; i < count; i++) out[i] = max;
        out[count - 1] = total - (count - 1) * max;
        // 余数太短：从前面借，一段不够就接着往前借。借完第一段仍不够（下限等于或接近上限），只能都按下限以上出，总时长略长。
        for (int i = count - 1; i > 0 && out[i] < min; i--) {
            int need = min - out[i];
            out[i] = min;
            out[i - 1] -= need;
        }
        if (out[0] < min) out[0] = min;
        List<Integer> list = new ArrayList<>(count);
        for (int v : out) list.add(v);
        return list;
    }

    /** singleShot：所选模型只按一张首帧出片，一段一个镜头。 */
    public static List<Segment> segments(int total, int min, int max, boolean singleShot) {
        List<Segment> out = new ArrayList<>();
        int start = 0, no = 0;
        for (int seconds : split(total, min, max)) {
            int boards = singleShot || seconds <= ONE_BOARD_SECONDS ? 1 : 2;
            int hi = singleShot ? 1 : Math.min(boards * SHOTS_PER_BOARD, Math.max(1, seconds / 2));
            int lo = singleShot ? 1 : Math.min(hi, Math.max(1, (seconds + 4) / 5));
            out.add(new Segment(++no, start, seconds, lo, hi, boards));
            start += seconds;
        }
        return out;
    }
}
