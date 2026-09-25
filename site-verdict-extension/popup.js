// popup.js

const el = (id) => document.getElementById(id);

function show(id) { el(id).classList.remove("hidden"); }
function hide(id) { el(id).classList.add("hidden"); }

function formatDate(dateStr) {
  if (!dateStr) return "неизвестно";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" });
}

function renderResult(result) {
  hide("loading"); hide("empty"); hide("error");

  if (!result) {
    show("empty");
    hide("content");
    return;
  }
  if (result.error) {
    el("error").textContent = "Ошибка анализа: " + result.error;
    show("error");
    hide("content");
    return;
  }

  show("content");

  el("domainName").textContent = result.hostname;
  const httpsBadge = el("httpsBadge");
  httpsBadge.textContent = result.isHttps ? "HTTPS" : "нет HTTPS";
  httpsBadge.className = "badge " + (result.isHttps ? "https" : "nohttps");

  const box = el("verdictBox");
  box.className = "verdict-box " + result.verdict.level;
  el("verdictLabel").textContent = result.verdict.label;
  el("scoreFill").style.width = result.verdict.score + "%";
  el("scoreText").textContent = `Оценка доверия: ${result.verdict.score} / 100`;

  const reasonsList = el("reasonsList");
  reasonsList.innerHTML = "";
  for (const reason of result.verdict.reasons) {
    const li = document.createElement("li");
    li.textContent = reason;
    reasonsList.appendChild(li);
  }

  // Регистрация домена
  if (result.rdap && result.rdap.ok) {
    el("regDate").textContent = formatDate(result.rdap.registrationDate);
    el("ageText").textContent = result.ageDays !== null ? `${result.ageDays} дн.` : "неизвестно";
    el("registrar").textContent = result.rdap.registrar || "неизвестно";
    el("expDate").textContent = formatDate(result.rdap.expirationDate);
  } else {
    el("regDate").textContent = "данные недоступны (RDAP не ответил)";
    el("ageText").textContent = "—";
    el("registrar").textContent = "—";
    el("expDate").textContent = "—";
  }

  // VirusTotal
  const vtBlock = el("vtBlock");
  if (!result.vt) {
    vtBlock.textContent = "API-ключ VirusTotal не задан. Добавьте его в настройках для проверки репутации.";
  } else if (!result.vt.ok) {
    vtBlock.textContent = "Не удалось получить данные VirusTotal.";
  } else {
    const s = result.vt.stats || {};
    vtBlock.innerHTML = `
      Вредоносный: <b>${s.malicious ?? 0}</b> ·
      Подозрительный: <b>${s.suspicious ?? 0}</b> ·
      Безопасный: <b>${s.harmless ?? 0}</b> ·
      Не определено: <b>${s.undetected ?? 0}</b>
    `;
  }

  // Похожесть на бренды
  const brandBlock = el("brandBlock");
  const bm = result.brandMatch;
  if (bm.type === "exact") {
    brandBlock.textContent = `Совпадает с известным доменом «${bm.brand}».`;
  } else if (bm.type === "typosquat") {
    brandBlock.textContent = `⚠ Похож на «${bm.brand}» (расстояние ${bm.distance}). Возможна подделка.`;
  } else {
    brandBlock.textContent = "Совпадений с известными брендами не найдено.";
  }
}

async function main() {
  show("loading");
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:\/\//.test(tab.url)) {
    hide("loading");
    renderResult(null);
    return;
  }

  const resp = await browser.runtime.sendMessage({ type: "GET_RESULT_FOR_TAB", tabId: tab.id });
  hide("loading");
  renderResult(resp && resp.result);

  el("refreshBtn").addEventListener("click", async () => {
    show("loading");
    hide("content"); hide("error"); hide("empty");
    const r = await browser.runtime.sendMessage({ type: "REANALYZE_TAB", tabId: tab.id, url: tab.url });
    hide("loading");
    renderResult(r && r.result);
  });
}

main();
