// background.js
// analyzer.js подключается первым в manifest.json (background.scripts),
// поэтому все его функции (analyzeUrl, DEFAULT_KNOWN_BRANDS и т.д.) уже доступны здесь.

const resultsByTab = new Map();

function domainKeyFromUrl(urlString) {
  try {
    return new URL(urlString).hostname;
  } catch (e) {
    return null;
  }
}

async function getOptions() {
  const stored = await browser.storage.local.get(["vtApiKey", "customBrands"]);
  const brands = DEFAULT_KNOWN_BRANDS.concat(stored.customBrands || []);
  return { vtApiKey: stored.vtApiKey || null, brands };
}

function setBadge(tabId, verdict) {
  const colors = { good: "#2ecc71", warn: "#f1c40f", danger: "#e74c3c" };
  const text = { good: "OK", warn: "?", danger: "!" };
  browser.browserAction.setBadgeText({ tabId, text: text[verdict.level] || "" });
  browser.browserAction.setBadgeBackgroundColor({ tabId, color: colors[verdict.level] || "#999" });
}

async function analyzeAndStore(tabId, url) {
  if (!url || !/^https?:\/\//.test(url)) {
    resultsByTab.delete(tabId);
    browser.browserAction.setBadgeText({ tabId, text: "" });
    return;
  }
  browser.browserAction.setBadgeText({ tabId, text: "…" });
  browser.browserAction.setBadgeBackgroundColor({ tabId, color: "#3498db" });
  try {
    const options = await getOptions();
    const result = await analyzeUrl(url, options);
    resultsByTab.set(tabId, result);
    setBadge(tabId, result.verdict);
  } catch (e) {
    resultsByTab.set(tabId, { error: String(e) });
    browser.browserAction.setBadgeText({ tabId, text: "×" });
    browser.browserAction.setBadgeBackgroundColor({ tabId, color: "#999" });
  }
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    analyzeAndStore(tabId, tab.url);
  }
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!resultsByTab.has(tabId)) {
    try {
      const tab = await browser.tabs.get(tabId);
      if (tab.url) analyzeAndStore(tabId, tab.url);
    } catch (e) {
      // вкладка могла закрыться — игнорируем
    }
  }
});

browser.tabs.onRemoved.addListener((tabId) => {
  resultsByTab.delete(tabId);
});

// Сообщения от popup.js
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_RESULT_FOR_TAB") {
    const result = resultsByTab.get(message.tabId) || null;
    sendResponse({ result });
    return true;
  }
  if (message.type === "REANALYZE_TAB") {
    analyzeAndStore(message.tabId, message.url).then(() => {
      sendResponse({ result: resultsByTab.get(message.tabId) || null });
    });
    return true; // ответ асинхронный
  }
});
