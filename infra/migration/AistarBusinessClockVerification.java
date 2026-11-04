import java.time.*;import java.util.*;import org.springframework.scheduling.annotation.Scheduled;import org.springframework.scheduling.support.CronExpression;import com.fasterxml.jackson.databind.ObjectMapper;
/** No Spring context, SQL, scheduler or external service starts. Validate the preserved business clock. */
public class AistarBusinessClockVerification {
 public static void main(String[] args)throws Exception {
  ZoneId zone=ZoneId.systemDefault();if(!zone.equals(ZoneId.of("Asia/Shanghai")))throw new IllegalStateException("Source business timezone must be preserved");
  Instant boundary=Instant.parse("2026-11-03T19:00:00Z");if(!LocalDate.now(Clock.fixed(boundary,zone)).equals(LocalDate.of(2026,11,4)))throw new AssertionError("Business date shifted");
  var result=new TreeMap<String,String>();
  for(String name:List.of("com.aistareco.aep.dap.service.DapTrashCleanupScheduler","com.aistareco.aep.service.DramaProjectTrashCleanupScheduler","com.aistareco.aep.service.DramaShortTrashCleanupScheduler","com.aistareco.aep.service.mixcut.MixcutOutputCleanupScheduler")) {
   for(var method:Class.forName(name,false,Thread.currentThread().getContextClassLoader()).getDeclaredMethods()) {
    Scheduled annotation=method.getAnnotation(Scheduled.class);if(annotation==null||annotation.cron().isEmpty())continue;
    ZoneId effective=annotation.zone().isEmpty()?zone:ZoneId.of(annotation.zone());var next=CronExpression.parse(annotation.cron()).next(boundary.atZone(effective));
    if(next==null||!next.toLocalDate().equals(LocalDate.of(2026,11,4))||next.getHour()!=3)throw new AssertionError("Cleanup schedule shifted");result.put(name,next.toString());
   }
  }
  if(result.size()!=4)throw new AssertionError("Cron coverage changed; review required");System.out.println(new ObjectMapper().writeValueAsString(Map.of("jvm_business_timezone",zone.toString(),"utc_instant_preserved",true,"business_date_boundary_verified",true,"cron_next_runs",result,"schedulers_started",false)));
 }
}
