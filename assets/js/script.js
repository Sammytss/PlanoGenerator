document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('courseForm');
    const submitBtn = document.getElementById('submitBtn');
    const resultArea = document.getElementById('resultArea');

    // URL do servidor backend
    const backendUrl = 'http://localhost:3000/gerar-plano';

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        submitBtn.disabled = true;
        submitBtn.textContent = 'Processando...';
        resultArea.classList.remove('hidden');

        // Prepara uma única área de texto para as atualizações
        resultArea.innerHTML = `<div class="loader" id="progress-text">Aguarde</div>`;
        const progressTextElement = document.getElementById('progress-text');

        const formData = new FormData(form);
        // Endereço do servidor local do sistema
        const backendUrl = 'http://10.25.0.60:3000/gerar-plano';

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
                    } else if (progressTextElement) {
                        // Atualiza o texto do elemento em vez de criar um novo
                        progressTextElement.textContent = message;
                    }
                }
            }

        } catch (error) {
            console.error('Ocorreu um erro:', error);
            // Em caso de erro, também atualiza a área de resultado
            resultArea.innerHTML = `<p style="color: red;">❌ Erro: ${error.message}</p>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Gerar Plano de Curso';
        }
    });
});
