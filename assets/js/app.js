(() => {
  "use strict";

  const KEYS = {
    profiles: "hackteen-financas-perfis-v1",
    session: "hackteen-financas-sessao-v1",
    legacy: "hackteen-financas-transacoes-v1",
  };
  const CATEGORIES = {
    receita: ["Salário", "Vendas", "Serviços", "Renda extra", "Reembolso", "Outros"],
    despesa: ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Contas", "Lazer", "Compras", "Outros"],
  };
  const ALL_CATEGORIES = [...new Set([...CATEGORIES.receita, ...CATEGORIES.despesa])];
  const elements = {
    access: document.querySelector("#acesso"),
    app: document.querySelector("#aplicativo"),
    tabLogin: document.querySelector("#tab-entrar"),
    tabRegister: document.querySelector("#tab-cadastro"),
    loginForm: document.querySelector("#form-entrar"),
    registerForm: document.querySelector("#form-cadastro"),
    loginEmail: document.querySelector("#login-email"),
    loginPassword: document.querySelector("#login-senha"),
    registerName: document.querySelector("#cadastro-nome"),
    registerEmail: document.querySelector("#cadastro-email"),
    registerPassword: document.querySelector("#cadastro-senha"),
    authStatus: document.querySelector("#auth-status"),
    currentUser: document.querySelector("#usuario-atual"),
    logout: document.querySelector("#sair"),
    form: document.querySelector("#form-transacao"),
    description: document.querySelector("#descricao"),
    amount: document.querySelector("#valor"),
    type: document.querySelector("#tipo"),
    category: document.querySelector("#categoria"),
    date: document.querySelector("#data"),
    note: document.querySelector("#observacao"),
    saveButton: document.querySelector("#salvar-transacao"),
    cancelEdit: document.querySelector("#cancelar-edicao"),
    formEyebrow: document.querySelector("#rotulo-formulario"),
    formTitle: document.querySelector("#titulo-formulario"),
    month: document.querySelector("#filtro-mes"),
    typeFilter: document.querySelector("#filtro-tipo"),
    categoryFilter: document.querySelector("#filtro-categoria"),
    search: document.querySelector("#busca-transacao"),
    rows: document.querySelector("#tabela-transacoes"),
    income: document.querySelector("#total-receitas"),
    expense: document.querySelector("#total-despesas"),
    balance: document.querySelector("#saldo-resumo"),
    count: document.querySelector("#contador-transacoes"),
    chartMonth: document.querySelector("#rotulo-mes-grafico"),
    empty: document.querySelector("#estado-vazio"),
    chartCanvas: document.querySelector("#graficoTransacoes"),
    chartEmpty: document.querySelector("#estado-grafico"),
    status: document.querySelector("#mensagem-status"),
    exportButton: document.querySelector("#exportar-csv"),
    year: document.querySelector("#ano-atual"),
  };

  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
  let profiles = loadProfiles();
  let activeProfile = null;
  let transactions = [];
  let chart = null;
  let editId = null;
  let statusTimer;

  function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function today() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1000) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function isValidTransaction(item) {
    return Boolean(
      item &&
        typeof item.id === "string" &&
        typeof item.description === "string" &&
        item.description.trim().length > 0 &&
        item.description.length <= 80 &&
        Number.isSafeInteger(item.amountCents) &&
        item.amountCents > 0 &&
        (item.type === "receita" || item.type === "despesa") &&
        isValidDate(item.date),
    );
  }

  function loadProfiles() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEYS.profiles) || "[]");
      return Array.isArray(stored)
        ? stored.filter(
            (profile) =>
              profile &&
              typeof profile.id === "string" &&
              typeof profile.name === "string" &&
              typeof profile.email === "string" &&
              typeof profile.salt === "string" &&
              typeof profile.verifier === "string",
          )
        : [];
    } catch (error) {
      return [];
    }
  }

  function saveProfiles() {
    try {
      localStorage.setItem(KEYS.profiles, JSON.stringify(profiles));
      return true;
    } catch (error) {
      showAuthStatus("O navegador não conseguiu criar o perfil. Verifique o espaço disponível.", "warning");
      return false;
    }
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function base64ToBytes(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  async function hashPassword(password, saltBytes) {
    if (!window.crypto?.subtle || !window.crypto?.getRandomValues) {
      throw new Error("A autenticação de demonstração requer HTTPS ou um endereço localhost.");
    }
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const derivedBits = await window.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: saltBytes, iterations: 120000, hash: "SHA-256" },
      keyMaterial,
      256,
    );
    return new Uint8Array(derivedBits);
  }

  function constantTimeEqual(first, second) {
    if (first.length !== second.length) return false;
    let difference = 0;
    for (let index = 0; index < first.length; index += 1) difference |= first[index] ^ second[index];
    return difference === 0;
  }

  function showAuthStatus(message, kind = "danger") {
    window.clearTimeout(statusTimer);
    elements.authStatus.textContent = message;
    elements.authStatus.className = `alert alert-${kind}`;
  }

  function showStatus(message, kind = "success") {
    if (!elements.status) return;
    window.clearTimeout(statusTimer);
    elements.status.textContent = message;
    elements.status.className = `alert alert-${kind}`;
    statusTimer = window.setTimeout(() => elements.status.classList.add("d-none"), 6000);
  }

  function showAuth() {
    activeProfile = null;
    elements.app.classList.add("d-none");
    elements.access.classList.remove("d-none");
    elements.loginEmail.focus();
  }

  function profileStorageKey(profileId) {
    return `hackteen-financas-dados-${profileId}`;
  }

  function migrateLegacyTransactions() {
    try {
      const old = JSON.parse(localStorage.getItem(KEYS.legacy) || "null");
      if (!Array.isArray(old)) return [];
      const migrated = old.filter(isValidTransaction).map((item) => ({
        ...item,
        category: item.type === "receita" ? "Renda extra" : "Outros",
        note: "",
      }));
      localStorage.removeItem(KEYS.legacy);
      return migrated;
    } catch (error) {
      return [];
    }
  }

  function openProfile(profile) {
    activeProfile = profile;
    try {
      const saved = JSON.parse(localStorage.getItem(profileStorageKey(profile.id)) || "[]");
      transactions = Array.isArray(saved)
        ? saved.filter(isValidTransaction).map((item) => ({
            ...item,
            category: ALL_CATEGORIES.includes(item.category) ? item.category : "Outros",
            note: typeof item.note === "string" ? item.note.slice(0, 160) : "",
          }))
        : [];
    } catch (error) {
      transactions = [];
    }

    try {
      sessionStorage.setItem(KEYS.session, profile.id);
    } catch (error) {
      showAuthStatus("O navegador bloqueou a sessão local. Confira as permissões do site.", "warning");
      showAuth();
      return;
    }

    elements.access.classList.add("d-none");
    elements.app.classList.remove("d-none");
    elements.currentUser.textContent = `Olá, ${profile.name}`;
    elements.year.textContent = new Date().getFullYear();
    elements.month.value = currentMonth();
    elements.date.value = today();
    elements.form.reset();
    elements.form.classList.remove("was-validated");
    elements.type.value = "receita";
    populateCategories();
    refreshCategoryFilter();
    resetEditing();
    render();
    elements.description.focus();
  }

  function persistTransactions() {
    try {
      localStorage.setItem(profileStorageKey(activeProfile.id), JSON.stringify(transactions));
      return true;
    } catch (error) {
      showStatus("Não foi possível salvar os dados no navegador. Confira o espaço disponível.", "warning");
      return false;
    }
  }

  function monthLabel(month) {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, monthNumber - 1, 1)),
    );
  }

  function formatDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
  }

  function selectedTransactions() {
    const month = elements.month.value || currentMonth();
    const type = elements.typeFilter.value;
    const category = elements.categoryFilter.value;
    const query = elements.search.value.trim().toLocaleLowerCase("pt-BR");
    return transactions
      .filter((item) => {
        if (item.date.slice(0, 7) !== month) return false;
        if (type !== "todos" && item.type !== type) return false;
        if (category !== "todas" && item.category !== category) return false;
        if (query && !`${item.description} ${item.note}`.toLocaleLowerCase("pt-BR").includes(query)) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  function monthlyTransactions() {
    const month = elements.month.value || currentMonth();
    return transactions.filter((item) => item.date.slice(0, 7) === month);
  }

  function addCell(row, text, className) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text;
    row.appendChild(cell);
    return cell;
  }

  function renderRows(items) {
    elements.rows.replaceChildren();
    if (items.length === 0) {
      elements.rows.appendChild(elements.empty);
      return;
    }

    for (const item of items) {
      const row = document.createElement("tr");
      addCell(row, formatDate(item.date), "transaction-date");
      const descriptionCell = addCell(row, item.description, "transaction-description");
      if (item.note) {
        const note = document.createElement("span");
        note.className = "transaction-note";
        note.textContent = item.note;
        descriptionCell.appendChild(document.createElement("br"));
        descriptionCell.appendChild(note);
      }
      addCell(row, item.category || "Outros", "transaction-category");

      const typeCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `type-badge ${item.type === "receita" ? "type-income" : "type-expense"}`;
      badge.textContent = item.type === "receita" ? "Receita" : "Despesa";
      typeCell.appendChild(badge);
      row.appendChild(typeCell);

      const sign = item.type === "receita" ? "+ " : "− ";
      addCell(
        row,
        `${sign}${currency.format(item.amountCents / 100)}`,
        `transaction-amount text-end ${item.type === "receita" ? "income-value" : "expense-value"}`,
      );

      const actions = document.createElement("td");
      actions.className = "text-end text-nowrap";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "btn-row-action btn-edit";
      editButton.textContent = "Editar";
      editButton.setAttribute("aria-label", `Editar lançamento: ${item.description}`);
      editButton.addEventListener("click", () => beginEditing(item));
      actions.appendChild(editButton);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "btn-delete";
      deleteButton.setAttribute("aria-label", `Excluir lançamento: ${item.description}`);
      deleteButton.title = "Excluir lançamento";
      deleteButton.textContent = "×";
      deleteButton.addEventListener("click", () => removeTransaction(item.id));
      actions.appendChild(deleteButton);
      row.appendChild(actions);
      elements.rows.appendChild(row);
    }
  }

  function updateChart(incomeCents, expenseCents, hasTransactions) {
    elements.chartEmpty.classList.toggle("d-none", hasTransactions);
    elements.chartCanvas.classList.toggle("d-none", !hasTransactions);
    if (!hasTransactions || typeof Chart === "undefined") {
      if (chart) {
        chart.destroy();
        chart = null;
      }
      if (hasTransactions && typeof Chart === "undefined") {
        elements.chartEmpty.classList.remove("d-none");
        elements.chartEmpty.querySelector("p").textContent =
          "O gráfico não carregou. Confira sua conexão com a internet.";
      }
      return;
    }

    const values = [incomeCents / 100, expenseCents / 100];
    if (!chart) {
      chart = new Chart(elements.chartCanvas, {
        type: "doughnut",
        data: {
          labels: ["Receitas", "Despesas"],
          datasets: [{ data: values, backgroundColor: ["#18815f", "#dc625e"], borderWidth: 0, hoverOffset: 5 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (context) => `${context.label}: ${currency.format(context.raw)}` } },
          },
        },
      });
    } else {
      chart.data.datasets[0].data = values;
      chart.update();
    }
  }

  function render() {
    const monthly = monthlyTransactions();
    const visible = selectedTransactions();
    const incomeCents = monthly.reduce((total, item) => total + (item.type === "receita" ? item.amountCents : 0), 0);
    const expenseCents = monthly.reduce((total, item) => total + (item.type === "despesa" ? item.amountCents : 0), 0);
    const balanceCents = incomeCents - expenseCents;
    elements.income.textContent = currency.format(incomeCents / 100);
    elements.expense.textContent = currency.format(expenseCents / 100);
    elements.balance.textContent = currency.format(balanceCents / 100);
    elements.balance.classList.toggle("income-value", balanceCents > 0);
    elements.balance.classList.toggle("expense-value", balanceCents < 0);

    const period = monthLabel(elements.month.value || currentMonth());
    elements.chartMonth.textContent = `${period.charAt(0).toLocaleUpperCase("pt-BR")}${period.slice(1)}`;
    elements.count.textContent = `${visible.length} ${visible.length === 1 ? "lançamento exibido" : "lançamentos exibidos"} de ${monthly.length}`;
    renderRows(visible);
    updateChart(incomeCents, expenseCents, monthly.length > 0);
  }

  function populateCategories(selected = "") {
    const type = elements.type.value;
    const options = CATEGORIES[type];
    elements.category.replaceChildren();
    for (const category of options) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      elements.category.appendChild(option);
    }
    if (options.includes(selected)) elements.category.value = selected;
  }

  function refreshCategoryFilter() {
    const previous = elements.categoryFilter.value;
    elements.categoryFilter.replaceChildren();
    const allOption = document.createElement("option");
    allOption.value = "todas";
    allOption.textContent = "Todas";
    elements.categoryFilter.appendChild(allOption);
    for (const category of ALL_CATEGORIES) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      elements.categoryFilter.appendChild(option);
    }
    if ([...elements.categoryFilter.options].some((option) => option.value === previous)) {
      elements.categoryFilter.value = previous;
    }
  }

  function beginEditing(item) {
    editId = item.id;
    elements.description.value = item.description;
    elements.amount.value = (item.amountCents / 100).toFixed(2);
    elements.type.value = item.type;
    populateCategories(item.category);
    elements.date.value = item.date;
    elements.note.value = item.note || "";
    elements.month.value = item.date.slice(0, 7);
    elements.form.classList.remove("was-validated");
    elements.formEyebrow.textContent = "Editar lançamento";
    elements.formTitle.textContent = "Atualize os detalhes";
    elements.saveButton.textContent = "Salvar alterações";
    elements.cancelEdit.classList.remove("d-none");
    elements.description.focus();
    render();
    elements.form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetEditing() {
    editId = null;
    elements.form.reset();
    elements.form.classList.remove("was-validated");
    elements.type.value = "receita";
    populateCategories();
    elements.date.value = today();
    elements.formEyebrow.textContent = "Novo lançamento";
    elements.formTitle.textContent = "Adicione à sua planilha";
    elements.saveButton.replaceChildren(
      Object.assign(document.createElement("span"), { "aria-hidden": "true", textContent: "+" }),
      document.createTextNode(" Adicionar lançamento"),
    );
    elements.cancelEdit.classList.add("d-none");
  }

  function submitTransaction(event) {
    event.preventDefault();
    elements.form.classList.add("was-validated");
    if (!elements.form.checkValidity()) {
      elements.form.querySelector(":invalid")?.focus();
      return;
    }

    const description = elements.description.value.trim();
    const amount = Number(elements.amount.value);
    const amountCents = Math.round(amount * 100);
    const date = elements.date.value;
    const type = elements.type.value;
    const category = elements.category.value;
    const note = elements.note.value.trim();
    if (
      !description ||
      description.length > 80 ||
      !Number.isFinite(amount) ||
      !Number.isSafeInteger(amountCents) ||
      amountCents < 1 ||
      !isValidDate(date) ||
      !CATEGORIES[type]?.includes(category) ||
      note.length > 160
    ) {
      showStatus("Confira a descrição, o valor, a categoria e a data.", "danger");
      return;
    }

    const wasEditing = Boolean(editId);
    const item = {
      id:
        editId ||
        (typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      description,
      amountCents,
      type,
      category,
      date,
      note,
    };
    if (editId) {
      transactions = transactions.map((current) => (current.id === editId ? item : current));
    } else {
      transactions.push(item);
    }
    const saved = persistTransactions();
    elements.month.value = date.slice(0, 7);
    resetEditing();
    refreshCategoryFilter();
    render();
    showStatus(
      saved
        ? wasEditing
          ? "Alterações salvas."
          : "Lançamento adicionado à planilha."
        : "Alteração feita nesta sessão, mas não foi salva no navegador.",
      saved ? "success" : "warning",
    );
  }

  function removeTransaction(id) {
    const item = transactions.find((current) => current.id === id);
    if (!item || !window.confirm(`Excluir “${item.description}” da planilha?`)) return;
    transactions = transactions.filter((current) => current.id !== id);
    if (editId === id) resetEditing();
    const saved = persistTransactions();
    refreshCategoryFilter();
    render();
    showStatus(
      saved ? "Lançamento excluído." : "Excluído nesta sessão, mas não foi salvo no navegador.",
      saved ? "secondary" : "warning",
    );
  }

  function csvCell(value) {
    let text = String(value);
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    const items = selectedTransactions();
    if (items.length === 0) {
      showStatus("Não há lançamentos com estes filtros para exportar.", "warning");
      return;
    }
    const data = [["Data", "Descrição", "Categoria", "Tipo", "Valor (R$)", "Observação"]];
    for (const item of items) {
      data.push([
        formatDate(item.date),
        item.description,
        item.category || "Outros",
        item.type === "receita" ? "Receita" : "Despesa",
        (item.amountCents / 100).toFixed(2),
        item.note || "",
      ]);
    }
    const content = `\uFEFF${data.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `meu-bolso-${elements.month.value || currentMonth()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus("Planilha CSV exportada com os filtros atuais.");
  }

  function setAuthTab(tab) {
    const register = tab === "register";
    elements.tabLogin.classList.toggle("active", !register);
    elements.tabRegister.classList.toggle("active", register);
    elements.tabLogin.setAttribute("aria-selected", String(!register));
    elements.tabRegister.setAttribute("aria-selected", String(register));
    elements.loginForm.classList.toggle("d-none", register);
    elements.registerForm.classList.toggle("d-none", !register);
    elements.authStatus.classList.add("d-none");
    (register ? elements.registerName : elements.loginEmail).focus();
  }

  async function registerProfile(event) {
    event.preventDefault();
    elements.registerForm.classList.add("was-validated");
    if (!elements.registerForm.checkValidity()) {
      elements.registerForm.querySelector(":invalid")?.focus();
      return;
    }
    const name = elements.registerName.value.trim();
    const email = elements.registerEmail.value.trim().toLocaleLowerCase("pt-BR");
    const password = elements.registerPassword.value;
    if (!name || name.length > 50 || profiles.some((profile) => profile.email === email)) {
      showAuthStatus(
        profiles.some((profile) => profile.email === email)
          ? "Já existe um perfil com esse e-mail neste navegador. Entre pela aba Entrar."
          : "Confira o nome do perfil.",
      );
      return;
    }

    try {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const verifier = await hashPassword(password, salt);
      const profile = {
        id:
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        email,
        salt: bytesToBase64(salt),
        verifier: bytesToBase64(verifier),
      };
      const isFirstProfile = profiles.length === 0;
      profiles.push(profile);
      if (!saveProfiles()) {
        profiles = profiles.filter((item) => item.id !== profile.id);
        return;
      }
      if (isFirstProfile) {
        const legacy = migrateLegacyTransactions();
        if (legacy.length > 0) localStorage.setItem(profileStorageKey(profile.id), JSON.stringify(legacy));
      }
      elements.registerForm.reset();
      elements.registerForm.classList.remove("was-validated");
      openProfile(profile);
      showStatus("Perfil local criado. Lembre-se: ele existe apenas neste navegador.", "info");
    } catch (error) {
      showAuthStatus(error.message || "Não foi possível criar o perfil neste navegador.", "warning");
    }
  }

  async function login(event) {
    event.preventDefault();
    elements.loginForm.classList.add("was-validated");
    if (!elements.loginForm.checkValidity()) {
      elements.loginForm.querySelector(":invalid")?.focus();
      return;
    }
    const email = elements.loginEmail.value.trim().toLocaleLowerCase("pt-BR");
    const password = elements.loginPassword.value;
    const profile = profiles.find((item) => item.email === email);
    if (!profile) {
      showAuthStatus("Perfil não encontrado neste navegador. Confira o e-mail ou crie um perfil.");
      return;
    }
    try {
      const candidate = await hashPassword(password, base64ToBytes(profile.salt));
      if (!constantTimeEqual(candidate, base64ToBytes(profile.verifier))) {
        showAuthStatus("Senha incorreta. Neste protótipo não existe recuperação de senha.");
        return;
      }
      elements.loginForm.reset();
      elements.loginForm.classList.remove("was-validated");
      openProfile(profile);
    } catch (error) {
      showAuthStatus(error.message || "Não foi possível verificar o acesso.", "warning");
    }
  }

  function logout() {
    try {
      sessionStorage.removeItem(KEYS.session);
    } catch (error) {
      // O app ainda é fechado nesta página, mesmo que o navegador bloqueie sessionStorage.
    }
    transactions = [];
    if (chart) {
      chart.destroy();
      chart = null;
    }
    elements.authStatus.classList.add("d-none");
    elements.loginForm.reset();
    showAuth();
    setAuthTab("login");
  }

  elements.tabLogin.addEventListener("click", () => setAuthTab("login"));
  elements.tabRegister.addEventListener("click", () => setAuthTab("register"));
  elements.loginForm.addEventListener("submit", login);
  elements.registerForm.addEventListener("submit", registerProfile);
  elements.logout.addEventListener("click", logout);
  elements.form.addEventListener("submit", submitTransaction);
  elements.type.addEventListener("change", () => populateCategories());
  elements.cancelEdit.addEventListener("click", () => resetEditing());
  elements.month.addEventListener("change", render);
  elements.typeFilter.addEventListener("change", render);
  elements.categoryFilter.addEventListener("change", render);
  elements.search.addEventListener("input", render);
  elements.exportButton.addEventListener("click", exportCsv);

  try {
    const sessionId = sessionStorage.getItem(KEYS.session);
    const rememberedProfile = profiles.find((profile) => profile.id === sessionId);
    if (rememberedProfile) {
      openProfile(rememberedProfile);
    } else {
      sessionStorage.removeItem(KEYS.session);
      showAuth();
    }
  } catch (error) {
    showAuth();
  }
})();
