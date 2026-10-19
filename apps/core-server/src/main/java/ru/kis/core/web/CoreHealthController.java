package ru.kis.core.web;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.kis.core.brokers.BrokerClient;
import ru.kis.core.brokers.BrokerRegistry;

@RestController
@RequestMapping("/api/v1")
public class CoreHealthController {

    private final BrokerClient brokerClient;
    private final BrokerRegistry registry;

    public CoreHealthController(BrokerClient brokerClient, BrokerRegistry registry) {
        this.brokerClient = brokerClient;
        this.registry = registry;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> brokers = new LinkedHashMap<>();
        for (var b : registry.getBrokers()) {
            brokers.put(b.getCode(), b.isEnabled() ? (brokerClient.healthy(b.getBaseUrl()) ? "up" : "down") : "disabled");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", "ok");
        out.put("service", "core-server");
        out.put("brokers", brokers);
        return out;
    }
}
