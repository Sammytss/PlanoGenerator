// --- Novo script.js ---

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('courseForm');
    const submitBtn = document.getElementById('submitBtn');
    const resultArea = document.getElementById('resultArea');

    // URL do seu novo servidor backend
    const backendUrl = 'http://localhost:3000/gerar-plano';

    // --- VERSÃO FINAL DO SCRIPT.JS ---

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        submitBtn.disabled = true;
        submitBtn.textContent = 'Processando...';
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `<div class="loader">Analisando PDF e gerando a planilha</div>`;

        const formData = new FormData(form);
        const backendUrl = 'http://localhost:3000/gerar-plano';

        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                body: formData,
            });

            // A resposta do backend agora é um JSON
            const resultData = await response.json();

            if (!response.ok || !resultData.success) {
                throw new Error(resultData.details || 'Ocorreu um erro no servidor.');
            }

            // Constrói o HTML de sucesso dinamicamente usando os dados recebidos
            const successHtml = `
            <div style="text-align: center;">
                <h2 style="color: #1e8e3e;">✅ Planilha Gerada com Sucesso!</h2>
                <p>Seu plano de curso "<strong>${resultData.spreadsheetName}</strong>" está pronto.</p>
                <a href="${resultData.spreadsheetUrl}" target="_blank" style="display: inline-block; font-size: 1.1em; padding: 12px 20px; background-color: #1a73e8; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                    Clique aqui para abrir a planilha
                </a>
            </div>`;

            resultArea.innerHTML = successHtml;

        } catch (error) {
            console.error('Ocorreu um erro:', error);
            resultArea.innerHTML = `<p style="color: red; font-weight: bold;">Ocorreu um erro na comunicação.</p><p>${error.message}</p>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Gerar Plano de Curso';
        }
    });
});