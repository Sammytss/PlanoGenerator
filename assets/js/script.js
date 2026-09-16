SPA.pagina('plano', async function () {
    const form = document.getElementById('courseForm');
    const submitBtn = document.getElementById('submitBtn');
    const resultArea = document.getElementById('resultArea');
    const selectEstado = document.getElementById('estadoUnidade');
    const selectMunicipio = document.getElementById('municipioUnidade');
    const selectUnidade = document.getElementById('unidadeEscolar');

    let dadosUnidades = { estados: [], opcaoOutra: 'Outra (informar em observações)' };

    // Carrega unidades SENAI por estado/município (assets/data/unidades-senai.json)
    try {
        const res = await fetch('/assets/data/unidades-senai.json');
        if (res.ok) {
            const data = await res.json();
            if (data.estados && Array.isArray(data.estados)) dadosUnidades = data;
        }
    } catch (e) {
        console.warn('Lista de unidades não carregada.', e);
    }

    // Preenche select de estado
    if (selectEstado) {
        selectEstado.innerHTML = '<option value="" disabled selected>Selecione o estado</option>' +
            dadosUnidades.estados.map((e, i) => `<option value="${i}">${e.nome} (${e.sigla})</option>`).join('');
    }

    function esc(s) {
        return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    // ---------------------------------------------------------------------
    // Formato do planejamento conforme a UF
    // ---------------------------------------------------------------------
    // Nas unidades de Goiás o planejamento docente é entregue no formulário
    // FO-178, e não na planilha. A sigla vai para o servidor num campo oculto,
    // porque o select de estado guarda o índice do array, de que a cascata de
    // municípios depende.
    const UFS_COM_FORMULARIO_FO178 = ['GO'];

    const campoUf = document.getElementById('ufUnidade');
    const blocoFo178 = document.getElementById('blocoFo178');

    /** @returns {boolean} true se a UF escolhida usa o formulário FO-178. */
    function ufUsaFo178() {
        return UFS_COM_FORMULARIO_FO178.includes((campoUf && campoUf.value) || '');
    }

    /** Mostra o bloco do FO-178 e ajusta o botão conforme a UF escolhida. */
    function atualizarFormatoDeSaida() {
        const fo178 = ufUsaFo178();
        if (blocoFo178) blocoFo178.hidden = !fo178;
        submitBtn.textContent = fo178 ? 'Gerar Plano de Ensino (FO-178)' : 'Gerar Plano de Curso';
    }

    selectEstado.addEventListener('change', function () {
        const idx = parseInt(this.value, 10);
        selectMunicipio.disabled = true;
        selectMunicipio.innerHTML = '<option value="" disabled selected>Selecione o município</option>';
        selectUnidade.disabled = true;
        selectUnidade.innerHTML = '<option value="" disabled selected>Selecione primeiro o município</option>';

        const estado = dadosUnidades.estados[idx];
        if (campoUf) campoUf.value = (estado && estado.sigla) || '';
        atualizarFormatoDeSaida();

        if (isNaN(idx) || idx < 0 || !estado) return;
        const municipios = estado.municipios || [];
        selectMunicipio.innerHTML = '<option value="" disabled selected>Selecione o município</option>' +
            municipios.map((m, i) => `<option value="${i}">${esc(m.nome)}</option>`).join('');
        selectMunicipio.disabled = false;
    });

    selectMunicipio.addEventListener('change', function () {
        const estadoIdx = parseInt(selectEstado.value, 10);
        const munIdx = parseInt(this.value, 10);
        selectUnidade.disabled = true;
        selectUnidade.innerHTML = '<option value="" disabled selected>Selecione a unidade</option>';
        if (isNaN(estadoIdx) || isNaN(munIdx) || !dadosUnidades.estados[estadoIdx]) return;
        const municipios = dadosUnidades.estados[estadoIdx].municipios || [];
        const mun = municipios[munIdx];
        if (!mun || !mun.unidades) return;
        const unidades = mun.unidades.concat(dadosUnidades.opcaoOutra || 'Outra (informar em observações)');
        selectUnidade.innerHTML = '<option value="" disabled selected>Selecione a unidade</option>' +
            unidades.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
        selectUnidade.disabled = false;
    });

    // URL do servidor backend
    // const backendUrl = 'http://localhost:3000/gerar-plano';

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        submitBtn.disabled = true;
        submitBtn.textContent = 'Processando...';
        resultArea.classList.remove('hidden');

        // Prepara uma única área de texto para as atualizações
        resultArea.innerHTML = `<div class="loader" id="progress-text">Aguarde</div>`;
        const progressTextElement = document.getElementById('progress-text');

        const formData = new FormData(form);
        // Usa caminho relativo para funcionar em qualquer host/porta
        const backendUrl = '/gerar-plano';

        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('A resposta do servidor não foi bem-sucedida.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            if (progressTextElement) {
                progressTextElement.textContent = 'Conexão estabelecida. A iniciar o processo...';
            }

            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                while (buffer.includes('\n')) {
                    const messageEnd = buffer.indexOf('\n');
                    const message = buffer.substring(0, messageEnd);
                    buffer = buffer.substring(messageEnd + 1);

                    if (message.startsWith('DONE:')) {
                        // A mensagem final substitui tudo na área de resultado
                        const finalData = JSON.parse(message.substring(5));

                        // Guarda o plano estruturado na sessão do navegador para
                        // que as páginas de Ficha de Observação e Situação de
                        // Aprendizagem possam reutilizá-lo. Nada é gravado em disco.
                        let planoGuardado = false;
                        if (finalData.plano && window.PlanoStore) {
                            planoGuardado = window.PlanoStore.guardar(finalData.plano);
                        }

                        // As situações elaboradas no mesmo fluxo ficam na sessão,
                        // para a página do FO-178 as reaproveitar sem refazer.
                        if (Array.isArray(finalData.situacoes) && window.PlanoStore) {
                            finalData.situacoes.forEach(function (s) {
                                window.PlanoStore.guardarSituacao(s);
                            });
                        }

                        const atalhos = planoGuardado
                            ? `<div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                                <p style="margin-bottom: 12px; color: #4a5568;">Continue o planejamento com este plano já carregado:</p>
                                <a href="/situacao-aprendizagem" style="display:inline-block;margin:4px;padding:10px 18px;background:#02287a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;"><svg class="icon" aria-hidden="true" focusable="false"><use href="#ico-quebraCabeca"></use></svg> Situação de Aprendizagem</a>
                                <a href="/ficha-observacao" style="display:inline-block;margin:4px;padding:10px 18px;background:#2f7a56;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;"><svg class="icon" aria-hidden="true" focusable="false"><use href="#ico-documentoEditar"></use></svg> Ficha de Observação</a>
                               </div>`
                            : '';

                        if (finalData.formato === 'fo178') {
                            mostrarResultadoFo178(finalData, atalhos);
                        } else {
                            resultArea.innerHTML = `
                            <div style="text-align: center;">
                                <h2 style="color: #1e8e3e;"><svg class="icon" aria-hidden="true" focusable="false"><use href="#ico-sucesso"></use></svg> Planilha Gerada com Sucesso!</h2>
                                <p>O seu plano de curso "<strong>${finalData.spreadsheetName}</strong>" está pronto.</p>
                                <a href="${finalData.spreadsheetUrl}" target="_blank" style="display: inline-block; font-size: 1.1em; padding: 12px 20px; background-color: #1a73e8; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                                    Clique aqui para abrir a planilha
                                </a>
                                ${atalhos}
                            </div>`;
                        }
                    } else if (message.startsWith('ERRO:')) {
                        const userMessage = message.substring(5).trim() || 'Ocorreu um erro ao gerar o plano. Tente novamente em alguns instantes.';
                        resultArea.innerHTML = `<p style="color: red; text-align: center;"><svg class="icon" aria-hidden="true" focusable="false"><use href="#ico-erro"></use></svg> ${userMessage}</p>`;
                    } else if (progressTextElement) {
                        // Atualiza o texto do elemento em vez de criar um novo
                        progressTextElement.textContent = message;
                    }
                }
            }

        } catch (error) {
            console.error('Ocorreu um erro ao comunicar com o servidor:', error);

            const isNetworkError = error && error.name === 'TypeError';
            const userMessage = isNetworkError
                ? 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
                : 'Ocorreu um erro ao processar sua solicitação. Tente novamente em alguns instantes.';

            resultArea.innerHTML = `<p style="color: red; text-align: center;"><svg class="icon" aria-hidden="true" focusable="false"><use href="#ico-erro"></use></svg> ${userMessage}</p>`;
        } finally {
            submitBtn.disabled = false;
            atualizarFormatoDeSaida();
        }
    });

    /**
     * Desenha o resultado do fluxo FO-178: o documento já vem elaborado, e o
     * botão apenas pede o ficheiro ao servidor.
     *
     * @param {object} finalData Resposta de /gerar-plano com formato "fo178".
     * @param {string} atalhos HTML dos atalhos para as outras páginas.
     */
    function mostrarResultadoFo178(finalData, atalhos) {
        const planoEnsino = finalData.planoEnsino || {};
        const ident = planoEnsino.identificacao || {};
        const totalLinhas = (planoEnsino.linhas || []).length;
        const totalSituacoes = (planoEnsino.situacoes || []).length;

        if (window.PlanoStore) window.PlanoStore.guardarPlanoEnsino(planoEnsino);

        resultArea.innerHTML = `
        <div style="text-align: center;">
            <h2 style="color: #1e8e3e;"><svg class="icon" aria-hidden="true" focusable="false"><use href="#ico-sucesso"></use></svg> Plano de Ensino (FO-178) Elaborado!</h2>
            <p>"<strong>${esc(ident.unidadeCurricular)}</strong>" — ${totalLinhas} linha(s) na tabela de aulas
               e ${totalSituacoes} situação(ões) de aprendizagem.</p>
            <button type="button" id="btnBaixarFo178" style="display:inline-block;font-size:1.1em;padding:12px 20px;background-color:#1a73e8;color:#fff;border:none;border-radius:5px;margin-top:10px;cursor:pointer;font-weight:600;">
                Baixar o Plano de Ensino (.docx)
            </button>
            <p style="margin-top:14px;color:#4a5568;font-size:0.9em;">
                Confira o perfil profissional e as referências antes de submeter —
                <a href="/plano-ensino">revisar e editar o FO-178</a>.
            </p>
            <div id="areaDownloadFo178"></div>
            ${atalhos}
        </div>`;

        document.getElementById('btnBaixarFo178').addEventListener('click', function () {
            baixarFo178(planoEnsino, this);
        });
    }

    /**
     * Pede o .docx ao servidor e entrega-o ao navegador.
     * @param {object} planoEnsino
     * @param {HTMLButtonElement} botao
     */
    async function baixarFo178(planoEnsino, botao) {
        const area = document.getElementById('areaDownloadFo178');
        const rotulo = botao.textContent;

        botao.disabled = true;
        botao.textContent = 'Gerando documento...';
        area.innerHTML = '';

        try {
            const resposta = await fetch('/api/plano-ensino/docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planoEnsino })
            });

            if (!resposta.ok) {
                const corpo = await resposta.json().catch(() => ({}));
                throw new Error(corpo.error || 'Não foi possível gerar o ficheiro .docx.');
            }

            const uc = (planoEnsino.identificacao && planoEnsino.identificacao.unidadeCurricular) || 'UC';
            const nome = 'FO-178 - ' + uc.replace(/[\\/:*?"<>|]/g, '') + '.docx';

            const url = URL.createObjectURL(await resposta.blob());
            const ligacao = document.createElement('a');
            ligacao.href = url;
            ligacao.download = nome;
            document.body.appendChild(ligacao);
            ligacao.click();
            document.body.removeChild(ligacao);
            URL.revokeObjectURL(url);

            area.innerHTML = `<p style="color:#1e8e3e;margin-top:10px;">Documento gerado: ${esc(nome)}</p>`;
        } catch (erro) {
            area.innerHTML = `<p style="color:red;margin-top:10px;">${esc(erro.message)}</p>`;
        } finally {
            botao.disabled = false;
            botao.textContent = rotulo;
        }
    }
});
