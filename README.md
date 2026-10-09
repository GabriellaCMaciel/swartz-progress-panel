# Swartz Progress Panel

Um painel visual para registrar aprendizados, entregas, projetos e conquistas.

## Primeiro uso (configuração única)

1. **Ative o GitHub Pages**: no repositório, vá em `Settings → Pages`, escolha `Deploy from a branch`, branch `main` e pasta `/ (root)`.
2. **Confira as permissões das Actions**: em `Settings → Actions → General`, deixe as Actions habilitadas. Em *Workflow permissions*, marque `Read and write permissions` (a automação precisa gravar o `data/progress.json`).
3. Aguarde 1 a 2 minutos e abra o endereço que o GitHub mostra em `Settings → Pages`.
4. **Teste**: clique em **+ Registrar progresso**, preencha o formulário e envie. Em cerca de 1 minuto a issue é fechada com um comentário ✅ e o registro aparece no painel.

## Como registrar um progresso

1. Clique em **+ Registrar progresso** no painel (ou abra uma issue pelo template **Registrar progresso**).
2. Preencha:
   - **Data**: `AAAA-MM-DD` ou `DD/MM/AAAA`. Se deixar em branco, usa a data de hoje.
   - **Categoria**: texto livre (Python, React, EFG, Portfólio, 42SP…).
   - **Tipo**: Aprendizado, Entrega, Projeto ou Conquista.
   - **Descrição**: o que você fez, aprendeu ou concluiu.
3. Envie. A automação adiciona o registro em `data/progress.json`, comenta na issue e fecha. O GitHub Pages republica sozinho.

Se algo estiver errado (data inválida, tipo diferente, registro repetido), a automação comenta o motivo na issue e fecha; é só abrir outro formulário.

> Por segurança, só issues abertas pela dona do repositório são registradas no painel.

## Ver o painel no seu computador

O painel carrega `data/progress.json` via `fetch`, então não funciona abrindo o `index.html` com duplo clique. Use um servidor local:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Estrutura

- `index.html` → layout do painel
- `style.css` → visual e temas (claro/escuro)
- `script.js` → métricas, gráficos e timeline
- `data/progress.json` → base dos registros
- `.github/ISSUE_TEMPLATE/progress.yml` → formulário
- `.github/workflows/add-progress.yml` → automação

## Como as métricas funcionam

- **Sequência atual**: dias seguidos com pelo menos um registro, contando até hoje (ou até ontem, se hoje ainda não teve registro). Se o último registro foi antes de ontem, volta a zero.
- **Foco da semana**: registros nos últimos 7 dias.
- **Progresso por mês**: meses em ordem cronológica; meses sem registro aparecem com 0.

## Tipos disponíveis

- `Aprendizado`
- `Entrega`
- `Projeto`
- `Conquista`
