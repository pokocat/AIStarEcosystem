package com.aistareco.aep.service;

import com.aistareco.aep.dto.PlanDto;
import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.model.Plan;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.repository.PlanRepository;
import com.aistareco.aep.repository.ProductRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProductService {

    private final ProductRepository productRepo;
    private final PlanRepository planRepo;

    public ProductService(ProductRepository productRepo, PlanRepository planRepo) {
        this.productRepo = productRepo;
        this.planRepo = planRepo;
    }

    // --- Products ---

    public List<ProductDto> listProducts() {
        return productRepo.findAll().stream()
                .map(ProductDto::from)
                .collect(Collectors.toList());
    }

    public ProductDto findProductById(String id) {
        return productRepo.findById(id)
                .map(ProductDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found: " + id));
    }

    public ProductDto createProduct(Map<String, Object> body) {
        Product product = Product.builder()
                .id(UUID.randomUUID().toString())
                .code(getString(body, "code"))
                .name(getString(body, "name"))
                .description(getString(body, "description"))
                .enabled(getBoolean(body, "enabled", true))
                .createdAt(Instant.now())
                .build();
        return ProductDto.from(productRepo.save(product));
    }

    public ProductDto updateProduct(String id, Map<String, Object> body) {
        Product product = productRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found: " + id));
        if (body.containsKey("name")) product.setName(getString(body, "name"));
        if (body.containsKey("description")) product.setDescription(getString(body, "description"));
        if (body.containsKey("enabled")) product.setEnabled(getBoolean(body, "enabled", product.isEnabled()));
        return ProductDto.from(productRepo.save(product));
    }

    // --- Plans ---

    public Page<PlanDto> listPlans(String productId, Pageable pageable) {
        if (productId != null && !productId.isBlank()) {
            return planRepo.findByProductId(productId, pageable).map(PlanDto::from);
        }
        return planRepo.findAll(pageable).map(PlanDto::from);
    }

    public PlanDto createPlan(Map<String, Object> body) {
        Plan plan = Plan.builder()
                .id(UUID.randomUUID().toString())
                .productId(getString(body, "productId"))
                .code(getString(body, "code"))
                .name(getString(body, "name"))
                .monthlyPriceCents(getLong(body, "monthlyPriceCents", 0L))
                .annualPriceCents(getLong(body, "annualPriceCents", 0L))
                .enabled(getBoolean(body, "enabled", true))
                .createdAt(Instant.now())
                .build();
        return PlanDto.from(planRepo.save(plan));
    }

    public PlanDto updatePlan(String id, Map<String, Object> body) {
        Plan plan = planRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plan not found: " + id));
        if (body.containsKey("name")) plan.setName(getString(body, "name"));
        if (body.containsKey("monthlyPriceCents")) plan.setMonthlyPriceCents(getLong(body, "monthlyPriceCents", plan.getMonthlyPriceCents()));
        if (body.containsKey("annualPriceCents")) plan.setAnnualPriceCents(getLong(body, "annualPriceCents", plan.getAnnualPriceCents()));
        if (body.containsKey("enabled")) plan.setEnabled(getBoolean(body, "enabled", plan.isEnabled()));
        return PlanDto.from(planRepo.save(plan));
    }

    // --- helpers ---

    private String getString(Map<String, Object> body, String key) {
        Object val = body.get(key);
        return val != null ? val.toString() : null;
    }

    private long getLong(Map<String, Object> body, String key, long defaultVal) {
        Object val = body.get(key);
        if (val == null) return defaultVal;
        if (val instanceof Number n) return n.longValue();
        return Long.parseLong(val.toString());
    }

    private boolean getBoolean(Map<String, Object> body, String key, boolean defaultVal) {
        Object val = body.get(key);
        if (val == null) return defaultVal;
        if (val instanceof Boolean b) return b;
        return Boolean.parseBoolean(val.toString());
    }
}
