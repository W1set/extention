// options.js

async function load() {
  const stored = await browser.storage.local.get(["vtApiKey", "customBrands"]);
  document.getElementById("vtApiKey").value = stored.vtApiKey || "";
  document.getElementById("customBrands").value = (stored.customBrands || []).join("\n");
}

async function save() {
  const vtApiKey = document.getElementById("vtApiKey").value.trim();
  const customBrands = document.getElementById("customBrands").value
    .split("\n")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  await browser.storage.local.set({ vtApiKey, customBrands });

  const status = document.getElementById("status");
  status.textContent = "Сохранено ✓";
  setTimeout(() => (status.textContent = ""), 2000);
}

document.getElementById("saveBtn").addEventListener("click", save);
load();
