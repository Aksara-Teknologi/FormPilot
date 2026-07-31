const ALLOWED_APP_ORIGINS = new Set([
  "https://form-pilot.aksarateknologi.com",
  "http://localhost:3000",
]);

window.addEventListener("message", (event) => {
  if (event.source !== window || !ALLOWED_APP_ORIGINS.has(event.origin)) return;
  const message = event.data;
  if (!message || message.source !== "formpilot-web" || typeof message.requestId !== "string") return;
  if (!["STATUS", "INSPECT", "FILL", "WORKFLOW"].includes(message.type)) return;

  chrome.runtime.sendMessage({
    source: "formpilot-content",
    requestId: message.requestId,
    type: message.type,
    payload: message.payload ?? {},
  }, (response) => {
    const runtimeError = chrome.runtime.lastError;
    window.postMessage({
      source: "formpilot-extension",
      requestId: message.requestId,
      response: runtimeError ? { ok: false, error: runtimeError.message } : response,
    }, event.origin);
  });
});

window.postMessage({ source: "formpilot-extension", type: "READY" }, window.location.origin);
