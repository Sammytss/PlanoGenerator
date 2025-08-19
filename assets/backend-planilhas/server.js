// --- server.js VERSÃO FINAL E COMPLETA ---

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');
const XLSX = require('xlsx');

// ✨ CORREÇÃO: A criação do 'app' deve estar aqui no início ✨
const app = express();
const port = 3000;

// Configuração do Multer para múltiplos ficheiros
const upload = multer({ storage: multer.memoryStorage() }).fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'matrixFile', maxCount: 1 }
]);

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


app.post('/gerar-plano', upload, async (req, res) => {
    // A configuração de streaming e a função sendUpdate permanecem as mesmas
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    const sendUpdate = (message) => {
        res.write(`${message}\n`);
    };

    try {
        const { courseName, ucName, startDate, endDate, totalHours, shift } = req.body;
        const pdfFile = req.files.pdfFile[0];
        const matrixFile = req.files.matrixFile[0];

        if (!pdfFile || !matrixFile) {
            throw new Error('É necessário enviar tanto o PDF quanto a Matriz XLSX.');
        }
        
        // --- ETAPA DE PRÉ-PROCESSAMENTO DO XLSX ---
        sendUpdate("A ler e a processar o ficheiro da Matriz de Referência .xlsx...");
        const workbook = XLSX.read(matrixFile.buffer, { type: 'buffer' });
        const sheetDetalhamento = workbook.Sheets['Detalhamento'];
        const sheetRelacionamento = workbook.Sheets['Relacionamento'];
        const csvDetalhamento = XLSX.utils.sheet_to_csv(sheetDetalhamento);
        const csvRelacionamento = XLSX.utils.sheet_to_csv(sheetRelacionamento);
        const dossieMatriz = `
--- DADOS DA PLANILHA 'DETALHAMENTO' ---
${csvDetalhamento}
--- FIM DOS DADOS DA PLANILHA 'DETALHAMENTO' ---

--- DADOS DA PLANILHA 'RELACIONAMENTO' ---
${csvRelacionamento}
--- FIM DOS DADOS DA PLANILHA 'RELACIONAMENTO' ---
        `;
        console.log("Dossiê da Matriz criado com sucesso.");

        const filePart = { inlineData: { data: pdfFile.buffer.toString("base64"), mimeType: pdfFile.mimetype } };

        // --- ETAPA 1: O EXTRATOR ---
        sendUpdate("ETAPA 1: A extrair a lista de tópicos do PDF...");
        const extractorPrompt = `Sua única tarefa é analisar a seção "CONHECIMENTOS" do PDF e extrair a lista completa de todos os tópicos principais numerados. Responda EXCLUSIVAMENTE com um objeto JSON com uma única chave chamada "topicos".`;
        const extractorResult = await model.generateContent([extractorPrompt, filePart]);
        const topicListJson = JSON.parse(extractorResult.response.text());
        const topicTitles = topicListJson.topicos;
        if (!topicTitles || topicTitles.length === 0) throw new Error("A Etapa 1 não conseguiu encontrar tópicos no PDF.");
        sendUpdate(`Extração concluída. Encontrados ${topicTitles.length} tópicos.`);

        // --- ETAPA 2 OTIMIZADA: ANÁLISE ÚNICA DA MATRIZ + ELABORAÇÃO ---
        
        // ETAPA 2.1: ANÁLISE DA MATRIZ (UMA ÚNICA VEZ)
        sendUpdate("ETAPA 2.1: A analisar a Matriz SAEP para a Unidade Curricular...");
        const saepAnalysisPrompt = `
            Você é um analista de dados. Sua única tarefa é analisar o dossiê de texto da Matriz de Referência SAEP fornecido.
            Encontre a Unidade Curricular (UC) "${ucName}" e execute as seguintes extrações:
            1. Extraia o código e a descrição completa da "CAPACIDADE SAEP" principal associada a esta UC.
            2. Extraia a lista completa de números e descrições textuais dos "CONHECIMENTOS" vinculados a esta UC.
            FORMATE O RESULTADO como uma única string de texto com múltiplas linhas, seguindo EXATAMENTE este formato:
            "CÓDIGO - Descrição completa da Capacidade SAEP
            
            Número - Descrição do Conhecimento 1
            Número - Descrição do Conhecimento 2
            ..."
            Responda APENAS com esta string formatada, sem nenhum texto adicional.
        `;
        const modelTextOnly = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
        const saepResult = await modelTextOnly.generateContent([saepAnalysisPrompt, dossieMatriz]);
        const saepMatrixString = saepResult.response.text();
        console.log("Análise da Matriz concluída.");
        sendUpdate("Análise da Matriz concluída.");

        // ETAPA 2.2: ELABORAÇÃO DO CONTEÚDO DE CADA TÓPICO
        sendUpdate("ETAPA 2.2: A elaborar o conteúdo de cada tópico do PDF...");
        const conteudoDetalhado = [];
        for (const [index, title] of topicTitles.entries()) {
            sendUpdate(`   - A processar tópico ${index + 1} de ${topicTitles.length}: "${title}"`);
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
                    * Estime datas de "inicio" e "fim" para este tópico. As datas DEVEM estar no formato "DD/MM/AAAA"
            `;
            const elaboratorResult = await model.generateContent([elaboratorPrompt, filePart]);
            const topicDetailJson = JSON.parse(elaboratorResult.response.text());
            topicDetailJson.saep = saepMatrixString;
            conteudoDetalhado.push(topicDetailJson);
        }
        console.log("Elaboração de todos os tópicos concluída.");
        sendUpdate("Elaboração de todos os tópicos concluída.");

        // --- ETAPA 2.4 E 2.5: NORMALIZAÇÃO E CÁLCULO ---
        console.log("--- ETAPA 2.4: Normalizando para horas-aula completas... ---");
        const cargaDiaria = shift === 'noturno' ? 3 : 4;
        const totalAulasNecessarias = Math.ceil(totalHours / cargaDiaria);
        let estimativaAulas = conteudoDetalhado.map(item => {
            const horasEstimadas = parseInt(item.cargaHoraria, 10) || 0;
            return horasEstimadas > 0 ? Math.max(1, Math.round(horasEstimadas / cargaDiaria)) : 0;
        });
        let somaAulasEstimadas = estimativaAulas.reduce((acc, val) => acc + val, 0);
        let diferencaAulas = totalAulasNecessarias - somaAulasEstimadas;
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
        conteudoDetalhado.forEach((item, index) => {
            item.cargaHoraria = estimativaAulas[index] * cargaDiaria;
        });
        
        console.log("--- ETAPA 2.5: Calculando datas e distribuindo horas-aula... ---");
        let dataAtual = new Date(startDate + 'T00:00:00');
        for (let i = 0; i < conteudoDetalhado.length; i++) {
            let item = conteudoDetalhado[i];
            if (item.cargaHoraria === 0) continue;
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
        sendUpdate("Cronograma calculado com sucesso");
        const dataFimCalculada = conteudoDetalhado.length > 0 ? conteudoDetalhado[conteudoDetalhado.length - 1].fim : new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR');

        // --- ETAPA 3: ENVIAR PARA A PLANILHA ---
        const payloadParaAppsScript = {
            nomeCurso: courseName,
            nomeUC: ucName,
            dataInicioCurso: new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR'),
            dataFimCurso: dataFimCalculada,
            cargaHorariaTotal: totalHours,
            conteudoDetalhado: conteudoDetalhado,
            imageUrl: LOGOTIPO_URL
        };

        sendUpdate("ETAPA 3: A comunicar com o Google e a criar a sua planilha...");
        const appsScriptResponse = await axios.post(APPS_SCRIPT_URL, payloadParaAppsScript);
        sendUpdate(`DONE:${JSON.stringify(appsScriptResponse.data)}`);
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