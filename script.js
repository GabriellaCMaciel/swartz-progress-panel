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

function getMonthLabel(dateString) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(parseLocalDate(dateString));
}

function calculateStreak(entries) {
  if (!entries.length) return 0;
  const uniqueDates = [...new Set(entries.map(entry => entry.date))]
    .map(parseLocalDate)
    .sort((a, b) => b - a);

  let streak = 1;
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const diff = Math.round((uniqueDates[i] - uniqueDates[i + 1]) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
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
  const monthCounts = {};
  const categoryCounts = {};

  entries.forEach(entry => {
    const month = getMonthLabel(entry.date);
    monthCounts[month] = (monthCounts[month] || 0) + 1;
    categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
  });

  const monthLabels = Object.keys(monthCounts);
  const monthValues = monthLabels.map(label => monthCounts[label]);
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
        <span class="timeline-tag">${TYPE_MAP[entry.type]?.emoji || "✨"} ${entry.category} · ${entry.type}</span>
        <div class="timeline-text">${entry.text}</div>
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
  document.getElementById("currentStreak").textContent = `${calculateStreak(entries)} dias`;
  document.getElementById("thisMonthCount").textContent = `${thisMonthCount} este mês`;
  document.getElementById("weekFocusValue").textContent = `${countLast7Days(entries)} registros`;

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
  const response = await fetch("data/progress.json");
  const entries = await response.json();
  renderDashboard(entries);

  const observer = new MutationObserver(() => renderCharts(entries));
  observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
}

boot().catch(err => {
  console.error(err);
  document.getElementById("timeline").innerHTML = '<p class="empty-state">Erro ao carregar os dados do painel.</p>';
});
