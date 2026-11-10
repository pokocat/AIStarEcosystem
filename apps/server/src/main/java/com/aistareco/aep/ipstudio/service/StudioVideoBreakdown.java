package com.aistareco.aep.ipstudio.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 拉片 v2（2026-11-09，docs/ip-studio-recreation.md「直接看视频的拉片」）：整条视频（画面 + 声音）交给能看视频的模型，
 * 一次写出逐镜分镜、台词、字幕、段落结构、爆点和复刻要点。代码只做三件事：
 * <ul>
 *   <li>真实的切镜时间（ffmpeg scdet）交给模型做参考，模型自己给的时间不当真值；</li>
 *   <li>把模型的输出整理成首尾相接、覆盖全片的镜头表（时间以原片为准）；</li>
 *   <li>按所选视频模型的时长上下限，把相邻镜头拼成「一次生成」的段（只在镜头边界切）。</li>
 * </ul>
 * 不判断模型写得对不对（§8.0.1 ②：不做语义硬判），只保证结构可用。
 */
public final class StudioVideoBreakdown {
    private static final ObjectMapper OM=new ObjectMapper();
    public static final String STRATEGY="video-understanding-v1";
    /** 交给模型的抽帧频率。真实切镜点另外给，1.5 秒一镜的快切也能对上。 */
    public static final double FPS=2.0;
    /** 代理视频上限：base64 后约 24 MB，各家的单个请求都放得下。 */
    static final long MAX_PROXY_BYTES=18L*1024*1024;
    /** 连续镜头超过这个秒数就按台词间隙切成几拍：每拍只带自己那几句，分段时台词跟着走（2026-11-09 真跑：一镜到底 41 秒被均分成 3 段，每段都带着全部台词）。 */
    static final double BEAT_SEC=6;
    private static final Pattern SCENE_TIME=Pattern.compile("lavfi\\.scd\\.time:\\s*([0-9]+(?:\\.[0-9]+)?)");

    private StudioVideoBreakdown() {}

    public record Media(Path proxy,List<Double> cuts) {}
    public record Unit(int no,double startSec,double endSec,int firstShot,int lastShot,String title) {
        public double length(){return endSec-startSec;}
    }

    /** 代理视频（短边 640 左右、10fps、单声道）和真实切镜点。原片不改。 */
    public static Media prepare(Path source,Path directory,double duration) throws Exception {
        Path proxy=directory.resolve("breakdown-proxy.mp4");
        encode(source,proxy,640,30);
        if(Files.size(proxy)>MAX_PROXY_BYTES)encode(source,proxy,480,36);
        if(Files.size(proxy)>MAX_PROXY_BYTES)throw new BusinessException(org.springframework.http.HttpStatus.BAD_REQUEST,"STUDIO_RECREATION_MEDIA_LIMIT","参考视频画面太复杂，压缩后仍超出模型能读取的大小，请先剪短");
        return new Media(proxy,detectCuts(source,duration));
    }

    /** 一条视频的真实切镜时间（ffmpeg scdet）。拉片用它给模型做参考，成片检查用它按镜头抽帧。 */
    public static List<Double> detectCuts(Path source,double duration) throws Exception {
        String log=run(List.of("ffmpeg","-hide_banner","-nostdin","-v","info","-i",source.toString(),"-an","-vf","scale=160:-2,scdet=threshold=12:sc_pass=1","-f","null","-"),true);
        return cuts(log,duration);
    }

    private static void encode(Path source,Path proxy,int edge,int crf) throws Exception {
        String scale="scale='if(gt(iw,ih),"+edge+",-2)':'if(gt(iw,ih),-2,"+edge+")',fps=10";
        run(List.of("ffmpeg","-v","error","-nostdin","-y","-threads","2","-i",source.toString(),"-map","0:v:0","-map","0:a:0?","-vf",scale,
                "-c:v","libx264","-preset","veryfast","-crf",String.valueOf(crf),"-pix_fmt","yuv420p","-c:a","aac","-b:a","48k","-ac","1","-movflags","+faststart",proxy.toString()),false);
    }

    /** scdet 的切镜时间：0.2 秒内的连续命中算一次（闪光、快速运动常连着报），离片头片尾太近的不算。 */
    static List<Double> cuts(String log,double duration) {
        List<Double> raw=new ArrayList<>();
        Matcher m=SCENE_TIME.matcher(log==null?"":log);
        while(m.find())raw.add(Double.parseDouble(m.group(1)));
        Collections.sort(raw);
        List<Double> out=new ArrayList<>();
        for(double t:raw) {
            if(t<.3||t>duration-.3)continue;
            if(!out.isEmpty()&&t-out.get(out.size()-1)<.2)continue;
            out.add(round(t));
        }
        return out;
    }

    /** OpenAI 兼容的视频输入块（火山方舟 / 百炼都认 video_url + data URL；fps 是方舟的抽帧参数，别家忽略）。 */
    public static Map<String,Object> videoPart(Path proxy) throws Exception {
        String data="data:video/mp4;base64,"+Base64.getEncoder().encodeToString(Files.readAllBytes(proxy));
        Map<String,Object> video=new LinkedHashMap<>();video.put("url",data);video.put("fps",FPS);
        return Map.of("type","video_url","video_url",video);
    }

    /** 交给模型的切镜说明（提示词库 stage-video-breakdown 的 cuts 变量）。 */
    public static String cutsText(List<Double> cuts) {
        if(cuts.isEmpty())return "没有检测到切镜（可能是一镜到底）";
        StringBuilder out=new StringBuilder();
        for(double c:cuts){if(out.length()>0)out.append("、");out.append(fmt(c));}
        return out.toString();
    }

    /**
     * 整理模型的拆解：镜头按时间排好、首尾相接、覆盖 0 到片尾；模型没给出可用镜头时按真实切镜点建空白镜头（标 shotsFromCuts）。
     * 只截长度、不改内容。
     */
    public static ObjectNode normalize(JsonNode raw,double duration,List<Double> cuts) {
        if(raw==null||!raw.isObject())raw=OM.createObjectNode();
        ObjectNode out=OM.createObjectNode();
        out.put("summary",text(raw.path("summary"),300)).put("type",text(raw.path("type"),40)).put("music",text(raw.path("music"),300));
        var people=out.putArray("people");
        for(JsonNode p:list(raw.path("people"),12))if(p.isObject())people.addObject().put("id",text(p.path("id"),8)).put("who",text(p.path("who"),200))
                .put("role",text(p.path("role"),20)).put("speaks",p.path("speaks").asBoolean(false));
        var products=out.putArray("products");
        for(JsonNode p:list(raw.path("products"),12))if(p.isObject())products.addObject().put("id",text(p.path("id"),8)).put("what",text(p.path("what"),200)).put("role",text(p.path("role"),20));
        // 镜头
        List<ObjectNode> shots=new ArrayList<>();
        for(JsonNode s:list(raw.path("shots"),200)) {
            double start=s.path("start").asDouble(Double.NaN),end=s.path("end").asDouble(Double.NaN);
            if(!Double.isFinite(start)||!Double.isFinite(end))continue;
            ObjectNode shot=OM.createObjectNode().put("start",clamp(start,duration)).put("end",clamp(end,duration))
                    .put("size",text(s.path("size"),20)).put("camera",text(s.path("camera"),80)).put("visual",text(s.path("visual"),400));
            shot.set("people",strings(s.path("people"),8,8));shot.set("products",strings(s.path("products"),8,8));
            var dialogue=shot.putArray("dialogue");
            for(JsonNode d:list(s.path("dialogue"),40)) {
                String line=text(d.path("text"),300);
                if(line.isBlank())continue;
                ObjectNode item=dialogue.addObject().put("who",text(d.path("who"),16)).put("text",line);
                double at=d.path("at").asDouble(Double.NaN);
                if(Double.isFinite(at))item.put("at",round(clamp(at,duration)));
            }
            shot.put("caption",text(s.path("caption"),200)).put("sound",text(s.path("sound"),160)).put("transition",text(s.path("transition"),20));
            shots.add(shot);
        }
        shots.sort(Comparator.comparingDouble(s->s.path("start").asDouble()));
        List<ObjectNode> kept=new ArrayList<>();
        for(ObjectNode shot:shots) {
            double start=kept.isEmpty()?0:kept.get(kept.size()-1).path("end").asDouble();
            double end=Math.max(start,shot.path("end").asDouble());
            if(end-start<.05)continue;
            shot.put("start",round(start)).put("end",round(end));kept.add(shot);
        }
        boolean fromCuts=kept.isEmpty();
        if(fromCuts) {
            double start=0;
            List<Double> ends=new ArrayList<>(cuts);ends.add(duration);
            for(double end:ends){if(end-start<.05)continue;kept.add(OM.createObjectNode().put("start",round(start)).put("end",round(end)).put("size","").put("camera","").put("visual","")
                    .<ObjectNode>set("people",OM.createArrayNode()).<ObjectNode>set("products",OM.createArrayNode()).<ObjectNode>set("dialogue",OM.createArrayNode())
                    .put("caption","").put("sound","").put("transition",""));start=end;}
        }
        if(!kept.isEmpty()) {
            ObjectNode last=kept.get(kept.size()-1);
            if(last.path("end").asDouble()<duration)last.put("end",round(duration));
        }
        var shotArray=out.putArray("shots");
        for(ObjectNode shot:kept)beats(shot).forEach(shotArray::add);
        if(fromCuts)out.put("shotsFromCuts",true);
        // 段落
        var parts=out.putArray("parts");double previous=0;
        for(JsonNode p:list(raw.path("parts"),12)) {
            double end=clamp(p.path("end").asDouble(Double.NaN),duration);
            if(!Double.isFinite(end)||end<=previous+.05)continue;
            parts.addObject().put("name",text(p.path("name"),20)).put("start",round(previous)).put("end",round(end)).put("purpose",text(p.path("purpose"),200));
            previous=end;
        }
        if(parts.isEmpty())parts.addObject().put("name","全片").put("start",0).put("end",round(duration)).put("purpose","");
        else ((ObjectNode)parts.get(parts.size()-1)).put("end",round(duration));
        out.set("highlights",strings(raw.path("highlights"),12,300));
        ObjectNode remake=out.putObject("remake");JsonNode r=raw.path("remake");
        remake.set("keep",strings(r.path("keep"),12,300));remake.set("change",strings(r.path("change"),12,300));remake.set("risks",strings(r.path("risks"),12,300));
        var cutArray=out.putArray("cuts");cuts.forEach(cutArray::add);
        out.put("durationSec",round(duration));
        return out;
    }

    /**
     * 超过 {@link #BEAT_SEC} 的连续镜头切成几拍：切点优先落在两句台词中间（不把一句话切开），每拍只带开始说于这一拍里的台词，
     * 后面几拍的 transition 是「同一镜头接着拍」。台词没写开始时间的，按字数在这一镜里均匀估。
     */
    static List<ObjectNode> beats(ObjectNode shot) {
        double start=shot.path("start").asDouble(),end=shot.path("end").asDouble(),length=end-start;
        if(length<=BEAT_SEC+1e-6)return List.of(shot);
        int n=(int)Math.ceil(length/BEAT_SEC-1e-9);
        List<JsonNode> lines=list(shot.path("dialogue"),200);
        double[] at=new double[lines.size()];
        boolean timed=!lines.isEmpty();
        for(JsonNode line:lines){double t=line.path("at").asDouble(Double.NaN);if(!Double.isFinite(t)||t<start-.5||t>end+.5)timed=false;}
        if(timed)for(int k=0;k<lines.size();k++)at[k]=Math.max(start,Math.min(end,lines.get(k).path("at").asDouble()));
        else {
            double total=0;for(JsonNode line:lines)total+=Math.max(1,line.path("text").asText().length());
            double before=0;
            for(int k=0;k<lines.size();k++){double chars=Math.max(1,lines.get(k).path("text").asText().length());at[k]=start+length*(before+chars/2)/total;before+=chars;}
        }
        // 两句之间的中点是候选切点；每个均分点就近吸到候选上（不超过半拍、每拍不短于 1.5 秒）。
        List<Double> gaps=new ArrayList<>();
        for(int k=0;k+1<at.length;k++)if(at[k+1]>at[k])gaps.add((at[k]+at[k+1])/2);
        List<Double> bounds=new ArrayList<>();bounds.add(start);
        for(int j=1;j<n;j++) {
            double target=start+length*j/n,best=target,previous=bounds.get(bounds.size()-1);
            for(double g:gaps)if(Math.abs(g-target)<Math.abs(best-target)-1e-9&&Math.abs(g-target)<=length/(2*n)&&g-previous>=1.5&&end-g>=1.5)best=g;
            if(best-previous>=1.5)bounds.add(round(best));
        }
        bounds.add(end);
        List<ObjectNode> out=new ArrayList<>();
        for(int j=0;j+1<bounds.size();j++) {
            double a=bounds.get(j),b=bounds.get(j+1);
            ObjectNode beat=shot.deepCopy().put("start",round(a)).put("end",round(b));
            ArrayNode dialogue=beat.putArray("dialogue");
            for(int k=0;k<lines.size();k++)if(at[k]>=a-1e-9&&(at[k]<b-1e-9||j==bounds.size()-2)) {
                ObjectNode line=(ObjectNode)lines.get(k).deepCopy();line.put("at",round(at[k]));dialogue.add(line);
            }
            if(j+2<bounds.size())beat.put("transition","同一镜头接着拍");
            out.add(beat);
        }
        return out;
    }

    /**
     * 相邻镜头拼成一次生成的段，只在镜头边界切：每段不超过 {@code max} 秒，尽量不短于 {@code min} 秒（太短的尾段并进前一段）。
     * 比 {@code max} 还长的单个镜头均分。超过 {@code maxUnits} 段时报 STUDIO_SEGMENT_TOO_LONG（和旧拉片同一个错误）。
     */
    public static List<Unit> units(JsonNode breakdown,double max,double min,int maxUnits) {
        double duration=breakdown.path("durationSec").asDouble();
        List<double[]> pieces=new ArrayList<>(); // {start,end,shotIndex}
        JsonNode shots=breakdown.path("shots");
        for(int i=0;i<shots.size();i++) {
            double s=shots.get(i).path("start").asDouble(),e=shots.get(i).path("end").asDouble();
            int n=Math.max(1,(int)Math.ceil((e-s)/max-1e-9));
            for(int k=0;k<n;k++)pieces.add(new double[]{s+(e-s)*k/n,s+(e-s)*(k+1)/n,i});
        }
        List<List<double[]>> groups=new ArrayList<>();List<double[]> current=new ArrayList<>();
        for(double[] piece:pieces) {
            if(!current.isEmpty()&&piece[1]-current.get(0)[0]>max+1e-6){groups.add(current);current=new ArrayList<>();}
            current.add(piece);
        }
        if(!current.isEmpty())groups.add(current);
        // 太短的段并进相邻段（放得下才并）；尾段优先并进前一段。
        boolean merged=true;
        while(merged&&groups.size()>1) {
            merged=false;
            for(int i=0;i<groups.size();i++) {
                List<double[]> g=groups.get(i);
                if(len(g)>=min-1e-6)continue;
                int left=i-1,right=i+1;
                int target=left>=0&&right<groups.size()?(len(groups.get(left))<=len(groups.get(right))?left:right):left>=0?left:right;
                if(target<0||target>=groups.size())continue;
                List<double[]> joined=new ArrayList<>(target<i?groups.get(target):g);joined.addAll(target<i?g:groups.get(target));
                if(len(joined)<=max+1e-6){groups.set(Math.min(i,target),joined);groups.remove(Math.max(i,target));merged=true;break;}
                // 并不下：从前一段挪镜头过来（前一段挪完不能也变得太短），两段都在上下限之内。
                if(i>0) {
                    List<double[]> prev=groups.get(i-1);
                    while(len(g)<min-1e-6&&prev.size()>1) {
                        double[] moved=prev.get(prev.size()-1);
                        double nextLen=g.get(g.size()-1)[1]-moved[0],prevLen=moved[0]-prev.get(0)[0];
                        if(nextLen>max+1e-6||prevLen<min-1e-6)break;
                        prev.remove(prev.size()-1);g.add(0,moved);
                    }
                }
            }
        }
        if(groups.size()>maxUnits)throw StudioFilmStudy.tooLong(new StudioFilmStudy.SegmentCap(max,maxUnits),duration,List.of());
        List<Unit> out=new ArrayList<>();int no=1;
        for(List<double[]> g:groups) {
            double start=g.get(0)[0],end=g.get(g.size()-1)[1];
            out.add(new Unit(no,round(start),round(end),(int)g.get(0)[2],(int)g.get(g.size()-1)[2],partName(breakdown,(start+end)/2,no)));no++;
        }
        return out;
    }
    private static double len(List<double[]> g){return g.get(g.size()-1)[1]-g.get(0)[0];}
    private static String partName(JsonNode breakdown,double at,int no) {
        for(JsonNode p:breakdown.path("parts"))if(at>=p.path("start").asDouble()&&at<p.path("end").asDouble()&&!p.path("name").asText("").isBlank()&&!"全片".equals(p.path("name").asText()))
            return p.path("name").asText();
        return "第 "+no+" 段";
    }

    // ── 第二遍：逐镜细读（2026-11-10）────────────────────────────────
    //
    // 整条片一起拉片时，模型会把细节概括掉：美食那条「手指捏住远处很小的女生、再瞬间拉到眼前」只写成了「比框 + 推镜」，
    // 后面写提示词和出片都跟着丢了；单独问那 2 秒，同一个模型每秒 2 帧就答得出来。所以把相邻几个镜头切成不超过 6 秒的小段，
    // 每秒 5 帧再看一遍，按固定维度写（提示词库 stage-video-shot-detail），并选出每个镜头最能代表开场构图的时刻（截开场画面用）。

    /** 细读时交给模型的抽帧频率。 */
    public static final double DETAIL_FPS=5.0;
    /** 一次细读的片段最长秒数。 */
    static final double DETAIL_WINDOW_SEC=6;
    /** 一个窗口：第 {@code from}–{@code to} 镜（下标），原片 {@code start}–{@code end} 秒。 */
    public record Window(int from,int to,double start,double end) {}

    /** 相邻镜头凑成不超过 {@link #DETAIL_WINDOW_SEC} 秒的窗口；单个镜头更长的自成一个窗口。 */
    public static List<Window> windows(JsonNode breakdown) {
        List<Window> out=new ArrayList<>();
        JsonNode shots=breakdown.path("shots");
        int from=-1;
        for(int i=0;i<shots.size();i++) {
            if(from>=0&&shots.get(i).path("end").asDouble()-shots.get(from).path("start").asDouble()>DETAIL_WINDOW_SEC+1e-6) {
                out.add(new Window(from,i-1,shots.get(from).path("start").asDouble(),shots.get(i-1).path("end").asDouble()));from=-1;
            }
            if(from<0)from=i;
        }
        if(from>=0)out.add(new Window(from,shots.size()-1,shots.get(from).path("start").asDouble(),shots.get(shots.size()-1).path("end").asDouble()));
        return out;
    }

    /** 从代理视频里切出一个窗口（只要画面）。 */
    public static Path windowClip(Path proxy,Path directory,Window w) throws Exception {
        Path out=directory.resolve("detail-"+(w.from()+1)+".mp4");
        run(List.of("ffmpeg","-v","error","-nostdin","-y","-threads","2","-ss",fmt3(w.start()),"-to",fmt3(w.end()),"-i",proxy.toString(),"-an",
                "-c:v","libx264","-preset","veryfast","-crf","28","-pix_fmt","yuv420p","-movflags","+faststart",out.toString()),false);
        return out;
    }

    /** 细读的视频输入块：每秒 {@link #DETAIL_FPS} 帧。 */
    public static Map<String,Object> detailPart(Path clip) throws Exception {
        String data="data:video/mp4;base64,"+Base64.getEncoder().encodeToString(Files.readAllBytes(clip));
        Map<String,Object> video=new LinkedHashMap<>();video.put("url",data);video.put("fps",DETAIL_FPS);
        return Map.of("type","video_url","video_url",video);
    }

    /** 提示词库 stage-video-shot-detail 的变量。 */
    public static Map<String,Object> detailVariables(JsonNode breakdown,Window w) {
        List<Map<String,Object>> shots=new ArrayList<>();
        for(int i=w.from();i<=w.to();i++) {
            JsonNode s=breakdown.path("shots").get(i);
            shots.add(Map.of("no",i+1,"range",range(s.path("start").asDouble(),s.path("end").asDouble()),"visual",s.path("visual").asText("").isBlank()?"（没写）":s.path("visual").asText()));
        }
        return Map.of("range",range(w.start(),w.end()),"offset",fmt(w.start()),"shots",shots);
    }

    /**
     * 把一个窗口的细读结果写进镜头的 {@code detail}。只截长度、不改内容。frameAt 写成这一小段里的秒数时（比窗口开始还早）换算回原片，
     * 再收进这个镜头之内；没给的取镜头开头稍后一点。返回写进了几个镜头。
     */
    public static int mergeDetails(ObjectNode breakdown,Window w,JsonNode raw) {
        int merged=0;
        JsonNode shots=breakdown.path("shots");
        Set<Integer> done=new HashSet<>();
        for(JsonNode item:list(raw==null?null:raw.path("shots"),40)) {
            int index=shotOf(shots,w,item);
            if(index<0||!done.add(index))continue;
            ObjectNode shot=(ObjectNode)shots.get(index);
            ObjectNode detail=OM.createObjectNode();
            for(String field:List.of("scene","light","camera","layout","action","trick","effects"))detail.put(field,text(item.path(field),400));
            double at=item.path("frameAt").asDouble(Double.NaN);
            if(Double.isFinite(at)&&w.start()>0&&at<w.start()-.05&&at<=w.end()-w.start()+.05)at+=w.start();
            detail.put("frameAt",round(frameTime(breakdown,index,at)));
            shot.set("detail",detail);merged++;
        }
        return merged;
    }

    /**
     * 细读结果对应哪个镜头（下标）。镜号和开始时间都给了时以时间为准：2026-11-10 真跑，一个 5 镜的窗口模型只回了 2 镜，
     * 把第 7、8 镜的内容写在了「第 4、5 镜」名下，只认镜号就张冠李戴。时间写成小段里的秒数时换算回原片。都对不上返回 -1。
     */
    static int shotOf(JsonNode shots,Window w,JsonNode item) {
        double start=item.path("start").asDouble(Double.NaN);
        if(Double.isFinite(start)) {
            for(double t:new double[]{start,start+w.start()}) {
                int best=-1;double gap=Double.MAX_VALUE;
                for(int i=w.from();i<=w.to();i++) {
                    double d=Math.abs(shots.get(i).path("start").asDouble()-t);
                    if(d<gap){gap=d;best=i;}
                }
                if(best>=0&&gap<=.35)return best;
            }
            return -1;
        }
        int no=item.path("no").asInt(-1);
        return no-1>=w.from()&&no-1<=w.to()?no-1:-1;
    }

    /** 截开场画面时，只在镜头开头这么长的时间里取：开场构图才是要保住的（推镜、捏合这类镜头，中段已经是近景了）。 */
    static final double FRAME_WINDOW_SEC=.4;

    /**
     * 截开场画面的时刻（原片秒数）。镜头的开始先对到代码测出的真实切镜点（±0.5 秒内有就用它，模型给的时间常差零点几秒，
     * 2026-11-10 真跑第 2 镜截到了上一镜），再只在开头 {@link #FRAME_WINDOW_SEC} 秒里取：模型选的时刻在这之内就用，
     * 不在就取开头稍后一点（避开切镜那一帧的模糊）。
     */
    public static double frameTime(JsonNode breakdown,int index,double at) {
        JsonNode shot=breakdown.path("shots").get(index);
        double start=shot.path("start").asDouble(),end=shot.path("end").asDouble(),opening=start;
        if(index>0) {
            double gap=.5;
            for(JsonNode c:breakdown.path("cuts")){double d=Math.abs(c.asDouble()-start);if(d<=gap){gap=d;opening=c.asDouble();}}
        }
        double lo=Math.min(end,opening+.03),hi=Math.max(lo,Math.min(end-.05,opening+FRAME_WINDOW_SEC));
        if(!Double.isFinite(at)||at<lo||at>hi)at=Math.min(hi,lo+.09);
        return at;
    }

    /** 从原片截一帧（长边不超过 1280），给改开场画面用。 */
    public static Path frame(Path original,Path directory,int shotNo,double at) throws Exception {
        Path out=directory.resolve("frame-"+shotNo+".jpg");
        run(List.of("ffmpeg","-v","error","-nostdin","-y","-ss",fmt3(at),"-i",original.toString(),"-frames:v","1",
                "-vf","scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'","-q:v","2",out.toString()),false);
        if(!Files.exists(out)||Files.size(out)==0)throw new IllegalStateException("Video breakdown frame failed shot="+shotNo);
        return out;
    }

    /** 一个镜头细读结果的文字（给写提示词的模型看；没有细读就是空）。 */
    public static String detailText(JsonNode shot) {
        JsonNode d=shot.path("detail");
        if(!d.isObject())return "";
        StringBuilder out=new StringBuilder();
        for(String[] f:new String[][]{{"scene","场景"},{"light","用光"},{"camera","机位"},{"layout","开场构图"},{"action","动作"},{"trick","视觉把戏"},{"effects","后期效果"}}) {
            String v=d.path(f[0]).asText("");
            if(!v.isBlank())out.append(out.length()==0?"":"；").append(f[1]).append("：").append(v);
        }
        return out.toString();
    }

    private static String fmt3(double v){return String.format(Locale.ROOT,"%.3f",v);}
    /** 日志里的模型原话截一段。 */
    public static String clip(String value,int max){return value==null?"":value.length()<=max?value:value.substring(0,max);}

    // ── 给人看的拉片文档 ─────────────────────────────────────────────

    public static String report(JsonNode b) {
        StringBuilder out=new StringBuilder("# 拉片");
        if(!b.path("type").asText("").isBlank())out.append(" · ").append(b.path("type").asText());
        out.append("\n\n");
        if(!b.path("summary").asText("").isBlank())out.append(b.path("summary").asText()).append("\n\n");
        out.append("原片 ").append(fmt(b.path("durationSec").asDouble())).append(" 秒，").append(b.path("shots").size()).append(" 个镜头。\n\n");
        if(b.path("people").size()+b.path("products").size()>0) {
            out.append("## 人物与商品\n\n");
            for(JsonNode p:b.path("people"))out.append("- ").append(p.path("id").asText()).append("：").append(p.path("who").asText())
                    .append(p.path("role").asText("").isBlank()?"":"（"+p.path("role").asText()+(p.path("speaks").asBoolean()?"，说话":"")+"）").append('\n');
            for(JsonNode p:b.path("products"))out.append("- ").append(p.path("id").asText()).append("：").append(p.path("what").asText())
                    .append(p.path("role").asText("").isBlank()?"":"（"+p.path("role").asText()+"）").append('\n');
            out.append('\n');
        }
        out.append("## 段落结构\n\n| 时间 | 段落 | 作用 |\n|---|---|---|\n");
        for(JsonNode p:b.path("parts"))out.append("| ").append(range(p.path("start").asDouble(),p.path("end").asDouble())).append(" | ").append(cell(p.path("name").asText()))
                .append(" | ").append(cell(p.path("purpose").asText())).append(" |\n");
        out.append("\n## 分镜\n\n").append(shotTable(b,0,b.path("shots").size()-1,0));
        StringBuilder details=new StringBuilder();
        for(int i=0;i<b.path("shots").size();i++){String d=detailText(b.path("shots").get(i));if(!d.isBlank())details.append("- 第 ").append(i+1).append(" 镜：").append(d).append('\n');}
        if(details.length()>0)out.append("\n## 逐镜细读\n\n").append(details);
        if(!b.path("music").asText("").isBlank())out.append("\n## 背景音乐\n\n").append(b.path("music").asText()).append('\n');
        if(!b.path("highlights").isEmpty()){out.append("\n## 为什么能火\n\n");for(JsonNode h:b.path("highlights"))out.append("- ").append(h.asText()).append('\n');}
        JsonNode r=b.path("remake");
        if(r.path("keep").size()+r.path("change").size()+r.path("risks").size()>0) {
            out.append("\n## 复刻要点\n");
            section(out,"保留",r.path("keep"));section(out,"要改",r.path("change"));section(out,"难点",r.path("risks"));
        }
        return out.toString();
    }

    /** 一段的文档：原片时间和这段里的镜头。时间写原片的。 */
    public static String unitMarkdown(JsonNode b,Unit unit) {
        return "# 第 "+unit.no()+" 段 · "+unit.title()+"\n\n> 原片 "+range(unit.startSec(),unit.endSec())+"（"+fmt(unit.length())+" 秒），第 "+(unit.firstShot()+1)
                +(unit.lastShot()>unit.firstShot()?"–"+(unit.lastShot()+1):"")+" 镜\n\n"+shotTable(b,unit.firstShot(),unit.lastShot(),0,unit.startSec(),unit.endSec());
    }

    public static String shotTable(JsonNode b,int from,int to,double offset) {return shotTable(b,from,to,offset,Double.NEGATIVE_INFINITY,Double.POSITIVE_INFINITY);}

    /**
     * 一段（原片 {@code clipStart}–{@code clipEnd}）里的镜头表：镜头时间截到这一段内，台词只留在这一段里开始说的（没写开始时间的都留），
     * 时间减去 {@code offset}。比模型最长秒数还长的镜头被均分时，每段只看到自己那部分。
     */
    public static String shotTable(JsonNode b,int from,int to,double offset,double clipStart,double clipEnd) {
        StringBuilder out=new StringBuilder("| 镜 | 时间 | 景别 / 机位 | 画面 | 台词 | 字幕 | 声音 |\n|---|---|---|---|---|---|---|\n");
        JsonNode shots=b.path("shots");
        for(int i=Math.max(0,from);i<=to&&i<shots.size();i++) {
            JsonNode s=shots.get(i);
            List<String> lines=new ArrayList<>();
            boolean lastOfFilm=i==shots.size()-1;
            for(JsonNode d:s.path("dialogue")) {
                double at=d.path("at").asDouble(Double.NaN);
                if(Double.isFinite(at)&&(at<clipStart-1e-6||(at>=clipEnd-1e-6&&!(lastOfFilm&&at<=clipEnd+1e-6))))continue;
                lines.add((d.path("who").asText("").isBlank()?"":d.path("who").asText()+"：")+d.path("text").asText());
            }
            double shown0=Math.max(s.path("start").asDouble(),clipStart),shown1=Math.min(s.path("end").asDouble(),clipEnd);
            String camera=String.join(" / ",java.util.stream.Stream.of(s.path("size").asText(""),s.path("camera").asText("")).filter(x->!x.isBlank()).toList());
            out.append("| ").append(i+1).append(" | ").append(range(shown0-offset,shown1-offset)).append(" | ").append(cell(camera))
                    .append(" | ").append(cell(s.path("visual").asText())).append(" | ").append(cell(String.join(" ",lines))).append(" | ").append(cell(s.path("caption").asText()))
                    .append(" | ").append(cell(s.path("sound").asText())).append(" |\n");
        }
        return out.toString();
    }
    private static void section(StringBuilder out,String title,JsonNode items) {
        if(items.isEmpty())return;
        out.append("\n**").append(title).append("**\n\n");
        for(JsonNode item:items)out.append("- ").append(item.asText()).append('\n');
    }
    private static String cell(String value){return value==null||value.isBlank()?"—":value.replace("|","｜").replace("\r"," ").replace("\n"," ");}
    public static String range(double a,double b){return fmt(a)+"–"+fmt(b)+" 秒";}
    public static String fmt(double v){double r=Math.round(v*10)/10.0;return r==Math.rint(r)?String.valueOf((long)r):String.format(Locale.ROOT,"%.1f",r);}

    // ── 小工具 ───────────────────────────────────────────────────────

    private static List<JsonNode> list(JsonNode array,int max) {
        List<JsonNode> out=new ArrayList<>();
        if(array!=null&&array.isArray())for(JsonNode item:array){if(out.size()>=max)break;out.add(item);}
        return out;
    }
    private static ArrayNode strings(JsonNode array,int max,int chars) {
        ArrayNode out=OM.createArrayNode();
        if(array!=null&&array.isTextual()&&!array.asText().isBlank())out.add(cut(array.asText().strip(),chars));
        for(JsonNode item:list(array,max)) {
            String value=item.isTextual()?item.asText().strip():item.isNumber()?item.asText():"";
            if(!value.isBlank())out.add(cut(value,chars));
        }
        return out;
    }
    private static String text(JsonNode value,int max){return value==null||value.isNull()||value.isMissingNode()?"":cut(value.isTextual()?value.asText().strip():value.toString(),max);}
    private static String cut(String value,int max){return value.length()<=max?value:value.substring(0,max);}
    private static double clamp(double v,double duration){return Double.isFinite(v)?Math.max(0,Math.min(duration,v)):v;}
    static double round(double v){return Math.round(v*1000)/1000.0;}

    private static String run(List<String> command,boolean captureStderr) throws Exception {
        Process process=StudioHypitMedia.configureMediaRuntime(new ProcessBuilder(command)).redirectOutput(ProcessBuilder.Redirect.DISCARD)
                .redirectErrorStream(false).start();
        ByteArrayOutputStream err=new ByteArrayOutputStream();
        Thread reader=new Thread(()->{try{process.getErrorStream().transferTo(err);}catch(Exception ignored){}});reader.start();
        try {
            if(!process.waitFor(180,TimeUnit.SECONDS))throw new IllegalStateException("Video breakdown media timeout");
            reader.join(5000);
            if(process.exitValue()!=0)throw new IllegalStateException("Video breakdown media failed: "+tail(err.toString()));
            return captureStderr?err.toString():"";
        } finally {if(process.isAlive())process.destroyForcibly();}
    }
    private static String tail(String value){return value.length()<=400?value:value.substring(value.length()-400);}
}
