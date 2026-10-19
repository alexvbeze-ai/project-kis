package ru.kis.core.brokers;

import java.net.URI;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
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
        return call(HttpMethod.GET, URI.create(baseUrl + "/v1/portfolio"), refreshToken,
                UnifiedPortfolio.class, "PORTFOLIO_FETCH_FAILED");
    }

    public RefreshCheckResult validateRefresh(String baseUrl, String refreshToken) {
        return call(HttpMethod.POST, URI.create(baseUrl + "/v1/auth/refresh-token"), refreshToken,
                RefreshCheckResult.class, "REFRESH_INVALID");
    }

    /**
     * Выполняет запрос к адаптеру и ТРАНСЛИРУЕТ его контрактные ошибки
     * (contracts/broker-api: UnifiedError 401/429/502), а не превращает всё в
     * единую транспортную заглушку. Без этого реальная причина (например,
     * невалидный refresh-токен -> 401 UPSTREAM_UNAUTHORIZED от bcs-server)
     * терялась за кодом PORTFOLIO_FETCH_FAILED / HTTP 502.
     */
    private <T> T call(HttpMethod method, URI uri, String refreshToken,
                       Class<T> responseType, String transportFailureKind) {
        try {
            return restClient.method(method)
                    .uri(uri)
                    .header(REFRESH_HEADER, refreshToken)
                    .retrieve()
                    .body(responseType);
        } catch (RestClientResponseException e) {
            throw toUpstream(e, transportFailureKind);
        } catch (RestClientException e) {
            // сетевые сбои, таймауты, битый JSON — транспортная ошибка
            throw new BrokerUpstreamException(transportFailureKind, 502, e.getMessage(), e);
        }
    }

    private BrokerUpstreamException toUpstream(RestClientResponseException e, String transportFailureKind) {
        HttpStatusCode status = e.getStatusCode();
        if (status.value() == 401) {
            return new BrokerUpstreamException("UPSTREAM_UNAUTHORIZED", 401,
                    extractErrorMessage(e.getResponseBodyAsString(), "Refresh-токен недействителен или истёк"), e);
        }
        if (status.value() == 429) {
            return new BrokerUpstreamException("UPSTREAM_RATE_LIMIT", 429,
                    extractErrorMessage(e.getResponseBodyAsString(), "Брокерский API: слишком много запросов"), e);
        }
        if (status.isError()) {
            return new BrokerUpstreamException("UPSTREAM_UNAVAILABLE", 502,
                    extractErrorMessage(e.getResponseBodyAsString(), "Адаптер вернул HTTP " + status.value()), e);
        }
        return new BrokerUpstreamException(transportFailureKind, 502, e.getMessage(), e);
    }

    /** Достаёт code/message из UnifiedError-тела ответа адаптера, если оно JSON. */
    private static String extractErrorMessage(String body, String fallback) {
        if (body == null || body.isBlank()) return fallback;
        try {
            var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(body);
            String code = node.path("code").asText("");
            String message = node.path("message").asText("");
            if (!message.isBlank()) {
                return code.isBlank() ? message : "[" + code + "] " + message;
            }
        } catch (Exception ignored) {
            // не JSON — используем fallback
        }
        return fallback;
    }

    public BrokerMeta meta(String baseUrl) {
        try {
            return restClient.get().uri(baseUrl + "/v1/broker").retrieve().body(BrokerMeta.class);
        } catch (RestClientException e) {
            throw new BrokerUpstreamException("META_FETCH_FAILED", 502, e.getMessage(), e);
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

    /**
     * Ошибка апстрима адаптера. kind — контрактный код UnifiedError
     * (UPSTREAM_UNAUTHORIZED / UPSTREAM_RATE_LIMIT / UPSTREAM_UNAVAILABLE) либо
     * транспортная заглушка (PORTFOLIO_FETCH_FAILED и т.п.); httpStatus — код,
     * который ядро отдаёт клиенту.
     */
    public static class BrokerUpstreamException extends RuntimeException {
        private final String kind;
        private final int httpStatus;
        public BrokerUpstreamException(String kind, int httpStatus, String message, Throwable cause) {
            super(message, cause);
            this.kind = kind;
            this.httpStatus = httpStatus;
        }
        public String getKind() { return kind; }
        public int getHttpStatus() { return httpStatus; }
    }
}
