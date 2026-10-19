/**
 * Отображение счёта: маскирование «••••-иис» и человекочитаемые названия.
 * Реальный номер счёта клиент не знает (ядро отдаёт только маску из 4 цифр,
 * BCS-SPEC §3.1) — тип счёта приходит отдельным полем.
 */

export function maskAccountDisplay(maskedId: string, type: "broker" | "iis" | "margin"): string {
  const digits = maskedId.replace(/[^0-9]/g, "");
  const suffix = digits ? `••••-${digits}` : maskedId || "••••";
  switch (type) {
    case "iis":
      return `${suffix}-иис`;
    case "margin":
      return `${suffix} · марж.`;
    default:
      return suffix;
  }
}
