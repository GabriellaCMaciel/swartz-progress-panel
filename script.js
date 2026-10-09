const TYPE_MAP = {
  "Aprendizado": { id: "learningCount", emoji: "📚" },
  "Entrega": { id: "deliveryCount", emoji: "✅" },
  "Conquista": { id: "achievementCount", emoji: "🏆" },
  "Projeto": { id: "projectCount", emoji: "🛠️" }
};

const TIMELINE_PAGE = 14;
const LAST_TYPE_KEY = "swartz-last-type";

// ---------- datas e textos ----------
function parseLocalDate(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parseLocalDate(dateString));
}

function toDateInputValue(date) {
  // Usa o fuso do navegador (toISOString usaria UTC e viraria o dia à noite)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// ---------- métricas ----------
// Sequência = dias seguidos com registro, contando até hoje (ou até ontem, se hoje ainda não teve registro).
// Se o último registro foi antes de ontem, a sequência está zerada.
function calculateStreak(entries) {
  if (!entries.length) return 0;
  const uniqueDates = [...new Set(entries.map(entry => entry.date))]
    .map(parseLocalDate)
    .sort((a, b) => b - a);

  const daysSinceLast = Math.round((startOfToday() - uniqueDates[0]) / 86400000);
  if (daysSinceLast > 1) return 0;

  let streak = 1;
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const diff = Math.round((uniqueDates[i] - uniqueDates[i + 1]) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function countLast7Days(entries) {
  const now = startOfToday();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 6);
  return entries.filter(entry => {
    const date = parseLocalDate(entry.date);
    return date >= weekAgo && date <= now;
  }).length;
}

// Conta registros por mês em ordem cronológica, incluindo meses sem registro (valor 0)
// até o mês atual, para a linha do gráfico não "pular" períodos.
function buildMonthlySeries(entries) {
  if (!entries.length) return { labels: [], values: [] };

  const counts = {};
  let first = null;
  let last = null;
  entries.forEach(entry => {
    const date = parseLocalDate(entry.date);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const key = `${monthStart.getFullYear()}-${monthStart.getMonth()}`;
    counts[key] = (counts[key] || 0) + 1;
    if (!first || monthStart < first) first = monthStart;
    if (!last || monthStart > last) last = monthStart;
  });

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (currentMonth > last) last = currentMonth;

  const formatter = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });
  const labels = [];
  const values = [];
  for (let cursor = new Date(first); cursor <= last; cursor.setMonth(cursor.getMonth() + 1)) {
    labels.push(formatter.format(cursor));
    values.push(counts[`${cursor.getFullYear()}-${cursor.getMonth()}`] || 0);
  }
  return { labels, values };
}

// ---------- tema ----------
function setupTheme() {
  const toggle = document.getElementById("themeToggle");
  const saved = localStorage.getItem("swartz-theme") || "dark";
  document.body.setAttribute("data-theme", saved);
  updateThemeLabel(saved);

  toggle.addEventListener("click", () => {
    const current = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", current);
    localStorage.setItem("swartz-theme", current);
    updateThemeLabel(current);
  });
}

function updateThemeLabel(theme) {
  document.getElementById("themeToggle").textContent = theme === "dark" ? "☀️ Tema claro" : "🌙 Tema escuro";
}

// ---------- gráficos ----------
function getChartDefaults() {
  const styles = getComputedStyle(document.body);
  return {
    textColor: styles.getPropertyValue("--muted").trim(),
    borderColor: styles.getPropertyValue("--border").trim(),
    accent: styles.getPropertyValue("--accent").trim(),
    accent2: styles.getPropertyValue("--accent-2").trim()
  };
}

let monthlyChart;
let categoryChart;

function renderCharts(entries) {
  const styles = getChartDefaults();
  const categoryCounts = {};

  entries.forEach(entry => {
    categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
  });

  const { labels: monthLabels, values: monthValues } = buildMonthlySeries(entries);
  const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  if (monthlyChart) monthlyChart.destroy();
  if (categoryChart) categoryChart.destroy();

  monthlyChart = new Chart(document.getElementById("monthlyChart"), {
    type: "line",
    data: {
      labels: monthLabels,
      datasets: [{
        label: "Evidências",
        data: monthValues,
        borderColor: styles.accent,
        backgroundColor: styles.accent,
        pointRadius: 4,
        pointHoverRadius: 5,
        borderWidth: 3,
        tension: 0.36,
        fill: false
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: styles.textColor } },
        y: { beginAtZero: true, ticks: { color: styles.textColor, precision: 0 }, grid: { color: styles.borderColor } }
      }
    }
  });

  categoryChart = new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels: categories.map(([name]) => name),
      datasets: [{
        data: categories.map(([, count]) => count),
        backgroundColor: [styles.accent, styles.accent2, "#7e8cff", "#ff9ad8", "#cba9ff", "#b1c5ff", "#ffb6ec"]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: styles.textColor, boxWidth: 12, usePointStyle: true, pointStyle: "circle" }
        }
      }
    }
  });
}

// ---------- linha do tempo ----------
let timelineLimit = TIMELINE_PAGE;
let highlightKey = null;
let highlightStartedAt = 0;

function renderTimeline(sortedEntries, pendingKeys) {
  const timeline = document.getElementById("timeline");
  timeline.innerHTML = "";

  if (!sortedEntries.length) {
    timeline.innerHTML = '<p class="empty-state">Nenhum registro ainda. Clique em <b>Registrar progresso</b> para começar.</p>';
    return;
  }

  sortedEntries.slice(0, timelineLimit).forEach(entry => {
    const key = Store.entryKey(entry);
    const item = document.createElement("div");
    item.className = "timeline-entry";
    if (key === highlightKey) {
      item.classList.add("is-new");
      // Se a lista for redesenhada no meio do brilho, a animação continua de onde parou (não recomeça)
      item.style.animationDelay = `-${Math.max(0, Date.now() - highlightStartedAt)}ms`;
    }
    const waiting = pendingKeys.has(key) ? '<span class="pending-tag">⏳ aguardando envio</span>' : "";
    item.innerHTML = `
      <div class="timeline-date">${formatDate(entry.date)}</div>
      <div class="timeline-main">
        <span class="timeline-tag">${TYPE_MAP[entry.type]?.emoji || "✨"} ${escapeHtml(entry.category)} · ${escapeHtml(entry.type)}</span>
        <div class="timeline-text">${escapeHtml(entry.text)}</div>
        ${waiting}
      </div>
    `;
    // Editar e excluir só aparecem com o GitHub conectado (sem token o painel é somente leitura)
    if (currentState.hasToken) item.querySelector(".timeline-main").appendChild(buildEntryActions(entry));
    timeline.appendChild(item);
  });

  if (sortedEntries.length > timelineLimit) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "secondary-btn timeline-more";
    more.textContent = `Mostrar mais (${sortedEntries.length - timelineLimit})`;
    more.addEventListener("click", () => {
      timelineLimit += TIMELINE_PAGE;
      renderAll(currentState);
    });
    timeline.appendChild(more);
  }
}

function buildEntryActions(entry) {
  const box = document.createElement("div");
  box.className = "entry-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "entry-btn";
  editBtn.dataset.action = "edit";
  editBtn.textContent = "✏️ Editar";
  editBtn.setAttribute("aria-label", `Editar registro de ${formatDate(entry.date)}`);
  editBtn.addEventListener("click", () => openEdit(entry));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "entry-btn";
  deleteBtn.dataset.action = "delete";
  deleteBtn.textContent = "🗑️ Excluir";
  deleteBtn.setAttribute("aria-label", `Excluir registro de ${formatDate(entry.date)}`);
  deleteBtn.addEventListener("click", () => openDelete(entry));

  box.append(editBtn, deleteBtn);
  return box;
}

// ---------- painel ----------
let currentState = { entries: [], status: "readonly", pendingCount: 0, pendingKeys: new Set(), message: "", hasToken: false };
let currentEntries = [];
let lastEntriesSignature = null;

function sortNewestFirst(entries) {
  // Mesma data: o registro feito por último aparece primeiro
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => parseLocalDate(b.entry.date) - parseLocalDate(a.entry.date) || b.index - a.index)
    .map(item => item.entry);
}

function renderDashboard(entries, pendingKeys) {
  const sorted = sortNewestFirst(entries);
  const now = new Date();
  const thisMonthCount = entries.filter(entry => {
    const date = parseLocalDate(entry.date);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  document.getElementById("totalProgress").textContent = entries.length;
  document.getElementById("currentStreak").textContent = plural(calculateStreak(entries), "dia", "dias");
  document.getElementById("thisMonthCount").textContent = `${thisMonthCount} este mês`;
  document.getElementById("weekFocusValue").textContent = plural(countLast7Days(entries), "registro", "registros");

  const typeCounts = {};
  entries.forEach(entry => {
    typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1;
  });

  Object.entries(TYPE_MAP).forEach(([type, config]) => {
    document.getElementById(config.id).textContent = typeCounts[type] || 0;
  });

  document.getElementById("lastUpdateText").textContent = sorted.length
    ? `Último registro em ${formatDate(sorted[0].date)}`
    : "Nenhum registro ainda.";

  renderTimeline(sorted, pendingKeys);
  renderCharts(entries);
}

const SYNC_LABELS = {
  readonly: () => "🔒 Somente leitura · conectar",
  syncing: () => "Sincronizando…",
  synced: () => "Sincronizado",
  pending: state => `${plural(state.pendingCount, "alteração pendente", "alterações pendentes")} · tentar de novo`,
  auth: () => "Reconectar ao GitHub"
};

function renderSyncChip(state) {
  const chip = document.getElementById("syncChip");
  chip.dataset.state = state.status;
  chip.textContent = SYNC_LABELS[state.status](state);
  chip.title = state.message || "";
}

// Métricas e gráficos só são redesenhados quando os registros mudam (evita piscar a cada checagem).
// Se só mudou o "aguardando envio", atualiza apenas a linha do tempo.
let lastPendingSignature = null;

function entriesSignature(state) {
  // Ignora a ordem: o arquivo é reordenado por data ao salvar, mas os registros são os mesmos
  return JSON.stringify(state.entries.map(Store.entryKey).sort());
}

function pendingSignature(state) {
  // inclui hasToken porque os botões Editar/Excluir só existem com o GitHub conectado
  return JSON.stringify([[...state.pendingKeys].sort(), state.hasToken]);
}

function renderAll(state) {
  currentState = state;
  currentEntries = state.entries;
  renderSyncChip(state);
  renderDashboard(state.entries, state.pendingKeys);
  lastEntriesSignature = entriesSignature(state);
  lastPendingSignature = pendingSignature(state);
}

function onStoreChange(state) {
  currentState = state;
  currentEntries = state.entries;
  renderSyncChip(state);
  if (entriesSignature(state) !== lastEntriesSignature) {
    renderAll(state);
  } else if (pendingSignature(state) !== lastPendingSignature) {
    renderTimeline(sortNewestFirst(state.entries), state.pendingKeys);
    lastPendingSignature = pendingSignature(state);
  }
}

// ---------- aviso (toast) ----------
let toastTimer;
function showToast(text, kind = "ok") {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.dataset.kind = kind;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), kind === "ok" ? 2600 : 5200);
}

// ---------- janelas (modais) ----------
function setupDialog(dialog) {
  dialog.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => dialog.close()));
  // Fecha ao clicar no fundo escurecido (só se o clique começou e terminou ali)
  let pressedOnBackdrop = false;
  dialog.addEventListener("mousedown", event => { pressedOnBackdrop = event.target === dialog; });
  dialog.addEventListener("click", event => {
    if (event.target === dialog && pressedOnBackdrop) dialog.close();
  });
  // Ao fechar, não deixa o foco preso num campo que sumiu (senão atalhos como a tecla N param de funcionar)
  dialog.addEventListener("close", () => {
    const active = document.activeElement;
    if (active && active !== document.body && dialog.contains(active)) active.blur();
  });
}

function isTyping(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("dialog:not([open])")) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// ---------- formulário de registro ----------
let afterConnectOpenRegister = false;

function topCategories(limit = 8) {
  const counts = {};
  currentEntries.forEach(entry => { counts[entry.category] = (counts[entry.category] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name]) => name);
}

function setFormDate(which) {
  const date = new Date();
  if (which === "yesterday") date.setDate(date.getDate() - 1);
  const input = document.getElementById("fieldDate");
  input.value = toDateInputValue(date);
  updateDateChips();
}

function updateDateChips() {
  const value = document.getElementById("fieldDate").value;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  document.querySelectorAll("[data-date]").forEach(btn => {
    const target = btn.dataset.date === "today" ? today : yesterday;
    btn.classList.toggle("is-active", value === toDateInputValue(target));
  });
}

function fillCategorySuggestions() {
  const categories = topCategories();
  document.getElementById("categoryList").innerHTML = categories.map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
  const chips = document.getElementById("categoryChips");
  chips.innerHTML = "";
  categories.forEach(name => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-btn";
    btn.textContent = name;
    btn.addEventListener("click", () => {
      document.getElementById("fieldCategory").value = name;
      updateCategoryChips();
      document.getElementById("fieldText").focus();
    });
    chips.appendChild(btn);
  });
  updateCategoryChips();
}

function updateCategoryChips() {
  const value = document.getElementById("fieldCategory").value.trim().toLowerCase();
  document.querySelectorAll("#categoryChips .chip-btn").forEach(btn => {
    btn.classList.toggle("is-active", btn.textContent.toLowerCase() === value);
  });
}

function showFormError(text) {
  const box = document.getElementById("formError");
  box.textContent = text;
  box.hidden = !text;
}

// Quando não é null, o formulário está editando este registro (em vez de criar um novo)
let editingEntry = null;

function setFormMode(editing) {
  document.getElementById("registerKicker").textContent = editing ? "Editar registro" : "Novo registro";
  document.getElementById("registerTitle").textContent = editing ? "Ajuste o que precisar" : "O que você construiu hoje?";
  document.getElementById("saveBtn").textContent = editing ? "Salvar alterações" : "Salvar registro";
}

function openRegister() {
  if (!Store.hasToken()) {
    afterConnectOpenRegister = true;
    openConnect();
    return;
  }
  editingEntry = null;
  setFormMode(false);

  const lastType = localStorage.getItem(LAST_TYPE_KEY);
  const radio = document.querySelector(`#registerForm input[name="type"][value="${lastType}"]`)
    || document.querySelector('#registerForm input[name="type"][value="Aprendizado"]');
  radio.checked = true;

  document.getElementById("fieldText").value = "";
  document.getElementById("fieldCategory").value = "";
  document.getElementById("charCount").textContent = "0";
  showFormError("");
  setFormDate("today");
  fillCategorySuggestions();

  const dialog = document.getElementById("registerModal");
  if (!dialog.open) dialog.showModal();
  document.getElementById("fieldText").focus();
}

function openEdit(entry) {
  if (!Store.hasToken()) {
    afterConnectOpenRegister = false;
    openConnect();
    return;
  }
  editingEntry = entry;
  setFormMode(true);

  const radio = document.querySelector(`#registerForm input[name="type"][value="${entry.type}"]`);
  if (radio) radio.checked = true;

  document.getElementById("fieldText").value = entry.text;
  document.getElementById("fieldCategory").value = entry.category;
  document.getElementById("charCount").textContent = entry.text.length;
  document.getElementById("fieldDate").value = entry.date;
  updateDateChips();
  showFormError("");
  fillCategorySuggestions();

  const dialog = document.getElementById("registerModal");
  if (!dialog.open) dialog.showModal();
  document.getElementById("fieldText").focus();
}

function submitRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = {
    type: form.elements.type.value,
    text: form.elements.text.value,
    category: form.elements.category.value,
    date: form.elements.date.value
  };

  const editing = editingEntry;
  let result;
  try {
    result = editing ? Store.edit(editing, data) : Store.add(data);
  } catch (err) {
    showFormError(err.message);
    return;
  }

  localStorage.setItem(LAST_TYPE_KEY, data.type);
  // A mudança já entrou no painel dentro do Store; agora marca qual registro destacar e redesenha só a lista
  highlightKey = Store.entryKey(result.entry);
  highlightStartedAt = Date.now();
  timelineLimit = Math.max(timelineLimit, TIMELINE_PAGE);
  renderTimeline(sortNewestFirst(currentState.entries), currentState.pendingKeys);
  document.getElementById("registerModal").close();
  if (!editing) document.getElementById("timelineSection").scrollIntoView({ behavior: "smooth", block: "nearest" });
  showToast(editing ? "✅ Registro atualizado!" : "✅ Registro adicionado!");
  setTimeout(() => { highlightKey = null; }, 3500);

  announceSync(result.done);
}

// Depois do aviso imediato, conta como foi o envio ao GitHub
function announceSync(done) {
  done.then(outcome => {
    if (outcome.ok) showToast("☁️ Salvo no GitHub");
    else showToast(`Guardei no navegador, mas ainda não foi para o GitHub. ${outcome.message}`, "warn");
  });
}

// ---------- excluir registro ----------
let deletingEntry = null;

function openDelete(entry) {
  if (!Store.hasToken()) {
    afterConnectOpenRegister = false;
    openConnect();
    return;
  }
  deletingEntry = entry;
  const preview = document.getElementById("deletePreview");
  preview.innerHTML = "";
  const tag = document.createElement("span");
  tag.className = "timeline-tag";
  tag.textContent = `${TYPE_MAP[entry.type]?.emoji || "✨"} ${entry.category} · ${entry.type}`;
  const date = document.createElement("small");
  date.className = "field-hint";
  date.textContent = formatDate(entry.date);
  const text = document.createElement("p");
  text.className = "delete-text";
  text.textContent = entry.text;
  preview.append(date, tag, text);

  const dialog = document.getElementById("deleteModal");
  if (!dialog.open) dialog.showModal();
  document.getElementById("deleteCancelBtn").focus();
}

function setupDelete() {
  const dialog = document.getElementById("deleteModal");
  setupDialog(dialog);
  dialog.addEventListener("close", () => { deletingEntry = null; });
  document.getElementById("deleteCancelBtn").addEventListener("click", () => dialog.close());
  document.getElementById("deleteConfirmBtn").addEventListener("click", () => {
    const entry = deletingEntry;
    dialog.close();
    if (!entry) return;
    const { done } = Store.remove(entry);
    showToast("🗑️ Registro excluído");
    announceSync(done);
  });
}

function setupRegisterForm() {
  const dialog = document.getElementById("registerModal");
  const form = document.getElementById("registerForm");
  setupDialog(dialog);

  document.getElementById("registerBtn").addEventListener("click", () => openRegister());
  document.getElementById("openRegisterBtn").addEventListener("click", () => openRegister());
  dialog.addEventListener("close", () => { editingEntry = null; });

  form.addEventListener("submit", submitRegister);
  form.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener("input", () => showFormError(""));

  document.getElementById("fieldText").addEventListener("input", event => {
    document.getElementById("charCount").textContent = event.target.value.length;
  });
  document.getElementById("fieldCategory").addEventListener("input", updateCategoryChips);
  document.getElementById("fieldCategory").addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); form.requestSubmit(); }
  });
  document.getElementById("fieldDate").addEventListener("input", updateDateChips);
  document.querySelectorAll("[data-date]").forEach(btn => btn.addEventListener("click", () => setFormDate(btn.dataset.date)));

  // Atalho: tecla N abre o formulário (quando você não está digitando em outro campo)
  document.addEventListener("keydown", event => {
    if (event.key.toLowerCase() !== "n" || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping(event.target) || document.querySelector("dialog[open]")) return;
    event.preventDefault();
    openRegister();
  });
}

// ---------- conexão com o GitHub ----------
function showConnectError(text) {
  const box = document.getElementById("connectError");
  box.textContent = text;
  box.hidden = !text;
}

function openConnect() {
  const connected = Store.hasToken();
  document.getElementById("connectedBox").hidden = !connected;
  document.getElementById("connectSteps").hidden = connected;
  document.getElementById("connectIntro").hidden = connected;
  document.getElementById("connectForm").querySelector("label").textContent = connected ? "Trocar token" : "Token";
  document.getElementById("connectBtn").textContent = connected ? "Salvar novo token" : "Conectar";
  document.getElementById("disconnectBtn").hidden = !connected;
  document.getElementById("tokenInput").value = "";
  showConnectError(currentState.status === "auth" ? currentState.message : "");

  const dialog = document.getElementById("connectModal");
  if (!dialog.open) dialog.showModal();
  document.getElementById("tokenInput").focus();
}

function setupConnect() {
  const dialog = document.getElementById("connectModal");
  setupDialog(dialog);
  dialog.addEventListener("close", () => { afterConnectOpenRegister = false; });

  document.getElementById("connectForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = document.getElementById("connectBtn");
    const input = document.getElementById("tokenInput");
    showConnectError("");
    button.disabled = true;
    const previousLabel = button.textContent;
    button.textContent = "Conectando…";
    const result = await Store.connect(input.value);
    button.disabled = false;
    button.textContent = previousLabel;

    if (!result.ok) {
      showConnectError(result.message);
      return;
    }
    input.value = "";
    const shouldOpenRegister = afterConnectOpenRegister;
    dialog.close();
    afterConnectOpenRegister = false;
    showToast("✅ Conectado ao GitHub!");
    if (shouldOpenRegister) openRegister();
  });

  document.getElementById("disconnectBtn").addEventListener("click", () => {
    Store.disconnect();
    dialog.close();
    showToast("Desconectado. O painel voltou para o modo somente leitura.", "warn");
  });

  document.getElementById("syncChip").addEventListener("click", () => {
    const status = currentState.status;
    if (status === "syncing") return; // já está enviando, é só aguardar
    if (status === "pending") {
      showToast("Tentando enviar de novo…");
      Store.sync().then(outcome => {
        if (outcome.ok) showToast("☁️ Tudo salvo no GitHub");
        else showToast(outcome.message, "warn");
      });
    } else {
      openConnect();
    }
  });
}

// ---------- início ----------
function boot() {
  setupTheme();
  setupRegisterForm();
  setupDelete();
  setupConnect();

  Store.subscribe(onStoreChange);

  // Ao trocar de tema, redesenha os gráficos com as cores novas (usando os registros atuais)
  const observer = new MutationObserver(() => renderCharts(currentEntries));
  observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });

  return Store.init();
}

try {
  boot();
} catch (err) {
  console.error(err);
  document.getElementById("timeline").innerHTML = '<p class="empty-state">Erro ao carregar os dados do painel. Se você abriu o <code>index.html</code> direto do computador, use um servidor local (<code>python3 -m http.server</code>) ou o link do GitHub Pages.</p>';
}
