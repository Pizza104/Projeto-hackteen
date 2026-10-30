# Projeto Hackteen — Meu Bolso

Aplicação estática de controle financeiro pessoal, feita com HTML, CSS, Bootstrap 5 e Chart.js.

## Como executar

Sirva a pasta por HTTPS ou em `localhost` (necessário para a API de criptografia do navegador usada pelo acesso local):

```bash
python3 -m http.server 8000
```

Acesse `http://localhost:8000`.

## Recursos

- Cadastro e login de perfis locais, com dados separados por perfil neste navegador.
- Cadastro de receitas e despesas com categoria, data e observação opcional.
- Resumo mensal de receitas, despesas e resultado líquido (receitas menos despesas).
- Edição e exclusão de lançamentos, filtro por mês, tipo e categoria e busca por descrição/observação.
- Gráfico mensal e exportação CSV dos registros filtrados.
- Persistência local por perfil e migração dos lançamentos da versão anterior quando o primeiro perfil é criado.

## Limites importantes

O acesso é uma demonstração educativa, não um sistema de autenticação seguro: perfis e registros permanecem no armazenamento do próprio navegador, não há servidor, sincronização entre dispositivos nem recuperação de senha. A senha é transformada localmente com PBKDF2 para fins didáticos, mas isso não protege os dados contra quem controla o navegador ou o dispositivo. Não use senha real, dados bancários ou informações sensíveis. Limpar os dados do navegador remove perfis e lançamentos.

O termo “lucro” não é um tipo de lançamento nesta versão. O aplicativo calcula e mostra o resultado líquido — receitas menos despesas —, que pode ser positivo (sobra/lucro) ou negativo (déficit).
