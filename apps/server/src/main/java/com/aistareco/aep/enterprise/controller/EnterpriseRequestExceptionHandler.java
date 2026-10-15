package com.aistareco.aep.enterprise.controller;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/** Integral financial inputs must fail as a client error instead of reaching the generic 500 handler. */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes={EnterprisePointsController.class,EnterpriseRechargeController.class,AdminEnterpriseRechargeController.class})
public class EnterpriseRequestExceptionHandler {
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String,Object>> invalidJson(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest().body(Map.of("success",false,"error",Map.of("code","ENTERPRISE_REQUEST_INVALID","message","请求格式有误，金额和积分请填写整数")));
    }
}
