# Billing PDF

Saved FA017 and FA018 records expose a direct `ดาวน์โหลด PDF` action. The server opens the saved form in a headless Chromium-compatible browser and prints the existing `.paper` layout to PDF; the browser `พิมพ์ / PDF` action remains the fallback.

## Runtime requirement

The server must have Google Chrome, Microsoft Edge, or Chromium installed. Detection checks common Windows and Linux locations. For a non-standard installation, set:

```text
PDF_CHROMIUM_EXECUTABLE_PATH=C:\path\to\chrome.exe
```

The PDF browser calls the application through `http://127.0.0.1:$PORT` by default. If the application is reachable internally at another origin, set:

```text
PDF_BASE_URL=http://expense-billing-app:3000
```

Both values are server-only. Do not expose them with a `NEXT_PUBLIC_` prefix.

## Acceptance checks

Verify both FA017 landscape and FA018 portrait with short values, long wrapped values, many rows, and multiple pages. Compare the downloaded pages with the current approved on-screen form at the same saved revision. Text must remain selectable, font size and grid geometry must remain unchanged, and no toolbar or editing controls may appear.

