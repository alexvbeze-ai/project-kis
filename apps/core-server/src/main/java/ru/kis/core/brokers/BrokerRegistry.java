package ru.kis.core.brokers;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Реестр подключённых брокерских адаптеров (MVP: YAML-конфиг, future: dynamic). */
@ConfigurationProperties(prefix = "kis")
public class BrokerRegistry {
    private List<BrokerEndpoint> brokers = List.of();

    public List<BrokerEndpoint> getBrokers() { return brokers; }
    public void setBrokers(List<BrokerEndpoint> brokers) { this.brokers = brokers; }

    public static class BrokerEndpoint {
        private String code;      // bcs | tbank | ...
        private String baseUrl;   // http://bcs-server:8081
        private boolean enabled = true;

        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
    }
}
