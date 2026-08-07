/* =========================================================================
   Página Situação de Aprendizagem
   -------------------------------------------------------------------------
   Segue a Etapa 2 da MSEP (Estruturação da Situação de Aprendizagem):
     a) Seleção de capacidades e conhecimentos  -> vem do bloco de 60h
     b) Escolha da estratégia desafiadora       -> escolha do professor
     c) Contextualização, desafio e resultados  -> elaborados pela IA
     d..g) Estratégias, recursos, critérios e instrumentos
     h) Detalhamento em etapas de plano de aula
   ========================================================================= */

document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    var esc = PlanoStore.esc;

    var etapaSelecao = document.getElementById('etapaSelecao');
    var areaResumo = document.getElementById('areaResumo');
    var areaSituacao = document.getElementById('areaSituacao');
    var origemGrid = document.getElementById('origemGrid');
    var listaGrupos = document.getElementById('listaGrupos');
    var listaEstrategias = document.getElementById('listaEstrategias');
    var mensagemOrigem = document.getElementById('mensagemOrigem');
    var mensagemGeracao = document.getElementById('mensagemGeracao');

    var btnUsarSessao = document.getElementById('btnUsarSessao');
    var btnImportar = document.getElementById('btnImportar');
    var btnGerar = document.getElementById('btnGerar');
    var btnTrocarPlano = document.getElementById('btnTrocarPlano');
    var inputPlanilha = document.getElementById('planilhaFile');

    var plano = null;
    var grupoSelecionado = null;
    var estrategiaSelecionada = 'situacao-problema';
    var situacao = null;

    // Logotipo institucional usado no cabeçalho do documento
    PlanoStore.carregarLogotipo();

    // ---------------------------------------------------------------------
    // Etapa 1 — origem do plano
    // ---------------------------------------------------------------------

    var planoDaSessao = PlanoStore.carregar();
    if (planoDaSessao) {
        btnUsarSessao.disabled = false;
        btnUsarSessao.textContent = 'Usar "' + (planoDaSessao.identificacao.unidadeCurricular || 'plano da sessão') + '"';
        document.getElementById('cardSessao').classList.add('pronta');
    }

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
            await aplicarPlano(importado);
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
        areaSituacao.innerHTML = '';
        origemGrid.style.display = '';
        areaResumo.innerHTML = '';
        areaResumo.classList.remove('plano-resumo');
        plano = null;
        grupoSelecionado = null;
    });

    /**
     * Aplica o plano carregado e pede ao servidor o agrupamento por 60 horas.
     * @param {object} novoPlano
     */
    async function aplicarPlano(novoPlano) {
        plano = novoPlano;
        PlanoStore.desenharResumo(areaResumo, plano);
        origemGrid.style.display = 'none';
        etapaSelecao.style.display = '';

        listaGrupos.innerHTML = '<div class="carregando">Agrupando os conhecimentos em situações de aprendizagem...</div>';

        try {
            var resposta = await fetch('/api/situacoes/agrupar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plano: plano })
            });
            var corpo = await resposta.json().catch(function () { return {}; });
            if (!resposta.ok || !corpo.success) {
                throw new Error(corpo.error || 'Não foi possível agrupar os conhecimentos.');
            }
            desenharGrupos(corpo.grupos);
        } catch (erro) {
            listaGrupos.innerHTML = '';
            PlanoStore.mensagem(mensagemGeracao, 'erro', erro.message);
        }

        etapaSelecao.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ---------------------------------------------------------------------
    // Etapa 2 — blocos de 60h e estratégia desafiadora
    // ---------------------------------------------------------------------

    /**
     * Desenha a lista de blocos de 60 horas.
     * @param {object[]} grupos
     */
    function desenharGrupos(grupos) {
        if (!grupos || grupos.length === 0) {
            listaGrupos.innerHTML = '<div class="mensagem info">' + Icons.html('informacao') + ' Nenhum bloco de horas foi identificado no plano.</div>';
            return;
        }

        listaGrupos.innerHTML = grupos.map(function (grupo) {
            var conhecimentos = (grupo.conhecimentos || [])
                .map(function (c) { return '• ' + (c || '').split('\n')[0].slice(0, 90); })
                .join('\n');

            return '' +
                '<label class="item-opcao" data-grupo="' + grupo.numero + '">' +
                '<input type="radio" name="grupo" value="' + grupo.numero + '">' +
                '<div class="item-opcao-corpo">' +
                '<div class="item-opcao-titulo">Situação de Aprendizagem ' +
                (grupo.numero < 10 ? '0' + grupo.numero : grupo.numero) +
                '<span class="tag horas">' + grupo.horas + 'h</span>' +
                '<span class="tag">' + grupo.totalCapacidades + ' capacidades</span>' +
                (grupo.horas > 70 ? '<span class="tag alerta">acima de 60h</span>' : '') +
                '</div>' +
                '<div class="item-opcao-meta">' + esc(conhecimentos) + '</div>' +
                '</div>' +
                '</label>';
        }).join('');

        listaGrupos.querySelectorAll('input[name="grupo"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                listaGrupos.querySelectorAll('.item-opcao').forEach(function (el) {
                    el.classList.remove('selecionado');
                });
                radio.closest('.item-opcao').classList.add('selecionado');
                grupoSelecionado = Number(radio.value);
            });
        });

        var primeiro = listaGrupos.querySelector('input[name="grupo"]');
        if (primeiro) {
            primeiro.checked = true;
            primeiro.dispatchEvent(new Event('change'));
        }
    }

    /** Carrega e desenha as quatro estratégias desafiadoras da MSEP. */
    async function carregarEstrategias() {
        try {
            var resposta = await fetch('/api/estrategias-desafiadoras');
            var corpo = await resposta.json();
            if (!corpo.success) return;

            listaEstrategias.innerHTML = corpo.estrategias.map(function (e, i) {
                return '' +
                    '<label class="item-opcao' + (i === 0 ? ' selecionado' : '') + '" data-estrategia="' + esc(e.id) + '">' +
                    '<input type="radio" name="estrategia" value="' + esc(e.id) + '"' + (i === 0 ? ' checked' : '') + '>' +
                    '<div class="item-opcao-corpo">' +
                    '<div class="item-opcao-titulo">' + esc(e.nome) + '</div>' +
                    '<div class="item-opcao-meta">' + esc(e.descricao) + '</div>' +
                    '</div>' +
                    '</label>';
            }).join('');

            listaEstrategias.querySelectorAll('input[name="estrategia"]').forEach(function (radio) {
                radio.addEventListener('change', function () {
                    listaEstrategias.querySelectorAll('.item-opcao').forEach(function (el) {
                        el.classList.remove('selecionado');
                    });
                    radio.closest('.item-opcao').classList.add('selecionado');
                    estrategiaSelecionada = radio.value;
                });
            });
        } catch (e) {
            console.warn('Não foi possível carregar as estratégias desafiadoras.', e);
        }
    }

    carregarEstrategias();

    // ---------------------------------------------------------------------
    // Etapa 3 — elaboração e documento
    // ---------------------------------------------------------------------

    btnGerar.addEventListener('click', async function () {
        if (!grupoSelecionado) {
            PlanoStore.mensagem(mensagemGeracao, 'erro', 'Selecione o bloco de horas da situação de aprendizagem.');
            return;
        }

        var instrucoes = document.getElementById('instrucoes').value.trim();

        btnGerar.disabled = true;
        btnGerar.textContent = 'Elaborando...';
        mensagemGeracao.innerHTML = '';
        areaSituacao.innerHTML =
            '<div class="documento carregando">A IA está elaborando a contextualização, o desafio e os ' +
            'resultados esperados segundo a MSEP. Isso pode demorar alguns instantes.</div>';

        try {
            var resposta = await fetch('/api/situacao-aprendizagem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plano: plano,
                    numeroGrupo: grupoSelecionado,
                    estrategiaId: estrategiaSelecionada,
                    instrucoes: instrucoes
                })
            });

            var corpo = await resposta.json().catch(function () { return {}; });
            if (!resposta.ok || !corpo.success) {
                throw new Error(corpo.error || 'Não foi possível elaborar a situação de aprendizagem.');
            }

            situacao = corpo.situacao;
            desenharSituacao();
        } catch (erro) {
            areaSituacao.innerHTML = '';
            PlanoStore.mensagem(mensagemGeracao, 'erro', erro.message);
        } finally {
            btnGerar.disabled = false;
            btnGerar.textContent = 'Elaborar situação de aprendizagem';
        }
    });

    /** Renderiza o documento da situação de aprendizagem. */
    function desenharSituacao() {
        var ident = situacao.identificacao || {};

        var campo = function (rotulo, valor) {
            return '<div class="campo"><strong>' + esc(rotulo) + '</strong><span>' + esc(valor || '—') + '</span></div>';
        };

        var listaHtml = function (itens) {
            if (!itens || itens.length === 0) return '<p>—</p>';
            return '<ul>' + itens.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
        };

        var paragrafos = function (texto) {
            if (!texto) return '<p>—</p>';
            return String(texto).split(/\n{2,}/).map(function (p) {
                return '<p>' + esc(p.trim()) + '</p>';
            }).join('');
        };

        var opcoes = ['Situação-Problema', 'Estudo de Caso', 'Projeto', 'Pesquisa Aplicada'];
        var escolhida = (situacao.estrategiaDesafiadora || {}).nome;
        var marcadas = opcoes.map(function (o) {
            return (o === escolhida ? '( X ) ' : '(&nbsp;&nbsp;&nbsp;&nbsp;) ') + esc(o);
        }).join('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');

        var etapasHtml = '';
        if (situacao.etapas && situacao.etapas.length) {
            etapasHtml =
                '<h3 class="bloco-titulo">Consolidação do Plano de Aula</h3>' +
                '<table class="tabela-criterios"><thead><tr>' +
                '<th style="width:26%">Etapa</th><th style="width:12%">Carga Horária</th><th>Descrição</th>' +
                '</tr></thead><tbody>' +
                situacao.etapas.map(function (e) {
                    return '<tr><td class="capacidade">' + esc(e.etapa) + '</td>' +
                        '<td class="centro">' + (e.cargaHoraria || 0) + 'h</td>' +
                        '<td>' + esc(e.descricao) + '</td></tr>';
                }).join('') +
                '</tbody></table>';
        }

        var numero = situacao.numero < 10 ? '0' + situacao.numero : situacao.numero;

        areaSituacao.innerHTML =
            '<div class="documento" id="documentoSituacao">' +

            '<div class="documento-cabecalho">' +
            PlanoStore.htmlLogotipo() +
            '<h2>PLANEJAMENTO DA SITUAÇÃO DE APRENDIZAGEM</h2>' +
            '<p>Metodologia SENAI de Educação Profissional</p>' +
            '</div>' +

            '<h3 class="bloco-titulo">Identificação</h3>' +
            '<div class="identificacao">' +
            campo('Unidade Escolar', ident.unidadeEscolar) +
            campo('Curso', ident.curso) +
            campo('Unidade Curricular', ident.unidadeCurricular) +
            campo('Modalidade', ident.modalidade) +
            campo('Carga horária da UC', ident.cargaHorariaTotal) +
            campo('Código da Turma', ident.codigoTurma) +
            campo('Instrutor', ident.instrutor) +
            campo('Situação de Aprendizagem', numero + ' de ' + situacao.totalSituacoes) +
            campo('Carga horária da situação', situacao.cargaHoraria + ' horas') +
            campo('Número de aulas', String(situacao.numeroAulas || '—')) +
            campo('Período', situacao.periodo) +
            '</div>' +

            '<h3 class="bloco-titulo">Título</h3>' +
            '<p><strong>' + esc(situacao.titulo) + '</strong></p>' +

            '<h3 class="bloco-titulo">Estratégia de Aprendizagem Desafiadora</h3>' +
            '<p style="font-family:monospace;font-size:0.95rem;">' + marcadas + '</p>' +

            '<h3 class="bloco-titulo">Capacidades a Serem Desenvolvidas</h3>' +
            listaHtml(situacao.capacidades) +

            '<h3 class="bloco-titulo">Conhecimentos Relacionados</h3>' +
            listaHtml(situacao.conhecimentos) +

            '<h3 class="bloco-titulo">Contextualização</h3>' +
            paragrafos(situacao.contextualizacao) +

            '<h3 class="bloco-titulo">Desafio</h3>' +
            paragrafos(situacao.desafio) +

            '<h3 class="bloco-titulo">Resultados Esperados</h3>' +
            listaHtml(situacao.resultadosEsperados) +

            '<h3 class="bloco-titulo">Estratégias de Ensino e Descrição da Atividade</h3>' +
            listaHtml(situacao.estrategiasEnsino) +

            '<h3 class="bloco-titulo">Recursos Didáticos e Ambientes Pedagógicos</h3>' +
            listaHtml((situacao.recursosDidaticos || []).concat(situacao.ambientesPedagogicos || [])) +

            '<h3 class="bloco-titulo">Critérios de Avaliação</h3>' +
            listaHtml(situacao.criteriosAvaliacao) +

            '<h3 class="bloco-titulo">Instrumentos de Avaliação da Aprendizagem</h3>' +
            listaHtml(situacao.instrumentosAvaliacao) +

            etapasHtml +

            '<p class="legenda" style="margin-top:1.5rem;">Validação: este planejamento deve ser validado pelas ' +
            'Coordenações Técnica e Pedagógica (MSEP 2019, Etapa 3).</p>' +

            '<div class="botoes no-print">' +
            '<button type="button" class="btn btn-primario" id="btnImprimir">' + Icons.html('impressora') + ' Imprimir / Salvar em PDF</button>' +
            '<button type="button" class="btn btn-secundario" id="btnExportar">' + Icons.html('documento') + ' Exportar para Google Docs</button>' +
            '<button type="button" class="btn btn-neutro" id="btnFicha">' + Icons.html('documentoEditar') + ' Gerar ficha deste bloco</button>' +
            '</div>' +
            '<div id="areaExportacao" class="no-print"></div>' +
            '</div>';

        document.getElementById('btnImprimir').addEventListener('click', function () { window.print(); });
        document.getElementById('btnExportar').addEventListener('click', exportar);
        document.getElementById('btnFicha').addEventListener('click', function () {
            // O plano já está em sessionStorage; a página da ficha lê-o de lá
            PlanoStore.guardar(plano);
            window.location.href = '/ficha-observacao';
        });

        areaSituacao.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /** Exporta a situação de aprendizagem para Google Docs. */
    async function exportar() {
        var botao = document.getElementById('btnExportar');
        var area = document.getElementById('areaExportacao');

        botao.disabled = true;
        botao.textContent = 'Criando documento...';
        area.innerHTML = '';

        var titulo = 'Situação de Aprendizagem ' + situacao.numero + ' - ' +
            ((situacao.identificacao && situacao.identificacao.unidadeCurricular) || 'UC');

        try {
            var documento = await PlanoStore.exportarDocumento('situacao', titulo, situacao);
            PlanoStore.desenharLinksExportacao(area, documento);
        } catch (erro) {
            PlanoStore.mensagem(area, 'erro', erro.message);
        } finally {
            botao.disabled = false;
            botao.innerHTML = Icons.html('documento') + ' Exportar para Google Docs';
        }
    }
});
