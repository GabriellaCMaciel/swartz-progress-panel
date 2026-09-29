# Swartz Progress Panel

Um painel visual para registrar aprendizados, entregas, projetos e conquistas.

## Como usar

### Registrar um novo progresso
- Abra o formulário em **Issues**.
- Preencha data, categoria, tipo e descrição.
- A automação atualiza `data/progress.json` e o GitHub Pages publica de novo.

### Estrutura principal
- `index.html` → layout do painel
- `style.css` → visual e temas
- `script.js` → métricas, gráficos e timeline
- `data/progress.json` → base dos registros
- `.github/ISSUE_TEMPLATE/progress.yml` → formulário
- `.github/workflows/add-progress.yml` → automação

## Tipos disponíveis
- `Aprendizado`
- `Entrega`
- `Projeto`
- `Conquista`
