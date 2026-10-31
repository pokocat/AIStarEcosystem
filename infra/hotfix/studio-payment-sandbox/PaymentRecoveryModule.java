package cn.aibuzz.hotfix;

import com.alibaba.jvm.sandbox.api.Information;
import com.alibaba.jvm.sandbox.api.Module;
import com.alibaba.jvm.sandbox.api.ModuleLifecycleAdapter;
import com.alibaba.jvm.sandbox.api.annotation.Command;
import com.alibaba.jvm.sandbox.api.listener.ext.Advice;
import com.alibaba.jvm.sandbox.api.listener.ext.AdviceListener;
import com.alibaba.jvm.sandbox.api.listener.ext.EventWatchBuilder;
import com.alibaba.jvm.sandbox.api.resource.ModuleEventWatcher;
import com.alibaba.jvm.sandbox.api.resource.LoadedClassDataSource;
import javax.annotation.Resource;
import java.io.PrintWriter;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import static com.alibaba.jvm.sandbox.api.ProcessController.returnImmediately;
import static com.alibaba.jvm.sandbox.api.ProcessController.throwsImmediately;

/** Replace only the executor's private submit boundary, preserving its native submission and lease transaction. */
@Information(id="aep-payment-recovery",version="20261025.2",author="AiBuzz",isActiveOnLoad=false)
public class PaymentRecoveryModule extends ModuleLifecycleAdapter implements Module {
    private static final String EXECUTOR="com.aistareco.aep.ipstudio.execution.StudioPlanExecutor";
    @Resource private ModuleEventWatcher watcher;
    @Resource private LoadedClassDataSource loaded;
    private final AtomicLong rejected=new AtomicLong(),bridged=new AtomicLong(),unknown=new AtomicLong(),bridgeErrors=new AtomicLong();
    private volatile boolean active;
    private String targetHash;
    private record Failure(String code,String message) {}
    @Override public void onLoad() {
        try {
            var properties=new Properties();
            try(var in=getClass().getResourceAsStream("/META-INF/aep-payment-target.properties")){properties.load(in);}
            Class<?> target=null;var classes=loaded.iteratorForLoadedClasses();
            while(classes.hasNext()){Class<?> type=classes.next();if(EXECUTOR.equals(type.getName())){
                if(target!=null)throw new IllegalStateException("multiple executor classloaders");target=type;
            }}
            if(target==null)throw new IllegalStateException("executor not loaded");
            try(var in=target.getResourceAsStream("/"+EXECUTOR.replace('.','/')+".class")){
                targetHash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(in.readAllBytes()));
            }
            if(!targetHash.equals(properties.getProperty("sha256")))throw new IllegalStateException("executor class hash mismatch");
        }catch(Exception error){throw new IllegalStateException("Payment hotfix target verification failed",error);}
        new EventWatchBuilder(watcher).onClass(EXECUTOR).onBehavior("submit")
                .withParameterTypes("java.lang.String","java.lang.String","long",EXECUTOR+"$Submission")
                .onWatch(new AdviceListener() {
                    @Override protected void before(Advice a) throws Throwable {
                        Object result=null;Throwable error=null;
                        try {result=submit(a.getTarget(),a.getParameterArray());bridged.incrementAndGet();}
                        catch(Throwable failure){bridgeErrors.incrementAndGet();error=new IllegalStateException("Studio payment hotfix bridge failed; recover by persisted request identity",unwrap(failure));}
                        // Never execute the original submit again after invoking the native service, even on a bridge failure.
                        if(error!=null) {throwsImmediately(error);return;}
                        returnImmediately(result);
                    }
                });
    }
    private boolean submit(Object executor,Object[] args) throws Throwable {
        String id=(String)args[0],owner=(String)args[1];long version=(Long)args[2];Object submission=args[3];
        String runId=null;Failure failure=null;
        try {
            Object dto=call(field(executor,"workflow"),"submit",new Class<?>[]{String.class,String.class,call(submission,"request").getClass()},
                    call(submission,"userId"),call(submission,"projectId"),call(submission,"request"));
            runId=(String)call(dto,"id");
        } catch(Throwable caught) {
            Throwable error=unwrap(caught);
            if(is(error,"com.aistareco.common.BusinessException"))failure=new Failure((String)call(error,"getCode"),error.getMessage());
            else if(is(error,"org.springframework.web.server.ResponseStatusException")&&((Number)call(call(error,"getStatusCode"),"value")).intValue()==402) {
                failure=new Failure(cn.aibuzz.hotfix.payment.StudioPaymentMessage.CODE,
                        cn.aibuzz.hotfix.payment.StudioPaymentMessage.message((String)call(error,"getReason")));rejected.incrementAndGet();
            } else if(error instanceof RuntimeException) {
                unknown.incrementAndGet();
                System.err.printf("[aep-payment-recovery] submit outcome unknown execution=%s step=%s request=%s error=%s%n",
                        id,call(submission,"stepId"),call(submission,"clientRequestId"),error.getClass().getName());
                return false;
            } else throw error;
        }
        final String accepted=runId;final Failure refusal=failure;
        Object repository=field(executor,"executions"),mapper=field(executor,"mapper");
        List<Object> pending=new ArrayList<>();
        ClassLoader loader=executor.getClass().getClassLoader();
        Class<?> callback=Class.forName("org.springframework.transaction.support.TransactionCallback",false,loader);
        Object action=Proxy.newProxyInstance(loader,new Class<?>[]{callback},(proxy,method,p)->{
            if(!method.getName().equals("doInTransaction"))throw new UnsupportedOperationException(method.getName());
            Object e=((Optional<?>)call(repository,"lockById",new Class<?>[]{String.class},id)).orElse(null);
            if(e==null||!owner.equals(call(e,"getLeaseOwner"))||version!=((Number)call(e,"getLeaseVersion")).longValue())return false;
            Object state=call(mapper,"readTree",new Class<?>[]{String.class},call(e,"getStepsJson"));
            Object step=null;
            for(Object s:(Iterable<?>)path(state,"steps"))
                if(call(submission,"stepId").equals(text(path(s,"id")))&&call(submission,"stage").equals(text(path(s,"stage")))){step=s;break;}
            if(step==null)return false;
            if(accepted!=null)method(executor.getClass(),"attach",2).invoke(executor,step,accepted);
            else {
                put(step,"status","needs_user");put(step,"reason",refusal.message());
                call(step,"remove",new Class<?>[]{String.class},"pendingRequestId");
                if(refusal.code()!=null)put(step,"errorCode",refusal.code());
                call(e,"setStatus",new Class<?>[]{String.class},"needs_user");
                put(state,"needsUserReason","「"+text(path(step,"title"))+"」没有提交："+refusal.message());
            }
            Object budget=call(mapper,"readTree",new Class<?>[]{String.class},call(e,"getBudgetJson"));
            // Original refresh retains all other accepted work, inside the original rejection transaction.
            if(refusal!=null)method(executor.getClass(),"refresh",4).invoke(executor,e,state,budget,pending);
            method(executor.getClass(),"save",3).invoke(executor,e,state,budget);
            return accepted!=null;
        });
        Object kept=call(field(executor,"tx"),"execute",new Class<?>[]{callback},action);
        method(executor.getClass(),"publish",2).invoke(executor,id,pending); // only after original transaction committed
        return Boolean.TRUE.equals(kept);
    }
    private static Object path(Object node,String key) throws Throwable{return call(node,"path",new Class<?>[]{String.class},key);}
    private static String text(Object node) throws Throwable{return (String)call(node,"asText");}
    private static void put(Object node,String key,String value) throws Throwable{call(node,"put",new Class<?>[]{String.class,String.class},key,value);}
    private static Object call(Object target,String name) throws Throwable{return call(target,name,new Class<?>[0]);}
    private static Object call(Object target,String name,Class<?>[] types,Object... args) throws Throwable {
        Method m=target.getClass().getMethod(name,types);m.setAccessible(true);
        try{return m.invoke(target,args);}catch(InvocationTargetException e){throw e.getCause();}
    }
    private static Object field(Object target,String name) throws Exception {
        for(Class<?> type=target.getClass();type!=null;type=type.getSuperclass())try{
            Field f=type.getDeclaredField(name);f.setAccessible(true);return f.get(target);
        }catch(NoSuchFieldException ignored){}
        throw new NoSuchFieldException(name);
    }
    private static Method method(Class<?> type,String name,int count) throws NoSuchMethodException {
        for(Class<?> t=type;t!=null;t=t.getSuperclass())for(Method m:t.getDeclaredMethods())
            if(m.getName().equals(name)&&m.getParameterCount()==count){m.setAccessible(true);return m;}
        throw new NoSuchMethodException(name);
    }
    private static Throwable unwrap(Throwable error){while(error instanceof InvocationTargetException&&error.getCause()!=null)error=error.getCause();return error;}
    private static boolean is(Throwable error,String name){for(Class<?> t=error.getClass();t!=null;t=t.getSuperclass())if(name.equals(t.getName()))return true;return false;}
    @Override public void onActive(){active=true;}
    @Override public void onFrozen(){active=false;}
    @Command("status") public void status(PrintWriter out){out.printf("active=%s bridged=%d rejected=%d unknown=%d bridgeErrors=%d scope=StudioPlanExecutor.submit targetSha256=%s%n",active,bridged.get(),rejected.get(),unknown.get(),bridgeErrors.get(),targetHash);}
}
