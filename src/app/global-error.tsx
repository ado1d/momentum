"use client";

// Last-resort error boundary — replaces the ROOT layout entirely, so it
// must render its own <html>/<body> and cannot rely on Tailwind/globals
// having loaded (the crash may have happened before CSS applied). Uses
// inline styles only. If this renders, the route-level error.tsx already
// failed to catch the exception; the user gets a clean recovery screen
// instead of the browser's unstyled Next.js crash page.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#fafaf9",
          color: "#1c1917",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: "420px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              backgroundColor: "#fef3c7",
            }}
            aria-hidden="true"
          >
            ⚠️
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: "#57534e" }}>
            Momentum hit an unexpected error and had to stop this screen. Your
            data is safe — recent changes are saved on this device and will sync
            when you reload.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                height: "44px",
                padding: "0 20px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: "#059669",
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                height: "44px",
                padding: "0 20px",
                borderRadius: "12px",
                border: "1px solid #d6d3d1",
                backgroundColor: "white",
                color: "#1c1917",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload app
            </button>
          </div>
          {error.digest ? (
            <p style={{ margin: 0, fontSize: "12px", color: "#a8a29e" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
