import java.nio.file.*;import java.net.URI;import com.fasterxml.jackson.databind.*;import com.aistareco.aep.service.sms.*;import com.aistareco.common.BusinessException;
/** Independent A/B JVMs, synthetic challenge only; no SMS sender or production namespace. */
public class AistarTairRehearsal {
 public static void main(String[] args)throws Exception {
  if(args.length!=1||!java.util.Set.of("reserve","verify","replay").contains(args[0]))throw new IllegalArgumentException("Fixed rehearsal action required");
  Path root=Path.of("/opt/aistar-migration/preparation");var j=new ObjectMapper();var env=j.readTree(Files.readString(root.resolve("api-environment-private.json")));String url=env.get("AEP_SMS_TAIR_URL").asText();var uri=URI.create(url);if(!"rediss".equals(uri.getScheme())||!"r-bp182e1w8fk05cnbvr.redis.rds.aliyuncs.com".equals(uri.getHost())||!"/14".equals(uri.getPath())||!uri.getUserInfo().startsWith("aistar_rehearsal:"))throw new IllegalStateException("Only isolated Tair is allowed");String prefix="aistar:rehearsal:sms:v1:";
  var input=j.readTree(System.in);String phone=input.get("phone").asText(),code=input.get("code").asText();if(!phone.matches("199[0-9]{8}")||!code.matches("[0-9]{6}"))throw new IllegalArgumentException("Synthetic data required");
  try(var store=new TairSmsCodeStore(url,prefix,env.get("AEP_SECRET_KEY").asText())) {
   if(args[0].equals("reserve")){var reservation=store.reserve(phone,SmsCodePurpose.LOGIN,code,300,60);store.complete(reservation);}
   else if(args[0].equals("verify"))store.verify(phone,code,SmsCodePurpose.LOGIN,300,5,1800);
   else {try{store.verify(phone,code,SmsCodePurpose.LOGIN,300,5,1800);throw new AssertionError("Replay accepted");}catch(BusinessException e){if(!"SMS_CODE_NOT_REQUESTED".equals(e.getCode()))throw e;}}
   System.out.println("{\"passed\":true,\"tls_verified\":true,\"synthetic_only\":true,\"sms_provider_called\":false}");
  }
 }
}
