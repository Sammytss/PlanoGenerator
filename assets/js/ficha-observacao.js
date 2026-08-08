/* =========================================================================
   Página Ficha de Observação
   -------------------------------------------------------------------------
   Fluxo:
     1. Carrega o plano (sessão do navegador ou planilha .xlsx enviada).
     2. O professor escolhe o item avaliado e o método dos critérios.
     3. A IA elabora os critérios segundo a MSEP.
     4. A ficha fica preenchível: o professor marca o desempenho de um aluno,
        vê o conceito calculado e imprime ou exporta o documento.
   ========================================================================= */

SPA.pagina('ficha', function () {
    'use strict';

    var esc = PlanoStore.esc;

    var etapaOrigem = document.getElementById('etapaOrigem');
    var etapaSelecao = document.getElementById('etapaSelecao');
    var areaResumo = document.getElementById('areaResumo');
    var areaFicha = document.getElementById('areaFicha');
    var origemGrid = document.getElementById('origemGrid');
    var listaBlocos = document.getElementById('listaBlocos');
    var mensagemOrigem = document.getElementById('mensagemOrigem');
    var mensagemGeracao = document.getElementById('mensagemGeracao');

    var btnUsarSessao = document.getElementById('btnUsarSessao');
    var btnImportar = document.getElementById('btnImportar');
    var btnGerar = document.getElementById('btnGerar');
    var btnTrocarPlano = document.getElementById('btnTrocarPlano');
    var inputPlanilha = document.getElementById('planilhaFile');

    var plano = null;
    var blocoSelecionado = null;
    var ficha = null;

    // Logotipo institucional usado no cabeçalho da ficha
    PlanoStore.carregarLogotipo();

    // ---------------------------------------------------------------------
    // Etapa 1 — origem do plano
    // ---------------------------------------------------------------------

    var cardSessao = document.getElementById('cardSessao');
    var planoDaSessao = null;

    /**
     * Refresca o cartão do plano da sessão. Corre a cada montagem da vista,
     * porque o utilizador pode ter gerado um plano na página de Planejamento
     * Docente depois de já ter visitado esta.
     */
    function atualizarPlanoDaSessao() {
        planoDaSessao = PlanoStore.carregar();

        if (planoDaSessao) {
            btnUsarSessao.disabled = false;
            btnUsarSessao.textContent =
                'Usar "' + (planoDaSessao.identificacao.unidadeCurricular || 'plano da sessão') + '"';
            if (cardSessao) cardSessao.classList.add('pronta');
        } else {
            btnUsarSessao.disabled = true;
            btnUsarSessao.textContent = 'Nenhum plano nesta sessão';
            if (cardSessao) cardSessao.classList.remove('pronta');
        }
    }

    SPA.aoMontar('ficha', atualizarPlanoDaSessao);

    btnUsarSessao.addEventListener('click', function () {
        if (planoDaSessao) aplicarPlano(planoDaSessao);
    });

    btnImportar.addEventListener('click', async function () {
        var ficheiro = inputPlanilha.files && inputPlanilha.files[0];
        if (!ficheiro) {
            PlanoStore.mensagem(mensagemOrigem, 'erro', 'Selecione o ficheiro .xlsx da planilha de planejamento.');
            return;
        }

        btnImportar.disabled = true;
        btnImportar.textContent = 'Importando...';
        mensagemOrigem.innerHTML = '';

        try {
            var importado = await PlanoStore.importarPlanilha(ficheiro);
            planoDaSessao = importado;
            aplicarPlano(importado);
            PlanoStore.mensagem(mensagemOrigem, 'sucesso', 'Planilha importada com sucesso.');
        } catch (erro) {
            PlanoStore.mensagem(mensagemOrigem, 'erro', erro.message);
        } finally {
            btnImportar.disabled = false;
            btnImportar.textContent = 'Importar planilha';
        }
    });

    btnTrocarPlano.addEventListener('click', function () {
        etapaSelecao.style.display = 'none';
        areaFicha.innerHTML = '';
        origemGrid.style.display = '';
        areaResumo.innerHTML = '';
        areaResumo.classList.remove('plano-resumo');
        plano = null;
        blocoSelecionado = null;
    });

    /**
     * Aplica um plano carregado à interface, avançando para a etapa de seleção.
     * @param {object} novoPlano
     */
    function aplicarPlano(novoPlano) {
        plano = novoPlano;
        PlanoStore.desenharResumo(areaResumo, plano);
        origemGrid.style.display = 'none';
        desenharBlocos();
        etapaSelecao.style.display = '';
        etapaSelecao.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ---------------------------------------------------------------------
    // Etapa 2 — seleção do item
    // ---------------------------------------------------------------------

    /** Desenha a lista de itens do plano, destacando os que pedem ficha. */
    function desenharBlocos() {
        var blocos = plano.blocos || [];

        // Ordena colocando primeiro os que já preveem instrumentos de observação
        var ordenados = blocos.slice().sort(function (a, b) {
            return (b.usaFichaObservacao ? 1 : 0) - (a.usaFichaObservacao ? 1 : 0);
        });

        listaBlocos.innerHTML = ordenados.map(function (bloco, indice) {
            var titulo = (bloco.conhecimento || bloco.oque || 'Item ' + (indice + 1))
                .split('\n')[0]
                .slice(0, 110);

            var etiquetas = '';
            if (bloco.usaFichaObservacao) etiquetas += '<span class="tag ficha">Ficha</span>';
            etiquetas += '<span class="tag horas">' + (bloco.cargaHoraria || 0) + 'h</span>';
            if (!bloco.capacidades || bloco.capacidades.length === 0) {
                etiquetas += '<span class="tag alerta">Sem capacidades</span>';
            }

            var meta =
                'Instrumento previsto: ' + esc((bloco.instrumentos || []).join(' / ') || '—') + '\n' +
                'Capacidades: ' + ((bloco.capacidades || []).length) + '  •  ' +
                'Ambiente: ' + esc(bloco.onde || '—') + '\n' +
                (bloco.pagina ? 'Bloco: ' + esc(bloco.pagina) : '');

            return '' +
                '<label class="item-opcao" data-bloco="' + esc(bloco.id) + '">' +
                '<input type="radio" name="bloco" value="' + esc(bloco.id) + '">' +
                '<div class="item-opcao-corpo">' +
                '<div class="item-opcao-titulo">' + esc(titulo) + etiquetas + '</div>' +
                '<div class="item-opcao-meta">' + meta + '</div>' +
                '</div>' +
                '</label>';
        }).join('');

        listaBlocos.querySelectorAll('input[name="bloco"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                listaBlocos.querySelectorAll('.item-opcao').forEach(function (el) {
                    el.classList.remove('selecionado');
                });
                radio.closest('.item-opcao').classList.add('selecionado');
                blocoSelecionado = (plano.blocos || []).find(function (b) { return b.id === radio.value; });
            });
        });

        // Pré-seleciona o primeiro item que usa ficha de observação
        var preferido = ordenados.find(function (b) { return b.usaFichaObservacao; }) || ordenados[0];
        if (preferido) {
            var radioPreferido = listaBlocos.querySelector('input[value="' + preferido.id + '"]');
            if (radioPreferido) {
                radioPreferido.checked = true;
                radioPreferido.dispatchEvent(new Event('change'));
            }
        }
    }

    // Realce visual da escolha do método
    document.querySelectorAll('input[name="metodo"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            document.querySelectorAll('.item-opcao[data-metodo]').forEach(function (el) {
                el.classList.remove('selecionado');
            });
            radio.closest('.item-opcao').classList.add('selecionado');
        });
    });

    // ---------------------------------------------------------------------
    // Etapa 3 — geração e preenchimento da ficha
    // ---------------------------------------------------------------------

    btnGerar.addEventListener('click', async function () {
        if (!blocoSelecionado) {
            PlanoStore.mensagem(mensagemGeracao, 'erro', 'Selecione um item do planejamento.');
            return;
        }

        var metodo = (document.querySelector('input[name="metodo"]:checked') || {}).value || 'dicotomico';
        var instrucoes = document.getElementById('instrucoes').value.trim();

        btnGerar.disabled = true;
        btnGerar.textContent = 'Elaborando critérios...';
        mensagemGeracao.innerHTML = '';
        areaFicha.innerHTML =
            '<div class="documento carregando">A IA está elaborando os critérios de avaliação segundo a MSEP. ' +
            'Isso pode demorar alguns instantes.</div>';

        try {
            var resposta = await fetch('/api/ficha-observacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bloco: blocoSelecionado,
                    identificacao: plano.identificacao,
                    metodo: metodo,
                    instrucoes: instrucoes
                })
            });

            var corpo = await resposta.json().catch(function () { return {}; });
            if (!resposta.ok || !corpo.success) {
                throw new Error(corpo.error || 'Não foi possível gerar a ficha.');
            }

            ficha = corpo.ficha;
            desenharFicha();
        } catch (erro) {
            areaFicha.innerHTML = '';
            PlanoStore.mensagem(mensagemGeracao, 'erro', erro.message);
        } finally {
            btnGerar.disabled = false;
            btnGerar.textContent = 'Gerar ficha de observação';
        }
    });

    /** Renderiza a ficha preenchível. */
    function desenharFicha() {
        var gradual = ficha.metodo === 'gradual';
        var ident = ficha.identificacao || {};
        var bloco = ficha.bloco || {};

        var campoIdent = function (rotulo, valor) {
            return '<div class="campo"><strong>' + esc(rotulo) + '</strong><span>' + esc(valor || '—') + '</span></div>';
        };

        var cabecalhoTabela = gradual
            ? '<th style="width:22%">Capacidade</th><th>Critério de Avaliação e Rubricas</th>' +
              '<th style="width:11%">Autoavaliação</th><th style="width:11%">Avaliação</th>'
            : '<th style="width:24%">Capacidade</th><th>Critério de Avaliação</th>' +
              '<th style="width:11%">Autoavaliação</th><th style="width:11%">Avaliação</th>';

        var linhas = '';
        (ficha.itens || []).forEach(function (item, indiceItem) {
            item.criterios.forEach(function (criterio, indiceCriterio) {
                var celulaCapacidade = indiceCriterio === 0
                    ? '<td class="capacidade" rowspan="' + item.criterios.length + '">' + esc(item.capacidade) + '</td>'
                    : '';

                var conteudoCriterio = '<div>' + esc(criterio.texto) + '</div>';
                if (gradual && criterio.rubricas) {
                    conteudoCriterio += '<ul class="rubricas">' + criterio.rubricas.map(function (r) {
                        return '<li><strong>' + r.nivel + '</strong> — ' + esc(r.descricao) + '</li>';
                    }).join('') + '</ul>';
                }

                linhas += '<tr data-item="' + indiceItem + '" data-criterio="' + indiceCriterio + '">' +
                    celulaCapacidade +
                    '<td>' + conteudoCriterio + '</td>' +
                    '<td class="centro">' + marcadores(indiceItem, indiceCriterio, 'auto', gradual) + '</td>' +
                    '<td class="centro">' + marcadores(indiceItem, indiceCriterio, 'aval', gradual) + '</td>' +
                    '</tr>';
            });
        });

        areaFicha.innerHTML =
            '<div class="documento" id="documentoFicha">' +

            '<div class="documento-cabecalho">' +
            PlanoStore.htmlLogotipo() +
            '<h2>FICHA DE OBSERVAÇÃO</h2>' +
            '<p>Instrumento de Avaliação da Aprendizagem — Metodologia SENAI de Educação Profissional</p>' +
            '</div>' +

            '<h3 class="bloco-titulo">Identificação</h3>' +
            '<div class="identificacao">' +
            campoIdent('Unidade Escolar', ident.unidadeEscolar) +
            campoIdent('Curso', ident.curso) +
            campoIdent('Unidade Curricular', ident.unidadeCurricular) +
            campoIdent('Modalidade', ident.modalidade) +
            campoIdent('Código da Turma', ident.codigoTurma) +
            campoIdent('Instrutor', ident.instrutor) +
            '</div>' +

            '<div class="campos-aluno">' +
            '<div><label for="alunoNome">Aluno</label><input type="text" id="alunoNome" placeholder="Nome completo do aluno"></div>' +
            '<div><label for="alunoData">Data da observação</label><input type="text" id="alunoData" value="' + hoje() + '"></div>' +
            '<div><label for="alunoAvaliador">Avaliador</label><input type="text" id="alunoAvaliador" value="' + esc(ident.instrutor || '') + '"></div>' +
            '</div>' +

            '<h3 class="bloco-titulo">Atividade Observada</h3>' +
            '<p><strong>' + esc(ficha.titulo) + '</strong></p>' +
            (ficha.descricaoAtividade ? '<p>' + esc(ficha.descricaoAtividade) + '</p>' : '') +
            '<div class="identificacao" style="margin-top:0.8rem;">' +
            campoIdent('Conhecimento', (bloco.conhecimento || '').split('\n')[0]) +
            campoIdent('Carga horária', bloco.cargaHoraria ? bloco.cargaHoraria + ' horas' : '—') +
            campoIdent('Período', bloco.periodo) +
            campoIdent('Ambiente pedagógico', bloco.onde) +
            campoIdent('Instrumento', (bloco.instrumentos || []).join(' / ') || 'Ficha de Observação') +
            campoIdent('Método', gradual ? 'Gradual (rubricas 1 a 4)' : 'Dicotómico (Escala de Cotejo)') +
            '</div>' +

            '<h3 class="bloco-titulo">Critérios de Avaliação</h3>' +
            '<table class="tabela-criterios"><thead><tr>' + cabecalhoTabela + '</tr></thead>' +
            '<tbody>' + linhas + '</tbody></table>' +
            '<p class="legenda">' +
            (gradual
                ? 'Legenda: 1 = Não atingiu · 2 = Atingiu parcialmente · 3 = Atingiu o esperado · 4 = Superou o esperado'
                : 'Legenda: S = Atingiu · N = Não atingiu') +
            '</p>' +

            '<h3 class="bloco-titulo">Resultado da Observação</h3>' +
            '<div id="painelResultado"></div>' +

            '<h3 class="bloco-titulo">Observações e Feedback ao Aluno</h3>' +
            '<textarea id="observacoesFicha" rows="4" placeholder="Aponte as vulnerabilidades identificadas e as orientações para o aluno avançar."></textarea>' +

            '<div class="assinaturas uma">' +
            '<div>Assinatura do Instrutor</div>' +
            '</div>' +

            '<div class="botoes no-print">' +
            '<button type="button" class="btn btn-primario" id="btnImprimir">' + Icons.html('impressora') + ' Imprimir / Salvar em PDF</button>' +
            '<button type="button" class="btn btn-secundario" id="btnExportar">' + Icons.html('documento') + ' Exportar para Google Docs</button>' +
            '<button type="button" class="btn btn-neutro" id="btnLimparMarcacoes">' + Icons.html('borracha') + ' Limpar marcações</button>' +
            '</div>' +
            '<div id="areaExportacao" class="no-print"></div>' +
            '</div>';

        ligarInteracoes();
        atualizarResultado();
        areaFicha.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Constrói os botões de marcação de um critério.
     * @param {number} item Índice do item.
     * @param {number} criterio Índice do critério.
     * @param {'auto'|'aval'} coluna Autoavaliação ou avaliação do docente.
     * @param {boolean} gradual
     * @returns {string} HTML.
     */
    function marcadores(item, criterio, coluna, gradual) {
        var valores = gradual ? ['1', '2', '3', '4'] : ['S', 'N'];
        return '<div class="marcacao">' + valores.map(function (valor) {
            var negativo = !gradual && valor === 'N';
            return '<label class="marca' + (negativo ? ' negativo' : '') + '"' +
                ' data-item="' + item + '" data-criterio="' + criterio + '"' +
                ' data-coluna="' + coluna + '" data-valor="' + valor + '">' + valor + '</label>';
        }).join('') + '</div>';
    }

    /** Liga os eventos da ficha renderizada. */
    function ligarInteracoes() {
        areaFicha.querySelectorAll('.marcacao label').forEach(function (marca) {
            marca.addEventListener('click', function () {
                var item = marca.dataset.item;
                var criterio = marca.dataset.criterio;
                var coluna = marca.dataset.coluna;
                var jaMarcado = marca.classList.contains('marcado');

                // Só um valor por célula
                areaFicha.querySelectorAll(
                    '.marcacao label[data-item="' + item + '"][data-criterio="' + criterio + '"][data-coluna="' + coluna + '"]'
                ).forEach(function (irma) {
                    irma.classList.remove('marcado');
                });

                if (!jaMarcado) marca.classList.add('marcado');

                registarMarcacao(Number(item), Number(criterio), coluna, jaMarcado ? '' : marca.dataset.valor);
                atualizarResultado();
            });
        });

        document.getElementById('btnImprimir').addEventListener('click', function () {
            window.print();
        });

        document.getElementById('btnLimparMarcacoes').addEventListener('click', function () {
            areaFicha.querySelectorAll('.marcacao label').forEach(function (m) { m.classList.remove('marcado'); });
            (ficha.itens || []).forEach(function (item) {
                item.criterios.forEach(function (c) {
                    c.autoavaliacao = '';
                    c.avaliacao = '';
                });
            });
            atualizarResultado();
        });

        document.getElementById('btnExportar').addEventListener('click', exportar);
    }

    /**
     * Guarda a marcação no objeto da ficha.
     * @param {number} item
     * @param {number} criterio
     * @param {'auto'|'aval'} coluna
     * @param {string} valor
     */
    function registarMarcacao(item, criterio, coluna, valor) {
        var alvo = ficha.itens[item] && ficha.itens[item].criterios[criterio];
        if (!alvo) return;
        if (coluna === 'auto') alvo.autoavaliacao = valor;
        else alvo.avaliacao = valor;
    }

    /**
     * Recalcula o aproveitamento e o conceito conforme a escala da MSEP.
     * Dicotómico: percentagem de critérios respondidos com "S".
     * Gradual: soma dos níveis atingidos sobre o máximo possível (4 por critério).
     */
    function atualizarResultado() {
        var gradual = ficha.metodo === 'gradual';
        var total = 0;
        var pontos = 0;
        var avaliados = 0;

        (ficha.itens || []).forEach(function (item) {
            item.criterios.forEach(function (c) {
                total += 1;
                var valor = c.avaliacao;
                if (!valor) return;
                avaliados += 1;
                if (gradual) pontos += Number(valor) || 0;
                else if (valor === 'S') pontos += 1;
            });
        });

        var maximo = gradual ? total * 4 : total;
        var percentual = maximo > 0 ? Math.round((pontos / maximo) * 100) : 0;

        var conceito = ficha.escalaConceitos.find(function (c) { return percentual >= c.minimo; })
            || ficha.escalaConceitos[ficha.escalaConceitos.length - 1];

        ficha.resultado = {
            atingidos: pontos,
            total: maximo,
            avaliados: avaliados,
            percentual: percentual,
            conceito: conceito.conceito,
            conceitoDescricao: conceito.descricao
        };

        var painel = document.getElementById('painelResultado');
        if (!painel) return;

        painel.innerHTML =
            '<div class="resultado-painel">' +
            '<div class="resultado-item"><div class="valor">' + avaliados + '/' + total + '</div>' +
            '<div class="rotulo">Critérios avaliados</div></div>' +
            '<div class="resultado-item"><div class="valor">' + pontos + '/' + maximo + '</div>' +
            '<div class="rotulo">' + (gradual ? 'Pontos (níveis)' : 'Critérios atingidos') + '</div></div>' +
            '<div class="resultado-item"><div class="valor">' + percentual + '%</div>' +
            '<div class="rotulo">Aproveitamento</div></div>' +
            '<div class="resultado-item"><div class="valor">' + conceito.conceito + '</div>' +
            '<div class="rotulo">Conceito</div></div>' +
            '</div>' +
            '<p class="conceito-descricao">' + esc(conceito.descricao) + '</p>' +
            (avaliados < total
                ? '<p class="legenda">' + Icons.html('aviso') + ' Ainda faltam ' + (total - avaliados) +
                  ' critério(s) por avaliar. O conceito considera todos os critérios da ficha.</p>'
                : '');
    }

    /** Exporta a ficha preenchida para Google Docs. */
    async function exportar() {
        var botao = document.getElementById('btnExportar');
        var area = document.getElementById('areaExportacao');

        botao.disabled = true;
        botao.textContent = 'Criando documento...';
        area.innerHTML = '';

        var conteudo = JSON.parse(JSON.stringify(ficha));
        conteudo.aluno = {
            nome: document.getElementById('alunoNome').value.trim(),
            data: document.getElementById('alunoData').value.trim(),
            avaliador: document.getElementById('alunoAvaliador').value.trim()
        };
        conteudo.observacoes = document.getElementById('observacoesFicha').value.trim();

        var titulo = 'Ficha de Observação - ' +
            (conteudo.aluno.nome || 'Aluno') + ' - ' +
            ((ficha.identificacao && ficha.identificacao.unidadeCurricular) || 'UC');

        try {
            var documento = await PlanoStore.exportarDocumento('ficha', titulo, conteudo);
            PlanoStore.desenharLinksExportacao(area, documento);
        } catch (erro) {
            PlanoStore.mensagem(area, 'erro', erro.message);
        } finally {
            botao.disabled = false;
            botao.innerHTML = Icons.html('documento') + ' Exportar para Google Docs';
        }
    }

    /** @returns {string} Data de hoje no formato dd/mm/aaaa. */
    function hoje() {
        return new Date().toLocaleDateString('pt-BR');
    }
});
