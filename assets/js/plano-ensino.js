/* =========================================================================
   Página Plano de Ensino (FO-178)
   -------------------------------------------------------------------------
   Monta o formulário FO-178 revisão 05 a partir do planejamento já elaborado
   e exporta-o em .docx sobre o próprio formulário oficial, preservando o
   cabeçalho de documento controlado e o logotipo.

   É um documento por Unidade Curricular. Quando a UC tem mais do que uma
   situação de aprendizagem, o bloco descritivo do formulário (estratégia
   desafiadora, contextualização, desafio e resultados esperados) repete-se uma
   vez por situação, antes da tabela de aulas, que cobre a UC inteira.

   Os campos que a IA elabora são editáveis nesta página: o FO-178 é um
   documento controlado que segue para a área educacional, e Função, Subfunção
   e Objetivo Geral não existem em nenhum plano de curso — são propostas.
   ========================================================================= */

SPA.pagina('planoEnsino', function () {
    'use strict';

    var esc = PlanoStore.esc;

    var etapaElaboracao = document.getElementById('etapaElaboracao');
    var areaResumo = document.getElementById('areaResumo');
    var areaPlanoEnsino = document.getElementById('areaPlanoEnsino');
    var origemGrid = document.getElementById('origemGrid');
    var avisoSituacoes = document.getElementById('avisoSituacoes');
    var mensagemOrigem = document.getElementById('mensagemOrigem');
    var mensagemGeracao = document.getElementById('mensagemGeracao');

    var btnUsarSessao = document.getElementById('btnUsarSessao');
    var btnImportar = document.getElementById('btnImportar');
    var btnElaborar = document.getElementById('btnElaborar');
    var btnTrocarPlano = document.getElementById('btnTrocarPlano');
    var inputPlanilha = document.getElementById('planilhaFile');
    var inputInstrucoes = document.getElementById('instrucoes');

    var plano = null;
    var planoEnsino = null;

    PlanoStore.carregarLogotipo();

    // ---------------------------------------------------------------------
    // Etapa 1 — origem do plano
    // ---------------------------------------------------------------------

    var cardSessao = document.getElementById('cardSessao');
    var planoDaSessao = null;

    /**
     * Refresca o cartão do plano da sessão. Corre a cada montagem da vista,
     * porque o docente pode ter gerado o plano depois de já ter visitado esta
     * página.
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

        // As situações podem ter sido elaboradas entretanto, noutra página.
        if (plano) desenharAvisoSituacoes();
    }

    SPA.aoMontar('planoEnsino', atualizarPlanoDaSessao);

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
        etapaElaboracao.style.display = 'none';
        areaPlanoEnsino.innerHTML = '';
        origemGrid.style.display = '';
        areaResumo.innerHTML = '';
        areaResumo.classList.remove('plano-resumo');
        plano = null;
        planoEnsino = null;
    });

    /**
     * Aplica o plano carregado e avança para a etapa de elaboração.
     * @param {object} novoPlano
     */
    function aplicarPlano(novoPlano) {
        plano = novoPlano;
        PlanoStore.desenharResumo(areaResumo, plano);
        origemGrid.style.display = 'none';
        etapaElaboracao.style.display = '';
        desenharAvisoSituacoes();

        // Nas UFs que entregam o planejamento no FO-178, o documento já foi
        // elaborado ao gerar o plano. Abre-se logo para revisão, em vez de se
        // repetirem as chamadas à IA que o produziram.
        var jaElaborado = PlanoStore.carregarPlanoEnsino();
        if (jaElaborado) {
            planoEnsino = jaElaborado;
            desenharPlanoEnsino();
            PlanoStore.mensagem(
                mensagemGeracao,
                'info',
                'Este Plano de Ensino foi elaborado junto com o planejamento. Reveja abaixo, ou use ' +
                '"Elaborar Plano de Ensino" para o refazer do zero.'
            );
        }
    }

    /**
     * Informa quantas situações de aprendizagem existem para este plano.
     *
     * Sem nenhuma situação elaborada, o FO-178 sai com o bloco descritivo em
     * branco. O documento continua válido, mas o docente perde o que a página
     * de Situação de Aprendizagem já sabe produzir — daí o aviso.
     */
    function desenharAvisoSituacoes() {
        var situacoes = PlanoStore.carregarSituacoes();
        var previstas = (plano && plano.paginas && plano.paginas.length) || 1;

        if (situacoes.length === 0) {
            avisoSituacoes.innerHTML =
                '<div class="mensagem info">' + Icons.html('informacao') +
                ' Nenhuma situação de aprendizagem foi elaborada nesta sessão. O bloco ' +
                '<strong>Estratégias de aprendizagem desafiadoras</strong> e a sua descrição sairão em branco. ' +
                'Elabore-as primeiro em <a href="/situacao-aprendizagem">Situação de Aprendizagem</a> ' +
                '(' + previstas + ' prevista' + (previstas > 1 ? 's' : '') + ' para esta UC).</div>';
            return;
        }

        var completo = situacoes.length >= previstas;
        avisoSituacoes.innerHTML =
            '<div class="mensagem ' + (completo ? 'sucesso' : 'info') + '">' +
            Icons.html(completo ? 'sucesso' : 'informacao') + ' ' +
            situacoes.length + ' de ' + previstas + ' situações de aprendizagem elaboradas' +
            (completo
                ? '. O bloco descritivo do formulário será repetido uma vez por situação.'
                : '. As restantes podem ser elaboradas em <a href="/situacao-aprendizagem">Situação de Aprendizagem</a>.') +
            '</div>';
    }

    // ---------------------------------------------------------------------
    // Etapa 2 — elaboração dos campos em falta
    // ---------------------------------------------------------------------

    btnElaborar.addEventListener('click', async function () {
        if (!plano) return;

        btnElaborar.disabled = true;
        btnElaborar.textContent = 'Elaborando...';
        mensagemGeracao.innerHTML = '';
        areaPlanoEnsino.innerHTML =
            '<div class="documento carregando">A IA está elaborando o perfil profissional, a classificação ' +
            'das capacidades, a composição da média e as referências bibliográficas. Isso pode demorar alguns ' +
            'instantes.</div>';

        try {
            var resposta = await fetch('/api/plano-ensino', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plano: plano,
                    situacoes: PlanoStore.carregarSituacoes(),
                    instrucoes: inputInstrucoes.value.trim()
                })
            });

            var corpo = await resposta.json().catch(function () { return {}; });
            if (!resposta.ok || !corpo.success) {
                throw new Error(corpo.error || 'Não foi possível elaborar o Plano de Ensino.');
            }

            planoEnsino = corpo.planoEnsino;
            PlanoStore.guardarPlanoEnsino(planoEnsino);
            desenharPlanoEnsino();
        } catch (erro) {
            areaPlanoEnsino.innerHTML = '';
            PlanoStore.mensagem(mensagemGeracao, 'erro', erro.message);
        } finally {
            btnElaborar.disabled = false;
            btnElaborar.textContent = 'Elaborar Plano de Ensino';
        }
    });

    // ---------------------------------------------------------------------
    // Etapa 3 — revisão e exportação
    // ---------------------------------------------------------------------

    /**
     * Campo de texto editável ligado a um caminho do objeto planoEnsino.
     * @param {string} caminho Caminho separado por pontos (ex.: "perfil.funcao").
     * @param {string} rotulo
     * @param {{ linhas?: number, nota?: string }} [opcoes]
     * @returns {string} HTML do campo.
     */
    function campoEditavel(caminho, rotulo, opcoes) {
        var o = opcoes || {};
        var valor = caminho.split('.').reduce(function (alvo, chave) {
            return alvo && alvo[chave];
        }, planoEnsino);

        var nota = o.nota
            ? '<p class="legenda" style="margin:0.2rem 0 0;">' + esc(o.nota) + '</p>'
            : '';

        return (
            '<div class="form-group">' +
            '<label for="campo-' + esc(caminho) + '">' + esc(rotulo) + '</label>' +
            '<textarea id="campo-' + esc(caminho) + '" data-caminho="' + esc(caminho) + '" ' +
            'rows="' + (o.linhas || 2) + '" class="campo-fo178">' + esc(valor || '') + '</textarea>' +
            nota +
            '</div>'
        );
    }

    /** Renderiza o formulário de revisão e a pré-visualização da tabela. */
    function desenharPlanoEnsino() {
        var ident = planoEnsino.identificacao || {};
        var meta = planoEnsino.meta || {};

        var semClassificacao = meta.capacidadesSemClassificacao || [];
        var avisoCapacidades = semClassificacao.length
            ? '<div class="mensagem info">' + Icons.html('informacao') + ' ' + semClassificacao.length +
              ' capacidade(s) ficaram sem classificação em Básica/Técnica/Socioemocional e sairão sem o ' +
              'prefixo no documento.</div>'
            : '';

        var linhasTabela = (planoEnsino.linhas || []).map(function (linha) {
            var capacidades = (linha.capacidades || []).map(function (c) {
                return (c.tipo ? '[' + c.tipo + '] ' : '') + c.descricao;
            }).join('<br>');

            return '<tr>' +
                '<td>' + esc(linha.aulas) + '</td>' +
                '<td>' + esc(linha.ch) + '</td>' +
                '<td>' + capacidades + '</td>' +
                '<td>' + esc(linha.conhecimentos).replace(/\n/g, '<br>') + '</td>' +
                '<td>' + esc(linha.estrategiasEnsino).replace(/\n/g, '<br>') + '</td>' +
                '<td>' + esc(linha.criterios).replace(/\n/g, '<br>') + '</td>' +
                '<td>' + esc(linha.instrumentos) + '</td>' +
                '<td>' + esc(linha.recursos).replace(/\n/g, '<br>') + '</td>' +
                '</tr>';
        }).join('');

        var situacoesHtml = (planoEnsino.situacoes || []).map(function (situacao, indice) {
            var numero = String(indice + 1).padStart(2, '0');
            return '<div class="bloco-situacao">' +
                '<h4>Situação de Aprendizagem ' + numero +
                (situacao.titulo ? ' — ' + esc(situacao.titulo) : '') + '</h4>' +
                '<p class="legenda">Estratégia desafiadora: <strong>' +
                esc(situacao.estrategiaId || 'não definida') + '</strong></p>' +
                '</div>';
        }).join('');

        areaPlanoEnsino.innerHTML =
            '<div class="form-container" style="margin-top:2rem;">' +
            '<div class="form-header">' +
            '<h2 class="form-title">Revisão do Plano de Ensino</h2>' +
            '<p class="form-description">Confira e ajuste os campos elaborados pela IA. O FO-178 segue para a ' +
            'área educacional — Função, Subfunção e Objetivo Geral não constam de nenhum plano de curso e são ' +
            'propostas da IA.</p>' +
            '</div>' +

            avisoCapacidades +

            '<h3 class="bloco-titulo">Identificação</h3>' +
            '<dl class="plano-resumo">' +
            '<div><dt>Curso:</dt><dd>' + esc(ident.curso || '—') + '</dd></div>' +
            '<div><dt>Unidade Curricular:</dt><dd>' + esc(ident.unidadeCurricular || '—') + '</dd></div>' +
            '<div><dt>Docente/Instrutor:</dt><dd>' + esc(ident.docente || '—') + '</dd></div>' +
            '<div><dt>Carga Horária:</dt><dd>' + esc(ident.cargaHoraria || '—') + '</dd></div>' +
            '</dl>' +

            '<h3 class="bloco-titulo">Perfil Profissional</h3>' +
            campoEditavel('perfil.funcao', 'Função', {
                linhas: 2,
                nota: 'Elaborado pela IA — não consta do plano de curso.'
            }) +
            campoEditavel('perfil.subfuncao', 'Subfunção', {
                linhas: 2,
                nota: 'Elaborado pela IA — não consta do plano de curso.'
            }) +
            campoEditavel('perfil.objetivoGeral', 'Objetivo Geral da Unidade Curricular', {
                linhas: 3,
                nota: 'Elaborado pela IA a partir das capacidades da UC.'
            }) +

            '<h3 class="bloco-titulo">Estratégias de Aprendizagem Desafiadoras</h3>' +
            (situacoesHtml || '<p class="legenda">Nenhuma situação de aprendizagem elaborada: o bloco sairá em branco.</p>') +

            '<h3 class="bloco-titulo">Avaliação e Referências</h3>' +
            campoEditavel('composicaoMedia', 'Avaliação (composição da média)', { linhas: 4 }) +
            campoEditavel('referencias', 'Referências bibliográficas', {
                linhas: 6,
                nota: 'Confirme se as obras existem e estão disponíveis na unidade antes de submeter.'
            }) +

            '<h3 class="bloco-titulo">Tabela de aulas (' + (planoEnsino.linhas || []).length + ' linhas)</h3>' +
            '<div class="tabela-rolavel">' +
            '<table class="tabela-fo178">' +
            '<thead><tr>' +
            '<th>Aula nº</th><th>CH</th><th>Capacidades</th><th>Conhecimentos</th>' +
            '<th>Estratégias de Ensino</th><th>Critérios</th><th>Instrumentos</th>' +
            '<th>Recursos, Ambientes e Acessibilidade</th>' +
            '</tr></thead>' +
            '<tbody>' + linhasTabela + '</tbody>' +
            '</table>' +
            '</div>' +

            '<div class="botoes">' +
            '<button type="button" class="btn btn-primario" id="btnBaixarDocx">' +
            Icons.html('baixar') + ' Baixar Plano de Ensino (.docx)</button>' +
            '</div>' +
            '<div id="areaDownload"></div>' +
            '</div>';

        // Liga cada campo editável ao objeto que será exportado
        areaPlanoEnsino.querySelectorAll('.campo-fo178').forEach(function (campo) {
            campo.addEventListener('input', function () {
                var partes = campo.getAttribute('data-caminho').split('.');
                var ultima = partes.pop();
                var alvo = partes.reduce(function (obj, chave) { return obj[chave]; }, planoEnsino);
                alvo[ultima] = campo.value;
            });
        });

        document.getElementById('btnBaixarDocx').addEventListener('click', baixarDocx);

        areaPlanoEnsino.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Pede o .docx ao servidor e entrega-o ao navegador.
     *
     * O ficheiro chega como corpo binário da resposta, e não como um link: é
     * gerado a partir do modelo FO-178 guardado no servidor e nunca chega a
     * existir em disco.
     */
    async function baixarDocx() {
        var botao = document.getElementById('btnBaixarDocx');
        var area = document.getElementById('areaDownload');

        botao.disabled = true;
        botao.textContent = 'Gerando documento...';
        area.innerHTML = '';

        // As edições feitas nos campos ficam na sessão, para não se perderem ao
        // navegar para outra página e voltar.
        PlanoStore.guardarPlanoEnsino(planoEnsino);

        try {
            var resposta = await fetch('/api/plano-ensino/docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planoEnsino: planoEnsino })
            });

            if (!resposta.ok) {
                var corpo = await resposta.json().catch(function () { return {}; });
                throw new Error(corpo.error || 'Não foi possível gerar o ficheiro .docx.');
            }

            var blob = await resposta.blob();
            var uc = (planoEnsino.identificacao && planoEnsino.identificacao.unidadeCurricular) || 'UC';
            var nome = 'FO-178 - ' + uc.replace(/[\\/:*?"<>|]/g, '') + '.docx';

            var url = URL.createObjectURL(blob);
            var ligacao = document.createElement('a');
            ligacao.href = url;
            ligacao.download = nome;
            document.body.appendChild(ligacao);
            ligacao.click();
            document.body.removeChild(ligacao);
            URL.revokeObjectURL(url);

            PlanoStore.mensagem(area, 'sucesso', 'Documento gerado: ' + nome);
        } catch (erro) {
            PlanoStore.mensagem(area, 'erro', erro.message);
        } finally {
            botao.disabled = false;
            botao.innerHTML = Icons.html('baixar') + ' Baixar Plano de Ensino (.docx)';
        }
    }
});
