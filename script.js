const TYPE_MAP = {
  "Aprendizado": "learningCount",
  "Entrega": "deliveryCount",
  "Conquista": "achievementCount",
  "Projeto": "projectCount"
};

const typeEmoji = {
  "Aprendizado": "📚",
  "Entrega": "✅",
  "Conquista": "🏆",
  "Projeto": "🛠️"
};

function parseLocalDate(dateString){
  const [y,m,d] = dateString.split("-").map(Number);
  return new Date(y, m-1, d);
}

function formatDate(dateString){
  const d = parseLocalDate(dateString);
  return new Intl.DateTimeFormat("pt-BR", {day:"2-digit", month:"2-digit", year:"numeric"}).format(d);
}

function monthKey(dateString){
  const d = parseLocalDate(dateString);
  return new Intl.DateTimeFormat("pt-BR", {month:"short", year:"2-digit"}).format(d);
}

function calculateStreak(entries){
  if(!entries.length) return 0;

  const uniqueDates = [...new Set(entries.map(e => e.date))]
    .map(parseLocalDate)
    .sort((a,b)=>b-a);

  let streak = 1;
  for(let i=0; i<uniqueDates.length-1; i++){
    const diff = Math.round((uniqueDates[i] - uniqueDates[i+1]) / 86400000);
    if(diff === 1) streak++;
    else break;
  }
  return streak;
}

fetch("data/progress.json")
  .then(r => r.json())
  .then(entries => {
    const sorted = [...entries].sort((a,b) => parseLocalDate(b.date) - parseLocalDate(a.date));

    document.getElementById("totalProgress").textContent = entries.length;
    document.getElementById("currentStreak").textContent = `${calculateStreak(entries)} dias`;

    Object.values(TYPE_MAP).forEach(id => document.getElementById(id).textContent = 0);
    const typeCounts = {};
    const categoryCounts = {};
    const monthCounts = {};

    entries.forEach(entry => {
      typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1;
      categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
      const m = monthKey(entry.date);
      monthCounts[m] = (monthCounts[m] || 0) + 1;
    });

    Object.entries(TYPE_MAP).forEach(([type,id]) => {
      document.getElementById(id).textContent = typeCounts[type] || 0;
    });

    const now = new Date();
    const thisMonth = entries.filter(e => {
      const d = parseLocalDate(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    document.getElementById("thisMonthCount").textContent = `${thisMonth} este mês`;

    const timeline = document.getElementById("timeline");
    sorted.slice(0,20).forEach(entry => {
      const item = document.createElement("div");
      item.className = "entry";
      item.innerHTML = `
        <div class="entry-date">${formatDate(entry.date)}</div>
        <div class="entry-main">
          <span class="tag">${typeEmoji[entry.type] || "•"} ${entry.category}</span>
          <div class="entry-text">${entry.text}</div>
        </div>
      `;
      timeline.appendChild(item);
    });

    const monthLabels = Object.keys(monthCounts);
    new Chart(document.getElementById("monthlyChart"), {
      type:"line",
      data:{
        labels:monthLabels,
        datasets:[{
          label:"Evidências",
          data:monthLabels.map(k => monthCounts[k]),
          borderWidth:3,
          tension:.35,
          fill:false
        }]
      },
      options:{
        responsive:true,
        plugins:{legend:{display:false}},
        scales:{
          x:{ticks:{color:"#a7a7b4"},grid:{display:false}},
          y:{beginAtZero:true,ticks:{precision:0,color:"#a7a7b4"},grid:{color:"#2c2c38"}}
        }
      }
    });

    const categories = Object.entries(categoryCounts).sort((a,b)=>b[1]-a[1]);
    new Chart(document.getElementById("categoryChart"), {
      type:"doughnut",
      data:{
        labels:categories.map(([k])=>k),
        datasets:[{data:categories.map(([,v])=>v)}]
      },
      options:{
        plugins:{
          legend:{position:"bottom", labels:{color:"#a7a7b4", boxWidth:10}}
        }
      }
    });
  })
  .catch(err => {
    document.body.innerHTML += `<p style="padding:20px;color:#ff8e8e">Erro ao carregar os dados: ${err}</p>`;
  });
