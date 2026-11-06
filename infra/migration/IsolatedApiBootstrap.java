import java.net.*;
import java.nio.file.*;
import java.security.Permission;
import java.util.*;

/** Test-only JDK17 barrier: only the exact rehearsal RDS and Tair may receive outbound connections. */
@SuppressWarnings("removal")
public class IsolatedApiBootstrap {
    public static void main(String[] args)throws Exception {
        String host="pgm-bp1gp4819mbs30z3.pg.rds.aliyuncs.com";
        String url=System.getenv("DB_URL");
        if(args.length!=0||url==null||!url.startsWith("jdbc:postgresql://"+host+":5432/aistar_schema_rehearsal?")||!url.contains("currentSchema=aistar_api_rehearsal")||!"false".equals(System.getenv("AEP_BACKGROUND_ENABLED"))||!"postgres".equals(System.getenv("SPRING_PROFILES_ACTIVE"))||!"127.0.0.1".equals(System.getenv("SERVER_ADDRESS")))throw new IllegalStateException("Only the isolated API lab is permitted");
        Set<String> allowed=new HashSet<>();allowed.add(host);for(var a:InetAddress.getAllByName(host))allowed.add(a.getHostAddress());
        String redisHost="r-bp182e1w8fk05cnbvr.redis.rds.aliyuncs.com";
        var redis=URI.create(System.getenv("AEP_SMS_TAIR_URL"));
        if(!"rediss".equals(redis.getScheme())||!redisHost.equals(redis.getHost())||!"/14".equals(redis.getPath())||!"aistar:rehearsal:sms:v1:".equals(System.getenv("AEP_SMS_TAIR_PREFIX")))throw new IllegalStateException("Only isolated Tair state is permitted");
        Set<String> redisAllowed=new HashSet<>();redisAllowed.add(redisHost);for(var a:InetAddress.getAllByName(redisHost))redisAllowed.add(a.getHostAddress());
        System.setProperty("io.netty.transport.noNative","true");System.setProperty("reactor.netty.native","false");
        System.setSecurityManager(new SecurityManager() {
            @Override public void checkPermission(Permission permission) {
                if(permission.getName().equals("setSecurityManager"))throw new SecurityException("Rehearsal barrier cannot be removed");
            }
            @Override public void checkConnect(String remote,int port) {
                if(port==-1)return;
                if(port==5432&&allowed.contains(remote))return;
                if(port==6379&&redisAllowed.contains(remote))return;
                throw new SecurityException("External connections disabled in isolated API rehearsal");
            }
            @Override public void checkConnect(String remote,int port,Object context) { checkConnect(remote,port); }
            @Override public void checkExec(String command) { throw new SecurityException("Child processes disabled in isolated API rehearsal"); }
            @Override public void checkListen(int port) { if(port!=18084)throw new SecurityException("Only lab port accepted"); }
        });
        try {new Socket("1.1.1.1",443).close();throw new IllegalStateException("Outbound barrier ineffective");}catch(SecurityException expected) { }
        Files.writeString(Path.of("/opt/aistar-migration/preparation/outbound-barrier.json"),"{\"outbound_rds_and_isolated_tair_only\":true,\"child_processes_disabled\":true,\"native_netty_disabled\":true}");
        Class.forName("com.aistareco.AiStarEcoApplication").getMethod("main",String[].class).invoke(null,(Object)new String[0]);
    }
}
