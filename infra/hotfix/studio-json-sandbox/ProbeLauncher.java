import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Path;

/** Separate application classloader: proves module Jackson and application Jackson never cross by a cast. */
public class ProbeLauncher {
    public static void main(String[] args) throws Exception {
        String[] paths = args[0].split(java.io.File.pathSeparator);
        URL[] urls = new URL[paths.length];
        for (int i = 0; i < paths.length; i++) urls[i] = Path.of(paths[i]).toUri().toURL();
        try (var loader = new URLClassLoader(urls, ClassLoader.getPlatformClassLoader())) {
            Thread.currentThread().setContextClassLoader(loader);
            Class.forName("ProbeApp", true, loader).getMethod("main", String[].class).invoke(null, (Object) new String[]{args[1]});
        }
    }
}
