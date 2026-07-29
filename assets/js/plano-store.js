/* =========================================================================
   Armazenamento do plano na sessão do navegador
   -------------------------------------------------------------------------
   O plano fica apenas em sessionStorage: nada é gravado em disco no servidor.
   Ao fechar o separador, os dados desaparecem.

   Duas origens possíveis:
     1. Plano gerado na própria sessão (guardado por assets/js/script.js).
     2. Planilha .xlsx enviada pelo professor (POST /api/importar-plano).
   ========================================================================= */

window.PlanoStore = (function () {
    'use strict';

    var CHAVE = 'planoGenerator.plano';

    // Logotipo institucional usado no topo dos documentos gerados. É o mesmo
    // que a planilha e os Google Docs usam, vindo de LOGOTIPO_URL no .env.
    var logotipoUrl = '';

    /**
     * Carrega o logotipo institucional a partir do servidor.
     * @returns {Promise<string>} URL do logotipo (string vazia se indisponível).
     */
    async function carregarLogotipo() {
        if (logotipoUrl) return logotipoUrl;
        try {
            var resposta = await fetch('/api/config');
            var corpo = await resposta.json();
            if (corpo && corpo.success && corpo.logotipoUrl) {
                logotipoUrl = corpo.logotipoUrl;
            }
        } catch (e) {
            console.warn('Não foi possível carregar o logotipo institucional.', e);
        }
        return logotipoUrl;
    }

    /**
     * HTML do logotipo para o cabeçalho de um documento.
     * Se a imagem não carregar, o elemento é removido em vez de mostrar um ícone
     * de imagem quebrada na ficha impressa.
     * @returns {string}
     */
    function htmlLogotipo() {
        if (!logotipoUrl) return '';
        return '<img src="' + esc(logotipoUrl) + '" alt="SENAI" ' +
            'onerror="this.remove()">';
    }

    /**
     * Lê o plano guardado na sessão.
     * @returns {object|null} Plano estruturado ou null se não houver.
     */
    function carregar() {
        try {
            var bruto = sessionStorage.getItem(CHAVE);
            if (!bruto) return null;
            var plano = JSON.parse(bruto);
            return plano && Array.isArray(plano.blocos) && plano.blocos.length ? plano : null;
        } catch (e) {
            console.warn('Não foi possível ler o plano da sessão.', e);
            return null;
        }
    }

    /**
     * Guarda o plano na sessão.
     * @param {object} plano
     * @returns {boolean} true se conseguiu guardar.
     */
    function guardar(plano) {
        try {
            sessionStorage.setItem(CHAVE, JSON.stringify(plano));
            return true;
        } catch (e) {
            // Tipicamente QuotaExceededError em planos muito grandes
            console.warn('Não foi possível guardar o plano na sessão.', e);
            return false;
        }
    }

    /** Remove o plano da sessão. */
    function limpar() {
        try {
            sessionStorage.removeItem(CHAVE);
        } catch (e) {
            console.warn('Não foi possível limpar o plano da sessão.', e);
        }
    }

    /**
     * Envia uma planilha .xlsx ao servidor e guarda o plano devolvido.
     * @param {File} ficheiro Planilha gerada pelo Plano Generator.
     * @returns {Promise<object>} Plano importado.
     */
    async function importarPlanilha(ficheiro) {
        var dados = new FormData();
        dados.append('planilhaFile', ficheiro);

        var resposta = await fetch('/api/importar-plano', { method: 'POST', body: dados });
        var corpo = await resposta.json().catch(function () { return {}; });

        if (!resposta.ok || !corpo.success) {
            throw new Error(corpo.error || 'Não foi possível importar a planilha.');
        }

        guardar(corpo.plano);
        return corpo.plano;
    }

    /**
     * Escapa texto para inserção segura em HTML.
     * @param {string} texto
     * @returns {string}
     */
    function esc(texto) {
        return String(texto === undefined || texto === null ? '' : texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Desenha o resumo do plano carregado num contentor.
     * @param {HTMLElement} destino
     * @param {object} plano
     */
    function desenharResumo(destino, plano) {
        if (!destino || !plano) return;
        destino.classList.add('plano-resumo');
        var id = plano.identificacao || {};
        var totalHoras = (plano.blocos || []).reduce(function (s, b) {
            return s + (b.cargaHoraria || 0);
        }, 0);

        destino.innerHTML =
            '<h3>📘 ' + esc(id.unidadeCurricular || 'Unidade Curricular') + '</h3>' +
            '<dl>' +
            '<div><dt>Curso:</dt><dd>' + esc(id.curso || '—') + '</dd></div>' +
            '<div><dt>Instrutor:</dt><dd>' + esc(id.instrutor || '—') + '</dd></div>' +
            '<div><dt>Turma:</dt><dd>' + esc(id.codigoTurma || '—') + '</dd></div>' +
            '<div><dt>Modalidade:</dt><dd>' + esc(id.modalidade || '—') + '</dd></div>' +
            '<div><dt>Unidade:</dt><dd>' + esc(id.unidadeEscolar || '—') + '</dd></div>' +
            '<div><dt>Período:</dt><dd>' + esc(id.periodo || '—') + '</dd></div>' +
            '<div><dt>Itens do plano:</dt><dd>' + (plano.blocos || []).length + '</dd></div>' +
            '<div><dt>Carga horária:</dt><dd>' + totalHoras + 'h</dd></div>' +
            '<div><dt>Origem:</dt><dd>' +
            (plano.origem === 'planilha-importada' ? 'Planilha importada' : 'Gerado nesta sessão') +
            '</dd></div>' +
            '</dl>';
    }

    /**
     * Mostra uma mensagem num contentor.
     * @param {HTMLElement} destino
     * @param {'erro'|'sucesso'|'info'} tipo
     * @param {string} texto
     */
    function mensagem(destino, tipo, texto) {
        if (!destino) return;
        var icone = tipo === 'erro' ? '❌' : tipo === 'sucesso' ? '✅' : 'ℹ️';
        destino.innerHTML = '<div class="mensagem ' + tipo + '">' + icone + ' ' + esc(texto) + '</div>';
    }

    /**
     * Solicita a criação de um Google Docs a partir do conteúdo.
     * @param {'ficha'|'situacao'} tipo
     * @param {string} titulo
     * @param {object} conteudo
     * @returns {Promise<object>} Links docUrl, copyUrl, docxUrl e pdfUrl.
     */
    async function exportarDocumento(tipo, titulo, conteudo) {
        var resposta = await fetch('/api/exportar-documento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: tipo, titulo: titulo, conteudo: conteudo })
        });

        var corpo = await resposta.json().catch(function () { return {}; });

        if (!resposta.ok || !corpo.success) {
            throw new Error(corpo.error || 'Não foi possível exportar o documento.');
        }

        return corpo.documento;
    }

    /**
     * Desenha os links de consumo do documento exportado.
     * @param {HTMLElement} destino
     * @param {object} documento
     */
    function desenharLinksExportacao(destino, documento) {
        if (!destino || !documento) return;
        destino.innerHTML =
            '<div class="mensagem sucesso">✅ Documento criado no Google Docs.</div>' +
            '<div class="links-exportacao">' +
            '<a class="btn btn-primario" target="_blank" rel="noopener" href="' + esc(documento.copyUrl) + '">📝 Abrir e editar no Google Docs</a>' +
            '<a class="btn btn-secundario" target="_blank" rel="noopener" href="' + esc(documento.docxUrl) + '">⬇️ Baixar DOCX</a>' +
            '<a class="btn btn-secundario" target="_blank" rel="noopener" href="' + esc(documento.pdfUrl) + '">⬇️ Baixar PDF</a>' +
            '<a class="btn btn-neutro" target="_blank" rel="noopener" href="' + esc(documento.docUrl) + '">👁️ Visualizar original</a>' +
            '</div>' +
            '<p style="font-size:0.8rem;color:#718096;text-align:center;margin-top:0.6rem;">' +
            '"Abrir e editar" cria uma cópia no Drive da conta Google em que você está autenticado, ' +
            'mantendo o documento fora do alcance de quem tiver apenas o link.</p>';
    }

    return {
        carregar: carregar,
        guardar: guardar,
        limpar: limpar,
        carregarLogotipo: carregarLogotipo,
        htmlLogotipo: htmlLogotipo,
        importarPlanilha: importarPlanilha,
        desenharResumo: desenharResumo,
        desenharLinksExportacao: desenharLinksExportacao,
        exportarDocumento: exportarDocumento,
        mensagem: mensagem,
        esc: esc
    };
})();
