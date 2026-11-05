package com.aistareco.aep.clip;
import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.service.ClipMediaQualityGate;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class ClipMediaQualityGateTest {
 @ParameterizedTest @CsvSource({"0,-16,-2","255,-16,-2","80,-40,-6","80,-18,0.7","80,-8,-2"})
 void qualityMetricsAreAdvisoryAndDoNotRejectExistingVideo(double luma,double loudness,double peak){
  var ffmpeg=mock(FfmpegRunner.class);
  when(ffmpeg.runFfmpeg(anyList())).thenReturn("lavfi.signalstats.YAVG="+luma,"{\"input_i\":\""+loudness+"\",\"input_tp\":\""+peak+"\"}");
  var measured=new ClipMediaQualityGate(ffmpeg,new ClipProperties()).assertAcceptable(Path.of("video.mp4"));
  assertEquals(luma,measured.averageLuma());assertEquals(peak,measured.truePeakDb());
 }
 @Test void unavailableMetricsStillKeepExistingOutput(){
  var ffmpeg=mock(FfmpegRunner.class);when(ffmpeg.runFfmpeg(anyList())).thenReturn("");
  assertDoesNotThrow(()->new ClipMediaQualityGate(ffmpeg,new ClipProperties()).assertAcceptable(Path.of("silent.mp4")));
 }
}
