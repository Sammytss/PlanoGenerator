/* =========================================================================
   Sistema de ícones SVG
   -------------------------------------------------------------------------
   Substitui os emojis da interface por ícones vetoriais de traço, com
   geometria consistente (grelha 24x24, traço de 2, extremidades arredondadas).

   Os ícones usam stroke="currentColor", pelo que herdam a cor do texto onde
   estão inseridos — incluindo o branco dentro das caixas com gradiente e o
   preto na impressão.

   Uso em HTML estático:
     <svg class="icon" aria-hidden="true"><use href="#ico-calendario"></use></svg>

   Uso em HTML gerado por JavaScript:
     Icons.html('calendario')

   O sprite é injetado no início do <body>, antes de qualquer referência, por
   isso este ficheiro deve ser carregado logo a seguir à abertura do <body>.
   ========================================================================= */

(function () {
    'use strict';

    /**
     * Definições dos ícones. A chave é o nome usado em Icons.html() e no
     * atributo href (prefixado com "ico-").
     */
    var DESENHOS = {
        // Central de Ajuda: acompanha o botão "?" do cabeçalho que abre o modal
        ajuda: '<circle cx="12" cy="12" r="9"/>' +
            '<path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.6-2.6 2.6"/>' +
            '<path d="M12 17.2h.01"/>',

        // Guia Interativo: percurso orientado campo a campo pelo formulário
        bussola: '<circle cx="12" cy="12" r="9"/><path d="M15.9 8.1 14 14l-5.9 1.9L10 10l5.9-1.9z"/>',

        // Situação de Aprendizagem: a peça que encaixa capacidades num desafio
        quebraCabeca: '<path d="M5.5 5.5h4.2a2.3 2.3 0 1 1 4.6 0h4.2v4.2a2.3 2.3 0 1 0 0 4.6v4.2H5.5v-4.2a2.3 2.3 0 1 1 0-4.6V5.5z"/>',

        escola: '<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="M6 10.5V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5.5"/>' +
            '<path d="M20 9v5"/>',

        prancheta: '<rect x="8" y="3" width="8" height="4" rx="1"/>' +
            '<path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3"/>' +
            '<path d="M8 12h8M8 16h5"/>',

        video: '<rect x="2" y="6" width="13" height="12" rx="2"/><path d="M22 8.5v7l-7-3.5 7-3.5z"/>',

        filme: '<rect x="3" y="4" width="18" height="16" rx="2"/>' +
            '<path d="M7.5 4v16M16.5 4v16M3 9.5h4.5M3 14.5h4.5M16.5 9.5H21M16.5 14.5H21"/>',

        relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 1.9"/>',

        reproduzir: '<path d="M7 4.5 19.5 12 7 19.5v-15z"/>',

        documentoEditar: '<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4.5"/>' +
            '<path d="M13.5 3 18 7.5"/><path d="M13.5 3v4.5H18"/>' +
            '<path d="M17.8 13.2 21 16.4l-4.4 4.4h-3.2v-3.2l4.4-4.4z"/>',

        calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',

        ampulheta: '<path d="M6.5 3h11M6.5 21h11"/>' +
            '<path d="M16.5 3v4.3L12 12 7.5 7.3V3"/>' +
            '<path d="M7.5 21v-4.3L12 12l4.5 4.7V21"/>',

        documento: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/>' +
            '<path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',

        lampada: '<path d="M9.5 18h5"/><path d="M10.5 21h3"/>' +
            '<path d="M12 3a6 6 0 0 0-3.8 10.7c.7.6 1.2 1.4 1.3 2.3h5c.1-.9.6-1.7 1.3-2.3A6 6 0 0 0 12 3z"/>',

        pasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',

        enviar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M12 4v12"/>',

        baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7.5 11.5 12 16l4.5-4.5"/><path d="M12 4v12"/>',

        listaVerificada: '<path d="M10 6h11M10 12h11M10 18h11"/>' +
            '<path d="M3 6.2l1.4 1.4L7.2 4.8"/><path d="M3 12.2l1.4 1.4 2.8-2.8"/><path d="M3 18.2l1.4 1.4 2.8-2.8"/>',

        balanca: '<path d="M12 4.2V21"/><path d="M8 21h8"/><path d="M5.5 6.8h13"/>' +
            '<circle cx="12" cy="4.2" r="1.4"/>' +
            '<path d="M5.5 6.8 2 14h7L5.5 6.8z"/><path d="M18.5 6.8 15 14h7l-3.5-7.2z"/>',

        caixa: '<path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/>' +
            '<path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',

        atualizar: '<path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9"/><path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9"/>' +
            '<path d="M18.5 2.5v4h-4"/><path d="M5.5 21.5v-4h4"/>',

        sucesso: '<circle cx="12" cy="12" r="9"/><path d="M8 12.2l2.8 2.8L16 9"/>',

        erro: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',

        informacao: '<circle cx="12" cy="12" r="9"/><path d="M12 16.5v-5"/><path d="M12 8h.01"/>',

        // Livro aberto: lê-se melhor do que a capa fechada em tamanhos pequenos
        livro: '<path d="M12 7C10.4 5.4 8.3 4.6 5.8 4.6c-1 0-2 .1-2.8.4v13c.8-.3 1.8-.4 2.8-.4 2.5 0 4.6.8 6.2 2.4"/>' +
            '<path d="M12 7c1.6-1.6 3.7-2.4 6.2-2.4 1 0 2 .1 2.8.4v13c-.8-.3-1.8-.4-2.8-.4-2.5 0-4.6.8-6.2 2.4"/>' +
            '<path d="M12 7v13"/>',

        olho: '<path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',

        impressora: '<path d="M6.5 9V3h11v6"/>' +
            '<path d="M6.5 18H4.5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>' +
            '<rect x="6.5" y="14" width="11" height="7" rx="1"/>',

        borracha: '<path d="M4 16.5 10.5 10l6.5 6.5-3.5 3.5H7L4 16.5z"/>' +
            '<path d="M10.5 10 15 5.5a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L17 16"/>' +
            '<path d="M6 21h15"/>',

        aviso: '<path d="M12 4 2.7 20h18.6L12 4z"/><path d="M12 10.5v4"/><path d="M12 17.5h.01"/>',
    };

    // Sprite escondido. Evitamos display:none porque o Safari deixa de resolver
    // as referências <use> quando o sprite está nesse estado.
    var sprite =
        '<svg aria-hidden="true" focusable="false" ' +
        'style="position:absolute;width:0;height:0;overflow:hidden" ' +
        'xmlns="http://www.w3.org/2000/svg">' +
        Object.keys(DESENHOS)
            .map(function (nome) {
                return '<symbol id="ico-' + nome + '" viewBox="0 0 24 24">' + DESENHOS[nome] + '</symbol>';
            })
            .join('') +
        '</svg>';

    // Injetado durante a análise do documento, imediatamente após este script,
    // garantindo que existe antes de qualquer <use> no corpo da página.
    if (document.currentScript) {
        document.currentScript.insertAdjacentHTML('afterend', sprite);
    } else if (document.body) {
        document.body.insertAdjacentHTML('afterbegin', sprite);
    }

    window.Icons = {
        /**
         * Devolve o HTML de um ícone, para composição de markup em JavaScript.
         * @param {string} nome Nome do ícone (chave de DESENHOS).
         * @param {string} [classeExtra] Classes adicionais.
         * @returns {string} HTML do elemento <svg>.
         */
        html: function (nome, classeExtra) {
            if (!DESENHOS[nome]) {
                console.warn('Ícone inexistente: ' + nome);
                return '';
            }
            var classe = 'icon' + (classeExtra ? ' ' + classeExtra : '');
            return (
                '<svg class="' + classe + '" aria-hidden="true" focusable="false">' +
                '<use href="#ico-' + nome + '"></use></svg>'
            );
        },

        /** @returns {string[]} Nomes disponíveis, útil para depuração. */
        nomes: function () {
            return Object.keys(DESENHOS);
        },
    };
})();
