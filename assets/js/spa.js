/* =========================================================================
   Navegação sem recarregar a página
   -------------------------------------------------------------------------
   Permite alternar entre o Planejamento Docente, a Ficha de Observação e a
   Situação de Aprendizagem sem perder o que já foi preenchido.

   A vista de cada página é guardada em memória como um nó DESTACADO do
   documento, e não regenerada a partir do HTML. Essa distinção é essencial:
   um <input type="file"> não pode ter o seu valor reposto por JavaScript, por
   razões de segurança do navegador. Se o DOM fosse destruído e recriado, o PDF
   da Unidade Curricular e a Matriz SAEP já escolhidos seriam perdidos. Como o
   nó continua vivo, tudo se mantém: campos de texto, datas, ficheiros
   selecionados, fichas já geradas e a posição de deslocamento.

   Cada página continua a existir como ficheiro HTML servido pelo Express, pelo
   que ligações diretas, atualização da página e o botão de retroceder do
   navegador continuam a funcionar normalmente.
   ========================================================================= */

window.SPA = (function () {
    'use strict';

    /** Caminho do URL para o nome interno da vista. */
    var ROTAS = {
        '/': 'plano',
        '/index.html': 'plano',
        '/ficha-observacao': 'ficha',
        '/situacao-aprendizagem': 'situacao',
    };

    /** nome -> [funções de arranque, executadas uma única vez] */
    var iniciadores = {};
    /** nome -> [funções executadas em cada montagem, incluindo a primeira] */
    var aoMontar = {};
    /** nome -> true quando o arranque já correu */
    var jaIniciou = {};
    /** nome -> { no: Element, scroll: number } das vistas já visitadas */
    var cache = {};

    /** nome -> título do documento, para repor ao voltar a uma vista guardada */
    var tituloPorVista = {};

    var recursosCarregados = {};
    var vistaAtual = null;
    var aMontar = false;
    var navegando = false;
    /** Comentário que marca o lugar da vista no corpo do documento. */
    var ancora = null;

    /**
     * Resolve um URL relativo para absoluto, para comparar recursos já
     * carregados independentemente da forma como foram escritos.
     * @param {string} url
     * @returns {string}
     */
    function absoluto(url) {
        try {
            return new URL(url, document.baseURI).href;
        } catch (e) {
            return url;
        }
    }

    /** @returns {string} Nome da vista correspondente ao caminho atual. */
    function nomeDoCaminho(caminho) {
        return ROTAS[caminho.replace(/\/+$/, '') || '/'] || ROTAS[caminho] || null;
    }

    /** Marca como carregados os scripts e folhas de estilo já presentes. */
    function inventariarRecursos() {
        document.querySelectorAll('script[src]').forEach(function (s) {
            recursosCarregados[absoluto(s.getAttribute('src'))] = true;
        });
        document.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
            recursosCarregados[absoluto(l.getAttribute('href'))] = true;
        });
    }

    /**
     * Carrega um script, respeitando a ordem de chamada.
     * @param {string} src
     * @returns {Promise<void>}
     */
    function carregarScript(src) {
        var chave = absoluto(src);
        if (recursosCarregados[chave]) return Promise.resolve();

        return new Promise(function (resolve) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = function () {
                recursosCarregados[chave] = true;
                resolve();
            };
            s.onerror = function () {
                console.error('SPA: falha ao carregar ' + src);
                // Resolve mesmo assim: uma dependência em falta não deve
                // bloquear a navegação para sempre.
                resolve();
            };
            document.body.appendChild(s);
        });
    }

    /**
     * Acrescenta ao <head> as folhas de estilo que a página de destino usa e
     * a atual não tem (por exemplo, o flatpickr, presente só no formulário).
     * @param {Document} doc Documento obtido por fetch.
     */
    function sincronizarEstilos(doc) {
        doc.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
            var href = l.getAttribute('href');
            if (!href || recursosCarregados[absoluto(href)]) return;

            var novo = document.createElement('link');
            novo.rel = 'stylesheet';
            novo.href = href;
            document.head.appendChild(novo);
            recursosCarregados[absoluto(href)] = true;
        });
    }

    /**
     * Regista o arranque de uma página. Substitui o antigo listener de
     * DOMContentLoaded: o corpo corre quando a vista está montada, e apenas
     * uma vez, para que o estado sobreviva à navegação.
     *
     * @param {string} nome Nome da vista ("plano", "ficha", "situacao").
     * @param {Function} iniciar Corre uma única vez, no primeiro acesso.
     * @param {Function} [montar] Corre em todas as montagens da vista.
     */
    function pagina(nome, iniciar, montar) {
        if (typeof iniciar === 'function') {
            (iniciadores[nome] = iniciadores[nome] || []).push(iniciar);
        }
        if (typeof montar === 'function') {
            (aoMontar[nome] = aoMontar[nome] || []).push(montar);
        }

        // Durante uma navegação, quem corre os arranques é a própria navegação,
        // depois de todos os scripts da página estarem carregados.
        if (aMontar) return;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                correrArranques(nome);
            });
        } else {
            correrArranques(nome);
        }
    }

    /**
     * Corre os arranques pendentes e os ganchos de montagem de uma vista.
     * @param {string} nome
     */
    function correrArranques(nome) {
        var raiz = document.getElementById('app-view');
        if (!raiz || raiz.getAttribute('data-pagina') !== nome) return;

        if (!jaIniciou[nome]) {
            jaIniciou[nome] = true;
            (iniciadores[nome] || []).forEach(function (fn) {
                try {
                    fn(raiz);
                } catch (e) {
                    console.error('SPA: erro no arranque de "' + nome + '"', e);
                }
            });
        }

        (aoMontar[nome] || []).forEach(function (fn) {
            try {
                fn(raiz);
            } catch (e) {
                console.error('SPA: erro na montagem de "' + nome + '"', e);
            }
        });
    }

    /**
     * Troca a vista visível, guardando a atual em memória.
     *
     * @param {string} url Caminho de destino.
     * @param {boolean} empilhar Se deve acrescentar ao histórico.
     * @returns {Promise<void>}
     */
    async function navegar(url, empilhar) {
        var caminho = new URL(url, location.href).pathname;
        var nome = nomeDoCaminho(caminho);

        // Destino desconhecido: deixa o navegador tratar
        if (!nome) {
            location.href = url;
            return;
        }
        if (nome === vistaAtual || navegando) return;

        navegando = true;

        try {
            var anterior = document.getElementById('app-view');

            // Guarda a vista atual viva, fora do documento
            if (anterior && vistaAtual) {
                cache[vistaAtual] = { no: anterior, scroll: window.scrollY };
                anterior.remove();
            }

            var guardada = cache[nome];
            var scriptsPendentes = [];

            if (guardada) {
                montar(guardada.no);
                if (tituloPorVista[nome]) document.title = tituloPorVista[nome];
            } else {
                var resposta = await fetch(caminho, { headers: { 'X-Requested-With': 'spa' } });
                if (!resposta.ok) throw new Error('HTTP ' + resposta.status);

                var doc = new DOMParser().parseFromString(await resposta.text(), 'text/html');
                var nova = doc.getElementById('app-view');
                if (!nova) throw new Error('página sem #app-view');

                sincronizarEstilos(doc);

                document.title = doc.title || document.title;
                tituloPorVista[nome] = document.title;

                montar(document.importNode(nova, true));

                // Scripts da página de destino, pela ordem em que aparecem
                doc.querySelectorAll('script[src]').forEach(function (s) {
                    scriptsPendentes.push(s.getAttribute('src'));
                });
            }

            vistaAtual = nome;

            // Os arranques só correm depois de todas as dependências, para que
            // o calendário não seja iniciado antes do flatpickr existir.
            aMontar = true;
            for (var i = 0; i < scriptsPendentes.length; i += 1) {
                await carregarScript(scriptsPendentes[i]);
            }
            aMontar = false;

            correrArranques(nome);

            if (empilhar !== false) {
                history.pushState({ vista: nome }, '', caminho);
            }

            window.scrollTo(0, guardada ? guardada.scroll : 0);
        } catch (erro) {
            console.error('SPA: navegação falhou, recorrendo ao carregamento normal.', erro);
            aMontar = false;
            location.href = url;
            return;
        } finally {
            navegando = false;
        }
    }

    /**
     * Coloca a vista no lugar marcado pela âncora, mantendo estável a ordem
     * dos elementos no corpo do documento entre navegações.
     * @param {Element} no
     */
    function montar(no) {
        document.body.insertBefore(no, ancora ? ancora.nextSibling : document.body.firstChild);
    }

    /**
     * Indica se um clique deve ser tratado pelo roteador.
     * Cliques com modificadores, com botão do meio, para outra aba ou para
     * fora da aplicação continuam a ter o comportamento normal do navegador.
     * @param {MouseEvent} evento
     * @param {HTMLAnchorElement} ligacao
     * @returns {boolean}
     */
    function intercetavel(evento, ligacao) {
        if (evento.defaultPrevented) return false;
        if (evento.button !== 0) return false;
        if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return false;
        if (ligacao.target && ligacao.target !== '_self') return false;
        if (ligacao.hasAttribute('download')) return false;
        if (ligacao.origin !== location.origin) return false;
        return nomeDoCaminho(ligacao.pathname) !== null;
    }

    function arrancar() {
        inventariarRecursos();

        var raiz = document.getElementById('app-view');
        if (!raiz) return; // página fora do âmbito do roteador

        // Marca o lugar da vista, para que as trocas não alterem a ordem
        ancora = document.createComment(' app-view ');
        raiz.parentNode.insertBefore(ancora, raiz);

        vistaAtual = raiz.getAttribute('data-pagina');
        tituloPorVista[vistaAtual] = document.title;
        history.replaceState({ vista: vistaAtual }, '', location.pathname);

        document.addEventListener('click', function (evento) {
            var ligacao = evento.target.closest('a[href]');
            if (!ligacao || !intercetavel(evento, ligacao)) return;
            evento.preventDefault();
            navegar(ligacao.pathname, true);
        });

        window.addEventListener('popstate', function () {
            navegar(location.pathname, false);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }

    return {
        pagina: pagina,
        /**
         * Regista uma função a correr sempre que a vista é montada, incluindo
         * a primeira vez. Serve para refrescar o que possa ter mudado enquanto
         * o utilizador esteve noutra página, como o plano guardado na sessão.
         * @param {string} nome
         * @param {Function} fn
         */
        aoMontar: function (nome, fn) {
            (aoMontar[nome] = aoMontar[nome] || []).push(fn);
        },
        navegar: navegar,
        vistaAtual: function () {
            return vistaAtual;
        },
    };
})();
