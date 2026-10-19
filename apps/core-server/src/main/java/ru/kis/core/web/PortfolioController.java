package ru.kis.core.web;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.kis.core.brokers.BrokerClient;
import ru.kis.core.brokers.BrokerRegistry;
import ru.kis.core.domain.UnifiedModels.UnifiedError;
import ru.kis.core.domain.UnifiedModels.UnifiedPortfolio;

/**
 * Публичный API ядра для веб-клиента (contracts/core-api).
 * Клиент не знает о брокерах: POST /api/v1/portfolio { broker, refreshToken } ->
 * ядро маршрутизирует запрос нужному адаптеру. MVP — синхронный forward одного
 * брокера; агрегация всех брокеров — v0.4.
 */
@RestController
@RequestMapping("/api/v1")
public class PortfolioController {

    /** Заголовок, в котором клиент может прислать токен вместо тела (опционально). */
    public static final String CLIENT_TOKEN_HEADER = "X-Broker-Token";

    private final BrokerClient brokerClient;
    private final BrokerRegistry registry;

    public PortfolioController(BrokerClient brokerClient, BrokerRegistry registry) {
        this.brokerClient = brokerClient;
        this.registry = registry;
    }

    public record PortfolioRequest(String broker, String refreshToken) {}

    @PostMapping("/portfolio")
    public ResponseEntity<?> portfolio(@RequestBody PortfolioRequest req,
                                       @RequestHeader(value = CLIENT_TOKEN_HEADER, required = false) String headerToken) {
        String brokerCode = req.broker() == null || req.broker().isBlank() ? "bcs" : req.broker();
        String token = req.refreshToken() != null && !req.refreshToken().isBlank()
                ? req.refreshToken() : headerToken;
        if (token == null || token.isBlank()) {
            return ResponseEntity.status(401).body(new UnifiedError(
                    "UPSTREAM_UNAUTHORIZED", "Не передан refresh-токен брокера", null));
        }
        var endpoint = findBroker(brokerCode);
        if (endpoint == null) {
            return ResponseEntity.status(404).body(new UnifiedError("INTERNAL", "Брокер '" + brokerCode + "' не подключён", null));
        }
        try {
            UnifiedPortfolio p = brokerClient.portfolio(endpoint.getBaseUrl(), token);
            String rotated = p.rotatedRefreshToken();
            ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
            if (rotated != null && !rotated.isBlank()) {
                builder = builder.header("X-Rotated-Refresh-Token", rotated);
            }
            return builder.body(p);
        } catch (BrokerClient.BrokerUpstreamException e) {
            String kind = e.getKind();
            boolean unauthorized = kind.contains("401") || "REFRESH_INVALID".equals(kind);
            return ResponseEntity.status(unauthorized ? 401 : 502).body(new UnifiedError(
                    unauthorized ? "UPSTREAM_UNAUTHORIZED" : "UPSTREAM_UNAVAILABLE",
                    "Брокер вернул ошибку: " + kind, null));
        }
    }

    private BrokerRegistry.BrokerEndpoint findBroker(String code) {
        return registry.getBrokers().stream()
                .filter(b -> b.getCode().equalsIgnoreCase(code) && b.isEnabled())
                .findFirst().orElse(null);
    }
}
