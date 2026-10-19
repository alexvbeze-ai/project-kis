package ru.kis.core.brokers;

import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import ru.kis.core.domain.UnifiedModels.BrokerMeta;
import ru.kis.core.domain.UnifiedModels.RefreshCheckResult;
import ru.kis.core.domain.UnifiedModels.UnifiedPortfolio;

/**
 * Клиент единого broker-api контракта. Forward-модель MVP: refresh-токен
 * приходит от клиента (заголовок X-Broker-Token) и пересылается адаптеру как
 * X-Broker-Refresh-Token. Ядро токены НЕ хранит.
 */
@Component
public class BrokerClient {

    public static final String REFRESH_HEADER = "X-Broker-Refresh-Token";

    private final RestClient restClient;

    public BrokerClient(RestClient restClient) {
        this.restClient = restClient;
    }

    public UnifiedPortfolio portfolio(String baseUrl, String refreshToken) {
        try {
            return restClient.get()
                    .uri(baseUrl + "/v1/portfolio")
                    .header(REFRESH_HEADER, refreshToken)
                    .retrieve()
                    .body(UnifiedPortfolio.class);
        } catch (RestClientException e) {
            throw new BrokerUpstreamException("PORTFOLIO_FETCH_FAILED", e.getMessage(), e);
        }
    }

    public RefreshCheckResult validateRefresh(String baseUrl, String refreshToken) {
        try {
            return restClient.post()
                    .uri(baseUrl + "/v1/auth/refresh-token")
                    .header(REFRESH_HEADER, refreshToken)
                    .retrieve()
                    .body(RefreshCheckResult.class);
        } catch (RestClientException e) {
            throw new BrokerUpstreamException("REFRESH_INVALID", e.getMessage(), e);
        }
    }

    public BrokerMeta meta(String baseUrl) {
        try {
            return restClient.get().uri(baseUrl + "/v1/broker").retrieve().body(BrokerMeta.class);
        } catch (RestClientException e) {
            throw new BrokerUpstreamException("META_FETCH_FAILED", e.getMessage(), e);
        }
    }

    public boolean healthy(String baseUrl) {
        try {
            restClient.get().uri(baseUrl + "/v1/health")
                    .headers(h -> h.put(HttpHeaders.ACCEPT, java.util.List.of("application/json")))
                    .retrieve().toBodilessEntity();
            return true;
        } catch (RestClientException e) {
            return false;
        }
    }

    public static class BrokerUpstreamException extends RuntimeException {
        private final String kind;
        public BrokerUpstreamException(String kind, String message, Throwable cause) {
            super(message, cause);
            this.kind = kind;
        }
        public String getKind() { return kind; }
    }
}
