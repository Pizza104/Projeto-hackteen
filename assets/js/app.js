let valorReceita = [];
let valorDespesas = [];

//variaveis para armazenar as respostas
function adicionarTransacao() {
    const data = document.getElementById("data").value;
    const valorInput = document.getElementById("valor").value;
    const tipo = document.getElementById("tipo").value;
    const descricao = document.getElementById("descricao").value;
    const totalReceitasElem = document.getElementById("total-receitas");
    const totalDespesasElem = document.getElementById("total-despesas");
    const saldoElem = document.getElementById("saldo-resumo");
    const valor = Number(valorInput);
    const saldoContaElem = document.getElementById("saldoConta");

    //verifica se todos os campos foram preenchidos
    if (data === "" || valorInput === "" || tipo === "" || descricao === "") {
        console.log("Preencha todos os campos.");
        return;
    }

    //verifica o tipo de transação
    if (tipo === "receita") {
        valorReceita.push(valor);
    } else {
        valorDespesas.push(valor);
    }

    //soma as despesas, as receitas e o valor total
    let somaReceitas = 0;
    for (let i = 0; i < valorReceita.length; i++) {
        somaReceitas += valorReceita[i];
    }

    let somaDespesas = 0;
    for (let j = 0; j < valorDespesas.length; j++) {
        somaDespesas += valorDespesas[j];
    }

    let saldoTotal = somaReceitas - somaDespesas;

    //atualiza os valores na tela
    totalReceitasElem.textContent = "R$" + somaReceitas;
    totalDespesasElem.textContent = "R$" + somaDespesas;
    saldoElem.textContent = "R$" + saldoTotal;
    saldoContaElem.textContent = "Saldo: R$" + saldoTotal;

    //adiciona a transação na tabela
    const table = document.getElementById("tabela-transacoes").getElementsByTagName("tbody")[0];
    const novalinha = table.insertRow();
    const celldata = novalinha.insertCell(0);
    const celldescricao = novalinha.insertCell(1);
    const celltipo = novalinha.insertCell(2);
    const cellvalor = novalinha.insertCell(3);

    celldata.innerHTML = data;
    celldescricao.innerHTML = descricao;
    celltipo.innerHTML = tipo;
    cellvalor.innerHTML = valor;

    atualizarGrafico();
}



// Inicializar o gráfico após carregar a página
let chart;
function atualizarGrafico() {
    const ctx = document.getElementById("graficoTransacoes").getContext("2d");
    const receitasTotal = valorReceita.reduce((acc, curr) => acc + curr, 0);
    const despesasTotal = valorDespesas.reduce((acc, curr) => acc + curr, 0);

    if (chart) {
        chart.data.datasets[0].data = [receitasTotal, despesasTotal];
        chart.update();
    } else {
        chart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Receitas", "Despesas"],
                datasets: [
                    {
                        data: [receitasTotal, despesasTotal],
                        backgroundColor: ["#4CAF50", "#F44336"],
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: "top",
                    },
                },
            },
        });
    }
}