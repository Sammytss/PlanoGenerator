// --- server.js Final: Com Formatação Obrigatória de Estratégia ---

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');

const app = express();
const port = 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// PREENCHA AS SUAS CHAVES AQUI
const GEMINI_API_KEY = "AIzaSyBwMp1n1KPAo4z8kkwvYPIeZXqTd4sLAF0";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMD3VdA6awCyL8KBoOcc7e0qN-gyh9aOxRnByBFYxN8mmpOk79562lJqGUGVsK1ynr/exec";
const LOGOTIPO_URL = "https://www.imagemhost.com.br/images/2024/11/22/Logo-novo-SENAI_-sem-slogan_755X325.png";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const generationConfig = {
    temperature: 0.4,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
};
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest", generationConfig });


app.post('/gerar-plano', upload.single('pdfFile'), async (req, res) => {
    console.log("Recebido pedido para gerar plano...");
    // Configura os cabeçalhos para uma resposta em fluxo
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Função auxiliar para enviar atualizações para o frontend
    const sendUpdate = (message) => {
        res.write(`${message}\n`);
    };
    try {
        // Adicione imageUrl aqui
        const { courseName, ucName, startDate, endDate, totalHours, imageUrl, shift } = req.body;
        const pdfFile = req.file;

        if (!pdfFile) {
            throw new Error('Nenhum ficheiro PDF foi enviado.');
        }

        const filePart = {
            inlineData: {
                data: pdfFile.buffer.toString("base64"),
                mimeType: pdfFile.mimetype
            },
        };
        sendUpdate("ETAPA 1: A extrair a lista de tópicos do PDF");
        // --- ETAPA 1: O EXTRATOR ---
        console.log("--- ETAPA 1: Extraindo lista de tópicos... ---");
        const extractorPrompt = `
            Sua única tarefa é analisar a seção "CONHECIMENTOS" do PDF fornecido e extrair a lista completa de todos os tópicos principais numerados.
            Sua resposta deve ser EXCLUSIVAMENTE um objeto JSON com uma única chave chamada "topicos", que contém um array de strings.
        `;

        const extractorResult = await model.generateContent([extractorPrompt, filePart]);
        const topicListJson = JSON.parse(extractorResult.response.text());
        const topicTitles = topicListJson.topicos;

        if (!topicTitles || topicTitles.length === 0) {
            throw new Error("A Etapa 1 (Extrator) não conseguiu encontrar nenhum tópico no PDF.");
        }
        console.log(`Extração concluída. Encontrados ${topicTitles.length} tópicos.`);
        sendUpdate(`Extração concluída. Encontrados ${topicTitles.length} tópicos.`);

        // --- ETAPA 2: O ELABORADOR ---
        console.log("--- ETAPA 2: Elaborando conteúdo para cada tópico... ---");
        sendUpdate("ETAPA 2: A elaborar o conteúdo para cada tópico (isto pode demorar)");
        const conteudoDetalhado = [];

        for (const [index, title] of topicTitles.entries()) {
            console.log(`   - Elaborando: "${title}"`);
            sendUpdate(`   - A processar tópico ${index + 1} de ${topicTitles.length}: "${title}"`);

            // =========================================================================
            //  ✨ PROMPT DO ELABORADOR COM FORMATAÇÃO OBRIGATÓRIA ✨
            // =========================================================================
            const elaboratorPrompt = `
                Você é um professor especialista em design instrucional. Sua tarefa é elaborar o conteúdo detalhado para um único tópico de um plano de curso, seguindo uma matriz de decisão pedagógica de forma INFLEXÍVEL.

                Tópico a ser detalhado: "${title}"

                Gere um único objeto JSON aplicando as seguintes regras de conteúdo:

                1.  **PARA A CHAVE "oque":**
                    * Formate o valor EXATAMENTE assim:
                        "[Listar as capacidades técnicas relevantes para este tópico, extraídas do PDF];
                        Por meio de:
                        ${title.toUpperCase()}
                        X.1. Subtópico 1
                        X.2. Subtópico 2..."

                2.  **PARA A CHAVE "como" (Estratégia de Ensino):**
                    * ESCOLHA no mínimo 1 e no máximo 2 estratégias da lista a seguir: ["Exposição dialogada", "Atividade prática", "Atividade avaliativa", "Gamificação", "Sala de aula invertida", "Trabalho em grupo/dupla/trio"].
                    * **FORMATAÇÃO OBRIGATÓRIA:** O texto final DEVE seguir este formato exato: comece com o nome da estratégia escolhida, seguido de dois pontos e um espaço, e então a descrição com verbos no infinitivo impessoal seguindo a taxonomia de bloom.
                    * **EXEMPLOS DE FORMATO:**
                        * "[Estratégia de ensino]: [Verbo...]"
                        * Se houver duas estratégias, separe-as com uma linha em branco.
                    * A descrição deve ser rica e com exemplos práticos.

                3.  **PARA AS CHAVES "instrumentos" e "criterios":**
                    * **"instrumentos":** ESCOLHA apenas 1 instrumento da lista a seguir: ["Ficha de Observação", "Relatório", "Portfólio", "Prova Objetiva", "Prova de Resposta Construída", "Prova Prática", "Autoavaliação"]. A escolha DEVE ser coerente com a estratégia de ensino definida em "como" sendo Prova Prática e Prova Objetiva somente no final da Unidade curricular (filnal da carga horária total) ultimas datas.
                    * **"criterios":** Defina UM critério de avaliação claro, direto e no passado, no formato "O aluno...", que se relacione com o instrumento escolhido.

                4.  **PARA AS OUTRAS CHAVES ("onde", "recursos", "situacaoAprendizagem"):**
                    * Preencha com informações pertinentes e diretas para o tópico em questão.
                
                5.  **CÁLCULOS:**
                    * Estime uma "cargaHoraria" lógica para este tópico usando como base dataInicioCurso e dataFimCurso.
                    // ✨ AJUSTE 1: INSTRUÇÃO DE FORMATO DE DATA PARA A IA ✨
                    * Estime datas de "inicio" e "fim" para este tópico. As datas DEVEM estar no formato "DD/MM/AAAA".
            `;

            const elaboratorResult = await model.generateContent([elaboratorPrompt, filePart]);
            const topicDetailJson = JSON.parse(elaboratorResult.response.text());
            conteudoDetalhado.push(topicDetailJson);
        }
        console.log("Elaboração de todos os tópicos concluída.");
        sendUpdate("Elaboração de todos os tópicos concluída.");
        // =========================================================================
        // ✨ ETAPAS 2.4 e 2.5 UNIFICADAS E CORRIGIDAS ✨
        // =========================================================================
        console.log("--- ETAPA 2.4: Normalizando para horas-aula completas... ---");

        // Declara a cargaDiaria UMA ÚNICA VEZ
        const cargaDiaria = shift === 'noturno' ? 3 : 4;
        const totalAulasNecessarias = Math.ceil(totalHours / cargaDiaria);

        // Converte as estimativas de horas da IA em estimativas de número de aulas
        let estimativaAulas = conteudoDetalhado.map(item => {
            const horasEstimadas = parseInt(item.cargaHoraria, 10) || 0;
            // Garante que cada tópico tenha pelo menos 1 aula se tiver carga horária
            return horasEstimadas > 0 ? Math.max(1, Math.round(horasEstimadas / cargaDiaria)) : 0;
        });

        let somaAulasEstimadas = estimativaAulas.reduce((acc, val) => acc + val, 0);
        let diferencaAulas = totalAulasNecessarias - somaAulasEstimadas;

        // Ajusta a contagem de aulas para corresponder ao total necessário
        // (A lógica de ajuste continua a mesma)
        while (diferencaAulas !== 0) {
            if (diferencaAulas > 0) {
                let indexParaAumentar = estimativaAulas.indexOf(Math.min(...estimativaAulas));
                estimativaAulas[indexParaAumentar]++;
                diferencaAulas--;
            } else {
                let indexParaDiminuir = estimativaAulas.indexOf(Math.max(...estimativaAulas));
                if (estimativaAulas[indexParaDiminuir] > 1) {
                    estimativaAulas[indexParaDiminuir]--;
                    diferencaAulas++;
                } else {
                    break;
                }
            }
        }

        // Atualiza a carga horária final de cada item no objeto principal
        conteudoDetalhado.forEach((item, index) => {
            item.cargaHoraria = estimativaAulas[index] * cargaDiaria;
        });

        const somaFinalHoras = conteudoDetalhado.reduce((acc, item) => acc + item.cargaHoraria, 0);
        console.log(`Carga horária final ajustada para ${somaFinalHoras}h, dividida em ${totalAulasNecessarias} aulas de ${cargaDiaria}h.`);


        // --- Início da Etapa 2.5: Calculista de Datas e Horas-Aula ---
        console.log("--- ETAPA 2.5: Calculando datas e distribuindo horas-aula... ---");
        let dataAtual = new Date(startDate + 'T00:00:00');
        // A constante cargaDiaria já foi declarada acima

        for (let i = 0; i < conteudoDetalhado.length; i++) {
            let item = conteudoDetalhado[i];
            if (item.cargaHoraria === 0) continue; // Pula tópicos sem carga horária

            while (dataAtual.getDay() === 0 || dataAtual.getDay() === 6) {
                dataAtual.setDate(dataAtual.getDate() + 1);
            }

            item.inicio = dataAtual.toLocaleDateString('pt-BR');

            let cargaHorariaTotalDoTopico = parseInt(item.cargaHoraria, 10);
            let duracaoEmDias = cargaHorariaTotalDoTopico / cargaDiaria;
            let horasPorDia = Array(duracaoEmDias).fill(cargaDiaria);

            let dataFim = new Date(dataAtual);
            let diasContados = 0;

            while (diasContados < duracaoEmDias - 1) {
                dataFim.setDate(dataFim.getDate() + 1);
                if (dataFim.getDay() !== 0 && dataFim.getDay() !== 6) {
                    diasContados++;
                }
            }

            item.cargaHoraria = horasPorDia.join(', ');
            item.fim = dataFim.toLocaleDateString('pt-BR');

            dataAtual = new Date(dataFim);
            dataAtual.setDate(dataAtual.getDate() + 1);
        }
        console.log("Cálculo de datas e horas-aula concluído.");
        sendUpdate("Cronograma calculado com sucesso");
        // ✨ NOVO: Captura a data final real calculada a partir do último tópico ✨
        const dataFimCalculada = conteudoDetalhado[conteudoDetalhado.length - 1].fim;

        // --- ETAPA 3: ENVIAR PARA A PLANILHA ---
        // (O resto do código continua sem alterações)
        const payloadParaAppsScript = {
            nomeCurso: courseName,
            nomeUC: ucName,
            // ✨ CORREÇÃO DE FUSO HORÁRIO: Garante que a data do cabeçalho também use o fuso local ✨
            dataInicioCurso: new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR'),
            dataFimCurso: dataFimCalculada, // ✨ ALTERADO: Usa a data final real calculada ✨
            cargaHorariaTotal: totalHours,
            conteudoDetalhado: conteudoDetalhado,
            imageUrl: LOGOTIPO_URL // ✨ Adicione esta linha ✨
        };

        console.log("Enviando dados para o Google Apps Script...");
        const appsScriptResponse = await axios.post(APPS_SCRIPT_URL, payloadParaAppsScript);

        console.log("Planilha criada! Retornando link para o usuário.");
        sendUpdate(`DONE:${JSON.stringify(appsScriptResponse.data)}`);
        // Termina a conexão
        res.end();

    } catch (error) {
        console.error("Erro no processo:", error);
        sendUpdate(`ERRO: ${error.message}`);
        res.end();
    }
});

app.listen(port, () => {
    console.log(`Servidor backend rodando em http://localhost:${port}`);
});