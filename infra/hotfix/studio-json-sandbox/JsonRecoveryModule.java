package cn.aibuzz.hotfix;

import com.alibaba.jvm.sandbox.api.Information;
import com.alibaba.jvm.sandbox.api.Module;
import com.alibaba.jvm.sandbox.api.ModuleLifecycleAdapter;
import com.alibaba.jvm.sandbox.api.annotation.Command;
import com.alibaba.jvm.sandbox.api.listener.ext.Advice;
import com.alibaba.jvm.sandbox.api.listener.ext.AdviceListener;
import com.alibaba.jvm.sandbox.api.listener.ext.EventWatchBuilder;
import com.alibaba.jvm.sandbox.api.resource.LoadedClassDataSource;
import com.alibaba.jvm.sandbox.api.resource.ModuleEventWatcher;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.annotation.Resource;
import java.io.PrintWriter;
import java.lang.reflect.InvocationTargetException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.concurrent.atomic.AtomicLong;

import static com.alibaba.jvm.sandbox.api.ProcessController.returnImmediately;
import static com.alibaba.jvm.sandbox.api.ProcessController.throwsImmediately;

/** A removable exception-only hook. Never watches the mapper, HTTP client, worker, wallet, or unrelated methods. */
@Information(id = "aep-json-recovery", version = "20261024.1", author = "AiBuzz", isActiveOnLoad = false)
public class JsonRecoveryModule extends ModuleLifecycleAdapter implements Module {
    private static final String TARGET = "com.aistareco.aep.ipstudio.service.ModelJson";
    private static final String FORMAT_MESSAGE = "模型返回的内容格式有误，无法自动恢复；本次未扣积分，请重试或更换模型";
    @Resource private ModuleEventWatcher watcher;
    @Resource private LoadedClassDataSource loaded;
    private final ObjectMapper parser = new ObjectMapper(); // module-local Jackson; never cast an application mapper/node
    private final AtomicLong recovered = new AtomicLong(), rejected = new AtomicLong(), bridgeErrors = new AtomicLong();
    private volatile boolean active;

    @Override public void onLoad() {
        new EventWatchBuilder(watcher).onClass(TARGET).onBehavior("parse")
                .withParameterTypes("com.fasterxml.jackson.databind.ObjectMapper", "java.lang.String")
                .onWatch(new AdviceListener() {
                    @Override protected void afterThrowing(Advice advice) throws Throwable {
                        if (!isJsonFailure(advice.getThrowable())) return;
                        Object result = null;
                        Throwable failure = null;
                        try {
                            String raw = (String) advice.getParameterArray()[1];
                            try {
                                // Generated from the committed production parser by build.py, not a second recovery policy.
                                var normalized = cn.aibuzz.hotfix.json.ModelJson.parse(parser, raw);
                                Object applicationMapper = advice.getParameterArray()[0];
                                result = applicationMapper.getClass().getMethod("readTree", String.class)
                                        .invoke(applicationMapper, normalized.toString());
                            } catch (JsonProcessingException cannotRepair) {
                                ClassLoader loader = advice.getLoader();
                                Class<?> status = Class.forName("org.springframework.http.HttpStatus", false, loader);
                                Class<?> business = Class.forName("com.aistareco.common.BusinessException", false, loader);
                                failure = (Throwable) business.getConstructor(status, String.class, String.class)
                                        .newInstance(status.getField("BAD_GATEWAY").get(null), "AI_BAD_OUTPUT", FORMAT_MESSAGE);
                                failure.initCause(advice.getThrowable());
                            }
                        } catch (Throwable bridgeFailure) {
                            bridgeErrors.incrementAndGet();
                            // Preserve the original failure if classloader bridging fails. Never manufacture a success.
                            System.err.println("[aep-json-recovery] bridge failed: " + bridgeFailure.getClass().getName());
                            return;
                        }
                        // ProcessController throws a control signal; do not catch it in the bridge try/catch above.
                        if (failure != null) { rejected.incrementAndGet(); throwsImmediately(failure); }
                        recovered.incrementAndGet();
                        returnImmediately(result);
                    }
                });
    }

    @Override public void onActive() { active = true; }
    @Override public void onFrozen() { active = false; }

    private static boolean isJsonFailure(Throwable error) {
        for (Class<?> type = error.getClass(); type != null; type = type.getSuperclass())
            if ("com.fasterxml.jackson.core.JsonProcessingException".equals(type.getName())) return true;
        return false;
    }

    private Class<?> target() {
        Class<?> result = null;
        var iterator = loaded.iteratorForLoadedClasses();
        while (iterator.hasNext()) {
            Class<?> type = iterator.next();
            if (!TARGET.equals(type.getName())) continue;
            if (result != null) throw new IllegalStateException("multiple target classloaders");
            result = type;
        }
        if (result == null) throw new IllegalStateException("target class not loaded");
        return result;
    }

    @Command("status") public void status(PrintWriter out) {
        out.printf("active=%s recovered=%d rejected=%d bridgeErrors=%d target=%s loader=%s%n", active,
                recovered.get(), rejected.get(), bridgeErrors.get(), TARGET, target().getClassLoader().getClass().getName());
    }

    /** Fixed synthetic probes only. No accepted paths, arbitrary code, customer data, model calls, or wallet calls. */
    @Command("probe") public void probe(PrintWriter out) throws Exception {
        Class<?> type = target();
        Class<?> mapperType = Class.forName("com.fasterxml.jackson.databind.ObjectMapper", true, type.getClassLoader());
        Object mapper = mapperType.getConstructor().newInstance();
        var parse = type.getMethod("parse", mapperType, String.class);
        String good = "{\"content\":\"合法正文\"}";
        Object goodNode = parse.invoke(null, mapper, good);
        if (!good.equals(goodNode.toString())) throw new IllegalStateException("valid JSON changed");
        String bad = "{\"content\":\"两人相视一笑，没有言语。\\更远处传来孩子们的笑声。\"";
        String expected = "两人相视一笑，没有言语。更远处传来孩子们的笑声。";
        try {
            Object node = parse.invoke(null, mapper, bad);
            Class<?> nodeType = Class.forName("com.fasterxml.jackson.databind.JsonNode", false, type.getClassLoader());
            Object content = nodeType.getMethod("path", String.class).invoke(node, "content");
            String text = (String) nodeType.getMethod("asText").invoke(content);
            if (!expected.equals(text)) throw new IllegalStateException("probe content changed");
            out.printf("valid=PASS repair=PASS sha256=%s%n", HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))));
        } catch (InvocationTargetException error) {
            out.printf("valid=PASS repair=NOT_ACTIVE error=%s%n", error.getCause().getClass().getName());
            return;
        }
        try {
            parse.invoke(null, mapper, "{\"content\":\"半句话");
            throw new IllegalStateException("incomplete content accepted");
        } catch (InvocationTargetException error) {
            Throwable cause = error.getCause();
            if (!"com.aistareco.common.BusinessException".equals(cause.getClass().getName())) throw error;
            if (!"AI_BAD_OUTPUT".equals(cause.getClass().getMethod("getCode").invoke(cause))) throw error;
            out.println("unrecoverable=PASS code=AI_BAD_OUTPUT");
        }
    }
}
