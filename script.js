const TYPE_MAP = {
  "Aprendizado": { id: "learningCount", emoji: "📚" },
  "Entrega": { id: "deliveryCount", emoji: "✅" },
  "Conquista": { id: "achievementCount", emoji: "🏆" },
  "Projeto": { id: "projectCount", emoji: "🛠️" }
};

const ISSUE_URL = "https://github.com/GabriellaCMaciel/swartz-progress-panel/issues/new?template=progress.yml";
document.getElementById("registerBtn").href = ISSUE_URL;
document.getElementById("openIssueBtn").href = ISSUE_URL;

function parseLocalDate(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parseLocalDate(dateString));
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

function countLast7Days(entries) {
  const now = new Date();
  now.setHours(0,0,0,0);
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 6);
  return entries.filter(entry => {
    const date = parseLocalDate(entry.date);
    return date >= weekAgo && date <= now;
  }).length;
}

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

function renderTimeline(entries) {
  const timeline = document.getElementById("timeline");
  timeline.innerHTML = "";

  if (!entries.length) {
    timeline.innerHTML = '<p class="empty-state">Nenhum registro ainda. Clique em <b>Registrar progresso</b> para começar.</p>';
    return;
  }

  entries.slice(0, 14).forEach(entry => {
    const item = document.createElement("div");
    item.className = "timeline-entry";
    item.innerHTML = `
      <div class="timeline-date">${formatDate(entry.date)}</div>
      <div class="timeline-main">
        <span class="timeline-tag">${TYPE_MAP[entry.type]?.emoji || "✨"} ${escapeHtml(entry.category)} · ${escapeHtml(entry.type)}</span>
        <div class="timeline-text">${escapeHtml(entry.text)}</div>
      </div>
    `;
    timeline.appendChild(item);
  });
}

function renderDashboard(entries) {
  const sorted = [...entries].sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
  const now = new Date();
  const thisMonthCount = entries.filter(entry => {
    const date = parseLocalDate(entry.date);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  document.getElementById("totalProgress").textContent = entries.length;
  document.getElementById("currentStreak").textContent = plural(calculateStreak(entries), "dia", "dias");
  document.getElementById("thisMonthCount").textContent = `${thisMonthCount} este mês`;
  document.getElementById("weekFocusValue").textContent = plural(countLast7Days(entries), "registro", "registros");

  Object.values(TYPE_MAP).forEach(({ id }) => {
    document.getElementById(id).textContent = 0;
  });

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

  renderTimeline(sorted);
  renderCharts(entries);
}

async function boot() {
  setupTheme();
  // no-store: garante que um registro novo apareça logo, sem ficar preso no cache do navegador
  const response = await fetch("data/progress.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Falha ao carregar data/progress.json (${response.status})`);
  const entries = await response.json();
  renderDashboard(entries);

  const observer = new MutationObserver(() => renderCharts(entries));
  observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
}

boot().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML = '<p class="empty-state">Erro ao carregar os dados do painel. Se você abriu o <code>index.html</code> direto do computador, use um servidor local (<code>python3 -m http.server</code>) ou o link do GitHub Pages.</p>';
});
