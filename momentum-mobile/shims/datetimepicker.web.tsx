// WEB TEST SHIM — datetimepicker: native HTML date/time input.
import React from "react";

export default function DateTimePicker({
  value,
  mode = "date",
  onChange,
  is24Hour,
  ...rest
}: {
  value: Date;
  mode?: "date" | "time" | "datetime";
  onChange: (event: unknown, date?: Date) => void;
  is24Hour?: boolean;
  [key: string]: unknown;
}) {
  const toInput = (d: Date): string => {
    const p = (n: number) => String(n).padStart(2, "0");
    if (mode === "time") return `${p(d.getHours())}:${p(d.getMinutes())}`;
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  return (
    <input
      {...(rest as object)}
      type={mode === "time" ? "time" : "date"}
      value={toInput(value)}
      style={{
        fontSize: 15,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(128,140,170,0.35)",
        background: "rgba(128,140,170,0.12)",
        color: "inherit",
        margin: "4px 0 8px",
      }}
      onChange={(e) => {
        const v = (e.target as HTMLInputElement).value;
        if (!v) return;
        const d = mode === "time" ? new Date(value) : new Date();
        if (mode === "time") {
          const [h, m] = v.split(":").map(Number);
          d.setHours(h, m, 0, 0);
        } else {
          const [y, mo, da] = v.split("-").map(Number);
          d.setFullYear(y, mo - 1, da);
          d.setHours(value.getHours(), value.getMinutes(), 0, 0);
        }
        onChange({}, d);
      }}
    />
  );
}
