# Swartz Progress Panel

Um painel visual para registrar aprendizados, entregas, projetos e conquistas, com o formulário dentro do próprio site.

## Primeiro uso (configuração única)

### 1. Publicar o site

No repositório, vá em `Settings → Pages`, escolha `Deploy from a branch`, branch `main` e pasta `/ (root)`. Em 1 a 2 minutos o endereço aparece nessa mesma tela.

### 2. Conectar o painel ao GitHub (uma vez por navegador)

O site não tem servidor, então ele grava os registros direto no seu repositório pela API do GitHub. Para isso ele usa um **token** que só você tem:

1. Abra o painel e clique em **+ Registrar progresso**. Na primeira vez aparece a janela **Conectar ao GitHub**.
2. Clique em **página de criação do token** e, no GitHub:
   - **Repository access** → `Only select repositories` → marque `swartz-progress-panel`.
   - **Permissions → Repository permissions → Contents** → `Read and write`.
   - Clique em **Generate token** e copie o código (`github_pat_…`).
3. Cole o token na janela e clique em **Conectar**. O formulário abre em seguida.

Pronto. No celular, repita o passo 2 e 3 uma vez (cada navegador guarda o seu próprio token).

> O token fica salvo só no navegador e só é enviado ao `api.github.com`. Ele vale 1 ano; quando expirar, o painel mostra **Reconectar ao GitHub** e é só criar outro. Para cancelar antes, apague o token em `GitHub → Settings → Developer settings → Fine-grained tokens`.

## Como registrar um progresso

1. Clique em **+ Registrar progresso** (ou aperte a tecla **N**).
2. Escolha o **tipo**, escreva a **descrição** e a **categoria** (as mais usadas aparecem como atalhos). A data já vem como hoje; há botões de **Hoje** e **Ontem**.
3. **Salvar** (ou `Ctrl + Enter`). O registro aparece na hora no painel.

O que acontece por trás:

- O registro é guardado na hora no navegador e enviado ao GitHub em segundos (vira um commit em `data/progress.json`).
- Se a internet cair ou o token der problema, o registro fica **pendente** (com aviso na linha do tempo e no topo) e é reenviado sozinho. Nada se perde, nem se você fechar a aba.
- Em outro aparelho, o painel confere o GitHub a cada ~45 segundos e quando você volta para a aba.
- Se você registrar de dois aparelhos ao mesmo tempo, os registros são combinados, nenhum sobrescreve o outro.

## Editar e excluir registros

Com o GitHub conectado, cada registro da linha do tempo tem os botões **✏️ Editar** e **🗑️ Excluir**.

- **Editar** abre o mesmo formulário já preenchido. O registro continua no mesmo lugar da ordem, só muda o conteúdo.
- **Excluir** pede uma confirmação antes de apagar. O registro sai do painel e de `data/progress.json`, mas continua no histórico de commits do repositório. Se precisar recuperar, é só pedir ou desfazer o commit.
- Funcionam igual a adicionar: aparecem na hora, ficam guardadas no navegador se a internet cair e são reenviadas sozinhas. Se outro aparelho mexeu no arquivo ao mesmo tempo, as mudanças dos dois são preservadas.
- Sem token (somente leitura), os botões não aparecem.

O indicador no topo mostra o estado: **Sincronizado**, **Sincronizando…**, **alterações pendentes**, **Reconectar** ou **Somente leitura** (sem token, só dá para ver).

## Ver o painel no seu computador

O painel carrega `data/progress.json` via `fetch`, então não funciona abrindo o `index.html` com duplo clique. Use um servidor local:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Estrutura

- `index.html` → layout do painel, formulário e janela de conexão
- `style.css` → visual e temas (claro/escuro)
- `script.js` → métricas, gráficos, timeline e interface do formulário
- `store.js` → leitura e gravação no GitHub, fila de pendentes, sincronização
- `vendor/chart.umd.min.js` → Chart.js 4.5.1 (MIT), copiado para o repositório para o site não carregar código de terceiros
- `data/progress.json` → base dos registros

## Como as métricas funcionam

- **Sequência atual**: dias seguidos com pelo menos um registro, contando até hoje (ou até ontem, se hoje ainda não teve registro). Se o último registro foi antes de ontem, volta a zero.
- **Foco da semana**: registros nos últimos 7 dias.
- **Progresso por mês**: meses em ordem cronológica; meses sem registro aparecem com 0.

## Tipos disponíveis

- `Aprendizado`
- `Entrega`
- `Projeto`
- `Conquista`
