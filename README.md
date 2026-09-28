# Swartz Progress Panel

Um painel pessoal para registrar evidências reais de progresso.

## Como registrar algo novo

Abra o arquivo:

`data/progress.json`

E adicione um novo bloco seguindo este formato:

```json
{
  "date": "2026-09-28",
  "category": "Python",
  "type": "Aprendizado",
  "text": "Aprendi encapsulamento em Python."
}
```

Tipos disponíveis:
- `Aprendizado`
- `Entrega`
- `Conquista`
- `Projeto`

Depois é só fazer commit.

O dashboard lê os registros automaticamente e atualiza:
- total de evidências;
- sequência de dias;
- aprendizados;
- entregas;
- conquistas;
- projetos;
- evolução mensal;
- áreas em que você mais evoluiu;
- histórico recente.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie estes arquivos para ele.
3. Abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch `main` e a pasta `/root`.
6. Salve.

O GitHub vai fornecer o link do seu painel.
