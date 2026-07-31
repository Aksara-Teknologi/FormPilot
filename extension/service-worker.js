const APP_ORIGINS = new Set([
  "https://form-pilot.aksarateknologi.com",
  "http://localhost:3000",
]);
const SENSITIVE_PATTERN = /password|passcode|pin|otp|captcha|secret|token|cvv|cvc/i;

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#217346" });
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id || !tab.url) return;
  try {
    const url = new URL(tab.url);
    if (!['http:', 'https:'].includes(url.protocol) || APP_ORIGINS.has(url.origin)) {
      chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
      return;
    }
    chrome.storage.session.set({
      formpilotTarget: { tabId: tab.id, origin: url.origin, title: tab.title ?? url.hostname, connectedAt: Date.now() },
    }, () => {
      chrome.action.setBadgeText({ tabId: tab.id, text: "ON" });
      chrome.action.setTitle({ tabId: tab.id, title: "Tab terhubung ke FormPilot. Klik lagi untuk memperbarui koneksi." });
    });
  } catch {
    chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.get("formpilotTarget", ({ formpilotTarget }) => {
    if (formpilotTarget?.tabId === tabId) chrome.storage.session.remove("formpilotTarget");
  });
});

function inspectPage() {
  const sensitive = /password|passcode|pin|otp|captcha|secret|token|cvv|cvc/i;
  const elements = Array.from(document.querySelectorAll("input, select, textarea")).filter((element) => {
    if (!(element instanceof HTMLElement) || element.hidden) return false;
    if (element.matches("[disabled], [readonly], input[type=hidden], input[type=submit], input[type=button], input[type=image], input[type=file]")) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  return elements.slice(0, 200).map((element) => {
    if (!element.dataset.formpilotField) element.dataset.formpilotField = crypto.randomUUID();
    const labels = "labels" in element && element.labels ? Array.from(element.labels) : [];
    const nearbyLabel = element.closest("label");
    const label = labels.map((item) => item.innerText.trim()).find(Boolean)
      || nearbyLabel?.innerText.trim()
      || element.getAttribute("aria-label")
      || element.getAttribute("placeholder")
      || element.getAttribute("name")
      || "Field tanpa label";
    const type = element instanceof HTMLSelectElement ? (element.multiple ? "select-multiple" : "select-one")
      : element instanceof HTMLTextAreaElement ? "textarea"
      : element.getAttribute("type") || "text";
    const options = element instanceof HTMLSelectElement
      ? Array.from(element.options).filter((option) => option.value && !option.disabled).map((option) => option.text.trim()).filter(Boolean)
      : undefined;
    const descriptor = `${label} ${element.getAttribute("name") ?? ""} ${type}`;
    return {
      id: element.dataset.formpilotField,
      name: element.getAttribute("name") || undefined,
      label: label.replace(/\s+/g, " ").slice(0, 240),
      type,
      required: element.hasAttribute("required") || element.getAttribute("aria-required") === "true",
      sensitive: sensitive.test(descriptor),
      options,
    };
  });
}

function fillPage(payload) {
  const sensitive = /password|passcode|pin|otp|captcha|secret|token|cvv|cvc/i;
  const changed = [];
  const forms = new Set();

  function setNativeValue(element, value) {
    if (element instanceof HTMLSelectElement) {
      const wanted = String(value);
      const option = Array.from(element.options).find((item) => item.value === wanted || item.text.trim() === wanted);
      if (!option) return false;
      element.value = option.value;
    } else if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      element.checked = typeof value === "boolean" ? value : ["true", "1", "yes", "ya", element.value].includes(String(value).toLowerCase());
    } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (setter) setter.call(element, String(value)); else element.value = String(value);
    } else return false;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  for (const mapping of payload.mappings.slice(0, 200)) {
    if (!mapping || typeof mapping.fieldId !== "string" || mapping.value === null) continue;
    const element = document.querySelector(`[data-formpilot-field="${CSS.escape(mapping.fieldId)}"]`);
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue;
    const descriptor = `${mapping.fieldLabel ?? ""} ${element.name} ${element.type}`;
    if (sensitive.test(descriptor) || element.type === "password" || element.type === "file") continue;
    if (setNativeValue(element, mapping.value)) {
      changed.push(mapping.fieldId);
      if (element.form) forms.add(element.form);
    }
  }

  let submitted = false;
  if (payload.submit === true && forms.size === 1) {
    const form = Array.from(forms)[0];
    form.requestSubmit();
    submitted = true;
  }
  return { changedCount: changed.length, submitted, url: location.href };
}

async function runWorkflowPage(payload) {
  const sensitive = /password|passcode|pin|otp|captcha|secret|token|cvv|cvc/i;
  const finalAction = /submit|simpan|kirim|hapus|delete|bayar|payment/i;
  const visible = (element) => element instanceof HTMLElement && !element.hidden && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
  const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const labelOf = (element) => {
    const labels = "labels" in element && element.labels ? Array.from(element.labels) : [];
    return labels.map((item) => item.innerText.trim()).find(Boolean) || element.closest("label")?.innerText.trim() || element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.getAttribute("name") || "";
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const findClickable = (root, text) => Array.from(root.querySelectorAll("button, a, [role=button], input[type=button]")).find((element) => visible(element) && clean(element.innerText || element.value || element.getAttribute("aria-label")).includes(clean(text)));
  const setValue = (element, value) => {
    if (element instanceof HTMLSelectElement) {
      const wanted = clean(value); const option = Array.from(element.options).find((item) => clean(item.value) === wanted || clean(item.text) === wanted); if (!option) return false; element.value = option.value;
    } else if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) {
      element.checked = typeof value === "boolean" ? value : ["true", "1", "yes", "ya", clean(element.value)].includes(clean(value));
    } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, String(value));
    } else return false;
    element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true })); return true;
  };

  let completedSteps = 0;
  for (const step of payload.steps) {
    if (step.action === "pause") return { completedSteps, paused: true, message: step.message, url: location.href };
    if (step.action === "find_row") {
      const wanted = payload.source[step.sourceKey]; if (wanted === undefined || wanted === null) throw new Error(`Kolom ${step.sourceKey} tidak ditemukan`);
      const row = Array.from(document.querySelectorAll("tr, [role=row]")).find((element) => visible(element) && clean(element.innerText).includes(clean(wanted)));
      if (!row) throw new Error(`Baris dengan ${step.sourceKey} tidak ditemukan`); const button = findClickable(row, step.buttonText); if (!button) throw new Error(`Tombol ${step.buttonText} tidak ditemukan pada baris`); button.click();
    } else if (step.action === "click") {
      if (finalAction.test(step.text)) throw new Error("Tombol final ditolak oleh Browser Bridge"); const button = findClickable(document, step.text); if (!button) throw new Error(`Tombol ${step.text} tidak ditemukan`); button.click();
    } else if (step.action === "wait_for") {
      let found = false; for (let attempt = 0; attempt < 40; attempt += 1) { found = clean(document.body?.innerText).includes(clean(step.text)); if (found) break; await wait(250); }
      if (!found) throw new Error(`Tampilan ${step.text} tidak muncul`);
    } else if (step.action === "fill") {
      if (sensitive.test(`${step.fieldLabel} ${step.sourceKey}`)) throw new Error("Field sensitif ditolak"); const value = payload.source[step.sourceKey]; if (value === undefined || value === null) throw new Error(`Kolom ${step.sourceKey} tidak ditemukan`);
      const field = Array.from(document.querySelectorAll("input, select, textarea")).find((element) => visible(element) && !element.disabled && clean(labelOf(element)).includes(clean(step.fieldLabel)));
      if (!field || !setValue(field, value)) throw new Error(`Field ${step.fieldLabel} tidak dapat diisi`);
    } else throw new Error("Aksi workflow tidak dikenal");
    completedSteps += 1; await wait(250);
  }
  return { completedSteps, paused: false, url: location.href };
}

function getTarget(callback) {
  chrome.storage.session.get("formpilotTarget", async ({ formpilotTarget }) => {
    if (!formpilotTarget?.tabId || !formpilotTarget.origin) return callback(null);
    try {
      const tab = await chrome.tabs.get(formpilotTarget.tabId);
      if (!tab.url || new URL(tab.url).origin !== formpilotTarget.origin) {
        await chrome.storage.session.remove("formpilotTarget");
        return callback(null);
      }
      callback({ ...formpilotTarget, title: tab.title ?? formpilotTarget.title, url: tab.url });
    } catch {
      await chrome.storage.session.remove("formpilotTarget");
      callback(null);
    }
  });
}

async function waitForTargetReady(tabId, origin) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || new URL(tab.url).origin !== origin) throw new Error("Workflow berpindah ke origin yang tidak diizinkan");
    if (tab.status === "complete") return tab;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Halaman tujuan belum selesai dimuat");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.source !== "formpilot-content" || !sender.tab?.url) return;
  let senderOrigin;
  try { senderOrigin = new URL(sender.tab.url).origin; } catch { return; }
  if (!APP_ORIGINS.has(senderOrigin) || !["STATUS", "INSPECT", "FILL", "WORKFLOW"].includes(message.type)) return;

  getTarget(async (target) => {
    if (!target) return sendResponse({ ok: true, connected: false });
    if (message.type === "STATUS") return sendResponse({ ok: true, connected: true, target: { title: target.title, url: target.url, origin: target.origin } });

    const requestedUrl = message.payload?.targetUrl;
    try {
      if (typeof requestedUrl !== "string" || new URL(requestedUrl).origin !== target.origin) {
        return sendResponse({ ok: false, error: "Origin tab tidak sama dengan URL target FormPilot" });
      }
      if (message.type === "INSPECT") {
        const [result] = await chrome.scripting.executeScript({ target: { tabId: target.tabId }, func: inspectPage });
        return sendResponse({ ok: true, fields: result.result ?? [], target: { title: target.title, url: target.url } });
      }
      if (message.type === "WORKFLOW") {
        const authorizationId = message.payload?.authorizationId;
        const steps = message.payload?.scenario?.steps;
        const source = message.payload?.source;
        if (typeof authorizationId !== "string" || authorizationId.length < 16 || !Array.isArray(steps) || !source || typeof source !== "object") return sendResponse({ ok: false, error: "Otorisasi workflow tidak valid" });
        if (steps.length < 1 || steps.length > 30 || steps.some((step) => !step || !["find_row", "click", "wait_for", "fill", "pause"].includes(step.action))) return sendResponse({ ok: false, error: "Langkah workflow tidak valid" });
        let completedSteps = 0;
        for (const step of steps) {
          if (step.action === "pause") return sendResponse({ ok: true, result: { completedSteps, paused: true, message: step.message } });
          const beforeStep = await chrome.tabs.get(target.tabId);
          try {
            const [execution] = await chrome.scripting.executeScript({ target: { tabId: target.tabId }, func: runWorkflowPage, args: [{ steps: [step], source }] });
            completedSteps += execution.result?.completedSteps ?? 0;
          } catch (error) {
            const afterStep = await chrome.tabs.get(target.tabId);
            const navigated = afterStep.url !== beforeStep.url || afterStep.status === "loading";
            if (!['click', 'find_row'].includes(step.action) || !navigated) throw error;
            completedSteps += 1;
          }
          await waitForTargetReady(target.tabId, target.origin);
        }
        return sendResponse({ ok: true, result: { completedSteps, paused: false } });
      }
      const authorizationId = message.payload?.authorizationId;
      const mappings = message.payload?.mappings;
      if (typeof authorizationId !== "string" || authorizationId.length < 16 || !Array.isArray(mappings)) {
        return sendResponse({ ok: false, error: "Otorisasi eksekusi tidak valid" });
      }
      if (mappings.some((mapping) => mapping?.sensitive || SENSITIVE_PATTERN.test(`${mapping?.fieldLabel ?? ""}`))) {
        return sendResponse({ ok: false, error: "Mapping sensitif ditolak oleh extension" });
      }
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: target.tabId },
        func: fillPage,
        args: [{ mappings, submit: message.payload?.submit === true }],
      });
      return sendResponse({ ok: true, result: result.result });
    } catch (error) {
      return sendResponse({ ok: false, error: error instanceof Error ? error.message : "Operasi browser gagal" });
    }
  });
  return true;
});
