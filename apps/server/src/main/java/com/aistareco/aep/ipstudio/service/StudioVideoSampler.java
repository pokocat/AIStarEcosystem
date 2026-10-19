package com.aistareco.aep.ipstudio.service;

import java.nio.file.*;
import java.util.*;

/** Mechanical visual-change candidates; original timestamps and before/after frames remain authoritative. */
final class StudioVideoSampler {
    record Change(int frame,double score,boolean lighting) {}
    record Selection(List<Integer> frames,List<Change> changes) {}
    record Scan(List<Double> times,List<Change> changes,List<Path> paths) {}
    private StudioVideoSampler() {}
    static Scan scan(Path video,Path directory,double duration,StudioHypitMedia hypit) throws Exception {
        var evidence=hypit.read(video,directory,duration);List<Double> times=new ArrayList<>();List<Path> paths=new ArrayList<>();
        for(var frame:evidence.path("frames")){times.add(frame.path("at").asDouble());paths.add(Path.of(frame.path("path").asText()));}
        List<Change> changes=new ArrayList<>();
        for(var candidate:evidence.path("candidates")) {
            if(times.size()<2)break;
            double at=candidate.path("at").asDouble(),score=candidate.path("score").asDouble();
            int frame=Collections.binarySearch(times,at);if(frame<0)frame=-frame-1;frame=Math.min(times.size()-1,Math.max(1,frame));if(frame>=times.size())continue;
            var before=javax.imageio.ImageIO.read(paths.get(frame-1).toFile());var after=javax.imageio.ImageIO.read(paths.get(frame).toFile());
            double brightnessA=brightness(before),brightnessB=brightness(after);boolean lighting=Math.abs(brightnessA-brightnessB)>.12;
            Change change=new Change(frame,score,lighting);
            if(!changes.isEmpty()&&times.get(frame)-times.get(changes.get(changes.size()-1).frame())<.35){if(score>changes.get(changes.size()-1).score())changes.set(changes.size()-1,change);}else changes.add(change);
        }
        return new Scan(List.copyOf(times),List.copyOf(changes),List.copyOf(paths));
    }
    private static double brightness(java.awt.image.BufferedImage image) {
        double sum=0;for(int y=0;y<18;y++)for(int x=0;x<32;x++){int color=image.getRGB(Math.min(image.getWidth()-1,x*image.getWidth()/32),Math.min(image.getHeight()-1,y*image.getHeight()/18));sum+=.2126*((color>>16)&255)+.7152*((color>>8)&255)+.0722*(color&255);}return sum/(32*18*255);
    }
    static Selection choose(int count,double fps,int limit,List<Change> candidates) {
        List<Double> times=new ArrayList<>();for(int i=0;i<count;i++)times.add(i/fps);
        return choose(times,limit,candidates);
    }
    static Selection choose(List<Double> times,int limit,List<Change> candidates) {
        int count=times.size();if(count==0||limit<2)throw new IllegalArgumentException("Invalid sampling budget");
        List<Change> changes=candidates.stream().sorted(Comparator.comparingDouble(Change::score).reversed())
                .limit(Math.max(0,(limit-12)/3)).sorted(Comparator.comparingInt(Change::frame)).toList();
        TreeSet<Integer> selected=new TreeSet<>();selected.add(0);selected.add(count-1);
        for(Change change:changes)for(int delta:new int[]{-1,0,1})selected.add(Math.max(0,Math.min(count-1,change.frame()+delta)));
        while(selected.size()<limit) {
            Integer previous=null;double gap=0;int left=0,rightEnd=0;
            for(int right:selected){if(previous!=null&&right-previous>1&&times.get(right)-times.get(previous)>gap){gap=times.get(right)-times.get(previous);left=previous;rightEnd=right;}previous=right;}
            if(gap<=.75)break;
            double midpoint=(times.get(left)+times.get(rightEnd))/2;int middle=Collections.binarySearch(times,midpoint);
            if(middle<0)middle=-middle-1;
            selected.add(Math.max(left+1,Math.min(rightEnd-1,middle)));
        }
        return new Selection(List.copyOf(selected),changes);
    }
}
