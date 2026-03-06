document.addEventListener('DOMContentLoaded', async () => {
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

    selectEstado.addEventListener('change', function () {
        const idx = parseInt(this.value, 10);
        selectMunicipio.disabled = true;
        selectMunicipio.innerHTML = '<option value="" disabled selected>Selecione o município</option>';
        selectUnidade.disabled = true;
        selectUnidade.innerHTML = '<option value="" disabled selected>Selecione primeiro o município</option>';
        if (isNaN(idx) || idx < 0 || !dadosUnidades.estados[idx]) return;
        const municipios = dadosUnidades.estados[idx].municipios || [];
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
                        resultArea.innerHTML = `
                        <div style="text-align: center;">
                            <h2 style="color: #1e8e3e;">✅ Planilha Gerada com Sucesso!</h2>
                            <p>O seu plano de curso "<strong>${finalData.spreadsheetName}</strong>" está pronto.</p>
                            <a href="${finalData.spreadsheetUrl}" target="_blank" style="display: inline-block; font-size: 1.1em; padding: 12px 20px; background-color: #1a73e8; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                                Clique aqui para abrir a planilha
                            </a>
                        </div>`;
                    } else if (message.startsWith('ERRO:')) {
                        const userMessage = message.substring(5).trim() || 'Ocorreu um erro ao gerar o plano. Tente novamente em alguns instantes.';
                        resultArea.innerHTML = `<p style="color: red; text-align: center;">❌ ${userMessage}</p>`;
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

            resultArea.innerHTML = `<p style="color: red; text-align: center;">❌ ${userMessage}</p>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Gerar Plano de Curso';
        }
    });
});
