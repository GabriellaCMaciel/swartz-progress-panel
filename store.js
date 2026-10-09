/*
 * store.js — de onde vêm os dados do painel e para onde eles vão.
 *
 * Como funciona:
 *  - Os registros ficam em data/progress.json, dentro do seu repositório no GitHub.
 *  - Com o token conectado, o painel lê e grava esse arquivo direto pela API do GitHub.
 *  - Cada mudança (adicionar, editar ou excluir) aparece na hora na tela e entra numa fila guardada
 *    no navegador (localStorage). Ela só sai da fila quando o GitHub confirma. Se a internet cair ou
 *    o token expirar, nada se perde: a mudança fica pendente e é reenviada depois.
 *  - A cada envio, a fila é aplicada sobre a versão MAIS RECENTE do arquivo no GitHub, então mudanças
 *    feitas em outro aparelho não são sobrescritas.
 *  - Sem token, o painel só lê o data/progress.json publicado (modo somente leitura).
 */
const Store = (() => {
  const REPO = { owner: "GabriellaCMaciel", repo: "swartz-progress-panel", branch: "main", path: "data/progress.json" };
  const API = "https://api.github.com";
  const FILE_URL = `${API}/repos/${REPO.owner}/${REPO.repo}/contents/${REPO.path}`;
  const KEYS = { token: "swartz-gh-token", cache: "swartz-entries-cache", pending: "swartz-pending" };
  const TYPES = ["Aprendizado", "Entrega", "Projeto", "Conquista"];
  const POLL_MS = 45000;
  const MAX_ATTEMPTS = 4;

  // ---------- armazenamento local (com plano B se o navegador bloquear o localStorage) ----------
  const memoryFallback = {};
  function lsGet(key) {
    try { return localStorage.getItem(key); } catch { return memoryFallback[key] ?? null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch { memoryFallback[key] = value; }
  }
  function lsDel(key) {
    try { localStorage.removeItem(key); } catch { delete memoryFallback[key]; }
  }
  function lsGetJson(key, fallback) {
    try { const raw = lsGet(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  }

  // ---------- utilidades ----------
  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function fromBase64(base64) {
    const binary = atob(base64.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function entryKey(entry) {
    return [entry.date, entry.category, entry.type, entry.text].join("\u0001");
  }

  function isValidDateString(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const [y, m, d] = match.slice(1).map(Number);
    const check = new Date(Date.UTC(y, m - 1, d));
    return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
  }

  function cleanEntry(raw) {
    const entry = {
      date: String(raw.date ?? "").trim(),
      category: String(raw.category ?? "").trim().replace(/\s+/g, " "),
      type: String(raw.type ?? "").trim(),
      text: String(raw.text ?? "").trim()
    };
    if (!isValidDateString(entry.date)) throw new Error("Escolha uma data válida.");
    if (!TYPES.includes(entry.type)) throw new Error("Escolha o tipo do registro.");
    if (!entry.text) throw new Error("Escreva o que você fez, aprendeu ou concluiu.");
    if (entry.text.length > 500) throw new Error("A descrição pode ter até 500 caracteres.");
    if (!entry.category) throw new Error("Informe a categoria (ex.: Python, React, 42SP).");
    if (entry.category.length > 40) throw new Error("A categoria pode ter até 40 caracteres.");
    return entry;
  }

  function sortForFile(entries) {
    // Array.sort é estável: registros do mesmo dia mantêm a ordem em que foram feitos
    return [...entries].sort((a, b) => a.date.localeCompare(b.date));
  }

  function normalizeRemote(list) {
    if (!Array.isArray(list)) throw new Error("data/progress.json não é uma lista de registros.");
    return list.filter(e => e && typeof e === "object" && e.date && e.type);
  }

  function normalizeCache(value) {
    return Array.isArray(value) ? value.filter(e => e && e.date && e.type) : [];
  }

  function sameList(a, b) {
    return JSON.stringify(a.map(entryKey)) === JSON.stringify(b.map(entryKey));
  }

  // ---------- fila de mudanças ----------
  // Cada item da fila é uma "operação":
  //   { op: "add", entry }                  adiciona um registro
  //   { op: "edit", oldKey, entry }         troca o registro de chave oldKey por entry
  //   { op: "delete", key }                 remove o registro de chave key
  function migrateOp(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.op === "delete") return typeof raw.key === "string" ? raw : null;
    if (raw.op === "edit") return raw.entry && raw.entry.date && typeof raw.oldKey === "string" ? raw : null;
    if (raw.op === "add") return raw.entry && raw.entry.date ? raw : null;
    // formato antigo: a fila guardava só os registros novos
    if (raw.date && raw.type && raw.text) return { op: "add", entry: raw };
    return null;
  }

  // Aplica as operações sobre uma lista de registros e devolve a lista nova (sem alterar a original)
  function applyOps(list, ops) {
    let result = list.slice();
    for (const op of ops) {
      if (op.op === "delete") {
        result = result.filter(e => entryKey(e) !== op.key);
      } else if (op.op === "edit") {
        const index = result.findIndex(e => entryKey(e) === op.oldKey);
        const newKey = entryKey(op.entry);
        if (index === -1) {
          // o original já não existe (ex.: apagado em outro aparelho): mantém o texto que você escreveu
          if (!result.some(e => entryKey(e) === newKey)) result.push(op.entry);
        } else if (result.some((e, i) => i !== index && entryKey(e) === newKey)) {
          result.splice(index, 1); // já existe um igual: só tira o antigo
        } else {
          result[index] = op.entry; // troca no mesmo lugar, a ordem não muda
        }
      } else if (!result.some(e => entryKey(e) === entryKey(op.entry))) {
        result.push(op.entry);
      }
    }
    return result;
  }

  function commitMessage(batch) {
    const count = { add: 0, edit: 0, delete: 0 };
    batch.forEach(op => { count[op.op] += 1; });
    if (count.add && !count.edit && !count.delete) {
      return `feat: registrar progresso pelo painel (${count.add} ${count.add === 1 ? "registro" : "registros"})`;
    }
    const parts = [];
    if (count.add) parts.push(`${count.add} ${count.add === 1 ? "adicionado" : "adicionados"}`);
    if (count.edit) parts.push(`${count.edit} ${count.edit === 1 ? "editado" : "editados"}`);
    if (count.delete) parts.push(`${count.delete} ${count.delete === 1 ? "excluído" : "excluídos"}`);
    return `chore: atualizar registros pelo painel (${parts.join(", ")})`;
  }

  // ---------- estado ----------
  let token = lsGet(KEYS.token) || null;
  let remoteEntries = normalizeCache(lsGetJson(KEYS.cache, []));
  let pending = lsGetJson(KEYS.pending, []).map(migrateOp).filter(Boolean);
  let remoteEtag = null;
  let syncing = false;
  let authProblem = false;
  let message = "";
  let queue = Promise.resolve();
  let pollTimer = null;
  const listeners = new Set();

  function computeStatus() {
    if (syncing) return "syncing";
    if (authProblem) return "auth";
    if (pending.length) return "pending";
    return token ? "synced" : "readonly";
  }

  function displayEntries() {
    return applyOps(remoteEntries, pending);
  }

  function snapshot() {
    const entries = displayEntries();
    const remoteKeys = new Set(remoteEntries.map(entryKey));
    return {
      entries,
      status: computeStatus(),
      pendingCount: pending.length,
      // registros que estão na tela mas ainda não chegaram ao GitHub
      pendingKeys: new Set(entries.map(entryKey).filter(key => !remoteKeys.has(key))),
      message,
      hasToken: Boolean(token)
    };
  }

  function emit() {
    const state = snapshot();
    listeners.forEach(fn => { try { fn(state); } catch (err) { console.error(err); } });
  }

  function savePending() { lsSet(KEYS.pending, JSON.stringify(pending)); }
  function saveCache() { lsSet(KEYS.cache, JSON.stringify(remoteEntries)); }

  // ---------- GitHub ----------
  async function ghFetch(url, options = {}) {
    const headers = { Accept: "application/vnd.github+json", ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers, cache: "no-store" });
  }

  async function readJson(response) {
    try { return await response.json(); } catch { return null; }
  }

  function explainFailure(status, body, response) {
    const detail = body && body.message ? ` (${body.message})` : "";
    if (status === 401) return { text: "O token é inválido ou expirou. Conecte de novo.", auth: true };
    if (status === 403 && response && response.headers.get("x-ratelimit-remaining") === "0") {
      return { text: "O GitHub pediu uma pausa (limite de requisições). Tento de novo daqui a pouco.", auth: false };
    }
    if (status === 403 || status === 404) {
      return { text: "O token não tem permissão de escrita neste repositório. Confira o passo a passo.", auth: true };
    }
    return { text: `O GitHub respondeu com erro ${status}${detail}.`, auth: false };
  }

  async function fetchRemote({ useEtag }) {
    const headers = {};
    if (useEtag && remoteEtag) headers["If-None-Match"] = remoteEtag;
    const response = await ghFetch(`${FILE_URL}?ref=${REPO.branch}`, { headers });
    if (response.status === 304) return { status: 304 };
    if (response.status === 404) return { status: 404, response };
    if (!response.ok) return { status: response.status, body: await readJson(response), response };
    const json = await response.json();
    if (json.encoding !== "base64" || typeof json.content !== "string") {
      throw new Error("O arquivo de dados ficou grande demais para a API simples.");
    }
    return {
      status: 200,
      entries: normalizeRemote(JSON.parse(fromBase64(json.content))),
      sha: json.sha,
      etag: response.headers.get("ETag")
    };
  }

  async function fetchStatic() {
    const response = await fetch(`data/progress.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Falha ao carregar data/progress.json (${response.status})`);
    return normalizeRemote(await response.json());
  }

  // ---------- operações (sempre uma de cada vez) ----------
  function enqueue(task) {
    queue = queue.then(task, task);
    return queue;
  }

  function refresh({ force = false } = {}) {
    return enqueue(async () => {
      try {
        if (token) {
          const result = await fetchRemote({ useEtag: !force });
          if (result.status === 200) {
            remoteEntries = result.entries;
            remoteEtag = result.etag;
            saveCache();
            authProblem = false;
            message = "";
          } else if (result.status === 304) {
            authProblem = false;
          } else if (result.status === 404) {
            remoteEntries = [];
            saveCache();
          } else {
            const failure = explainFailure(result.status, result.body, result.response);
            message = failure.text;
            authProblem = failure.auth;
            if (!failure.auth) remoteEntries = await fetchStatic().catch(() => remoteEntries);
          }
        } else {
          remoteEntries = await fetchStatic();
          saveCache();
        }
      } catch (err) {
        // sem internet ou resposta quebrada: segue com o que já está na tela
        message = token ? "Sem conexão com o GitHub no momento." : "";
        console.warn("Não foi possível atualizar os dados:", err);
      }
      emit();
    });
  }

  function sync() {
    return enqueue(async () => {
      if (!pending.length) return { ok: true };
      if (!token) return { ok: false, message: "Conecte o GitHub para enviar as mudanças." };

      syncing = true;
      emit();
      let outcome = { ok: false, message: "Não consegui enviar agora." };
      try {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const latest = await fetchRemote({ useEtag: false });
          let baseSha;
          if (latest.status === 200) {
            remoteEntries = latest.entries;
            baseSha = latest.sha;
          } else if (latest.status === 404) {
            remoteEntries = [];
          } else {
            const failure = explainFailure(latest.status, latest.body, latest.response);
            authProblem = failure.auth;
            message = failure.text;
            outcome = { ok: false, message: failure.text };
            break;
          }

          const batch = pending.slice();
          const next = applyOps(remoteEntries, batch);

          if (sameList(next, remoteEntries)) {
            // nada a mudar no GitHub (já estava assim, ou a mudança se anulou, ex.: adicionou e excluiu)
            pending = pending.filter(op => !batch.includes(op));
            savePending();
            saveCache();
            authProblem = false;
            message = "";
            outcome = { ok: true };
            break;
          }

          const merged = sortForFile(next);
          const body = {
            message: commitMessage(batch),
            content: toBase64(JSON.stringify(merged, null, 2) + "\n"),
            branch: REPO.branch
          };
          if (baseSha) body.sha = baseSha;

          const response = await ghFetch(FILE_URL, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });

          if (response.ok) {
            remoteEntries = merged;
            remoteEtag = null; // o GitHub gerou outro ETag: na próxima leitura buscamos de novo
            pending = pending.filter(op => !batch.includes(op));
            savePending();
            saveCache();
            authProblem = false;
            message = "";
            outcome = { ok: true };
            break;
          }

          if (response.status === 409 && attempt < MAX_ATTEMPTS) continue; // arquivo mudou no meio: busca de novo e refaz

          const failure = explainFailure(response.status, await readJson(response), response);
          authProblem = failure.auth;
          message = failure.text;
          outcome = { ok: false, message: failure.text };
          break;
        }
      } catch (err) {
        console.warn("Falha ao enviar para o GitHub:", err);
        message = "Sem conexão com o GitHub no momento.";
        outcome = { ok: false, message };
      } finally {
        syncing = false;
        emit();
      }
      return outcome;
    });
  }

  // ---------- API pública ----------
  function startSync() {
    return token
      ? sync()
      : Promise.resolve({ ok: false, message: "Conecte o GitHub para enviar as mudanças." });
  }

  function queueOp(op) {
    pending.push(op);
    savePending(); // guardado no navegador antes de qualquer envio
    emit();
    return startSync();
  }

  function add(raw) {
    const entry = cleanEntry(raw);
    const key = entryKey(entry);
    if (displayEntries().some(e => entryKey(e) === key)) {
      throw new Error("Esse registro já existe no painel.");
    }
    return { entry, done: queueOp({ op: "add", entry }) };
  }

  function edit(oldEntry, raw) {
    const entry = cleanEntry(raw);
    const oldKey = entryKey(oldEntry);
    const newKey = entryKey(entry);
    if (newKey === oldKey) return { entry, changed: false, done: Promise.resolve({ ok: true }) };
    if (displayEntries().some(e => entryKey(e) === newKey)) {
      throw new Error("Já existe outro registro igual a esse.");
    }
    return { entry, changed: true, done: queueOp({ op: "edit", oldKey, entry }) };
  }

  function remove(entry) {
    return { done: queueOp({ op: "delete", key: entryKey(entry) }) };
  }

  async function connect(rawToken) {
    const candidate = String(rawToken || "").trim();
    if (!candidate) return { ok: false, message: "Cole o token que você criou no GitHub." };
    const fail = text => ({ ok: false, message: text });
    try {
      const response = await fetch(`${API}/repos/${REPO.owner}/${REPO.repo}`, {
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${candidate}` },
        cache: "no-store"
      });
      if (response.status === 401) return fail("O GitHub não aceitou esse token. Confira se copiou inteiro.");
      if (response.status === 403 || response.status === 404) {
        return fail("Esse token não enxerga o repositório swartz-progress-panel. Em Repository access, marque esse repositório.");
      }
      if (!response.ok) return fail(`O GitHub respondeu com erro ${response.status}.`);
      const repo = await response.json();
      if (repo.permissions && repo.permissions.push === false) {
        return fail("Esse token só consegue ler. Em Permissions → Contents, escolha Read and write.");
      }
    } catch {
      return fail("Não consegui falar com o GitHub. Confira sua internet e tente de novo.");
    }

    token = candidate;
    lsSet(KEYS.token, token);
    authProblem = false;
    message = "";
    remoteEtag = null;
    emit();
    await refresh({ force: true });
    if (pending.length) sync();
    return { ok: true };
  }

  function disconnect() {
    token = null;
    lsDel(KEYS.token);
    remoteEtag = null;
    authProblem = false;
    message = "";
    emit();
  }

  function tick() {
    if (!token) return;
    refresh().then(() => {
      if (pending.length && token && !authProblem) sync();
    });
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => { if (document.visibilityState === "visible") tick(); }, POLL_MS);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tick(); });
    window.addEventListener("online", tick);
  }

  async function init() {
    emit(); // mostra de imediato o que já está guardado neste navegador
    await refresh({ force: true });
    if (token && pending.length) sync();
    startPolling();
  }

  return {
    init,
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); },
    add,
    edit,
    remove,
    sync,
    refresh,
    connect,
    disconnect,
    hasToken: () => Boolean(token),
    entryKey,
    TYPES
  };
})();
