package ru.kis.core.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** Модели единого внутреннего контракта брокер-адаптеров (contracts/broker-api). */
public final class UnifiedModels {
    private UnifiedModels() {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UnifiedPortfolio(String broker, String asOf, List<Account> accounts,
                                   List<Position> positions, String rotatedRefreshToken) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Account(String id, String type, String currency, double cash, double lockedCash) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Position(
            String instrumentId, String ticker, String displayName, double quantity,
            Double avgPrice, double price, String currency, double marketValue,
            Double marketValueRub, Double unrealizedPL, Double unrealizedPercentPL,
            Double dailyPL, Double dailyPercentPL, Double portfolioShare, String logoLink) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record BrokerMeta(String code, String name, List<String> features) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RefreshCheckResult(boolean valid, String newRefreshToken, long expiresIn) {}

    public record UnifiedError(String code, String message, Object details) {}
}
