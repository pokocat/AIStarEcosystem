package com.aistareco.ops;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;

/** Counts the entire async request lifetime, including SSE completion. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE+20)
public class DeploymentRequestFilter extends OncePerRequestFilter {
    private final DeploymentRuntime runtime;
    public DeploymentRequestFilter(DeploymentRuntime runtime){this.runtime=runtime;}
    @Override protected boolean shouldNotFilter(HttpServletRequest request){return request.getRequestURI().startsWith("/internal/");}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException {
        runtime.entered();AtomicBoolean released=new AtomicBoolean();Runnable release=()->{if(released.compareAndSet(false,true))runtime.exited();};
        try{chain.doFilter(request,response);}finally{
            if(request.isAsyncStarted())try{
                request.getAsyncContext().addListener(new AsyncListener(){
                    public void onComplete(AsyncEvent event){release.run();}
                    public void onTimeout(AsyncEvent event){release.run();}
                    public void onError(AsyncEvent event){release.run();}
                    public void onStartAsync(AsyncEvent event){event.getAsyncContext().addListener(this);}
                });
            }catch(IllegalStateException alreadyComplete){release.run();}
            else release.run();
        }
    }
}
