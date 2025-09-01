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
        const matrixFile = req.files.matrixFile ? req.files.matrixFile[0] : null;

        if (!pdfFile) {
            throw new Error('É necessário enviar o PDF para a elaboração do plano.');
        }

        const filePart = { inlineData: { data: pdfFile.buffer.toString("base64"), mimeType: pdfFile.mimetype } };

        // --- ETAPA 1: O EXTRATOR ---
        sendUpdate("ETAPA 1: A extrair a lista de tópicos do PDF...");
        // =========================================================================
        // ✨ PROMPT DO EXTRATOR FINAL: COM AGRUPAMENTO HIERÁRQUICO ✨
        // =========================================================================
        const extractorPrompt = `
            Você é um especialista em análise de documentos pedagógicos. Sua tarefa é analisar o Plano de Curso em PDF e extrair a lista de "Conhecimentos" de forma estruturada.

            1.  **Identifique os Conhecimentos Principais:** Localize a lista de conteúdos a serem ensinados (pode chamar-se "Conhecimentos", "Conteúdo Programático", etc.). Os conhecimentos principais são geralmente numerados (ex: "1. TEMA", "2. TEMA").
            2.  **Identifique os Subtópicos:** Para cada conhecimento principal, identifique todos os seus subtópicos associados (ex: "1.1. Subtema", "1.2. Subtema").
            3.  **Agrupe o Conteúdo:** Para cada conhecimento principal, crie uma ÚNICA string de texto. Esta string DEVE começar com o conhecimento principal, seguido por todos os seus subtópicos, cada um numa nova linha.
            
            **EXEMPLO DE AGRUPAMENTO CORRETO:**
            Se o PDF tiver:
            2. MICROCONTROLADORES
            2.1. Aplicações
            2.2. Arduino
            A sua string de saída para este item deve ser: "2. MICROCONTROLADORES\n2.1. Aplicações\n2.2. Arduino"

            4.  **Formato de Saída:** Sua resposta deve ser EXCLUSIVAMENTE um objeto JSON com uma única chave chamada "topicos", que contém um array destas strings agrupadas.
        `;
        const extractorResult = await model.generateContent([extractorPrompt, filePart]);
        const topicListJson = JSON.parse(extractorResult.response.text());
        const topicTitles = topicListJson.topicos;
        if (!topicTitles || topicTitles.length === 0) throw new Error("A Etapa 1 não conseguiu encontrar tópicos no PDF.");
        sendUpdate(`Extração concluída. Encontrados ${topicTitles.length} tópicos.`);

        // =========================================================================
        // ✨ ETAPA 2 FINAL: LÓGICA CONDICIONAL DA MATRIZ SAEP ✨
        // =========================================================================
        
        let saepMatrixString = "Não possui cruzamento de MATRIZ"; // Valor padrão

        // --- ETAPA 2.1: ANÁLISE DA MATRIZ (SE O FICHEIRO EXISTIR) ---
        if (matrixFile) {
            sendUpdate("ETAPA 2.1: A analisar a Matriz SAEP para a Unidade Curricular...");
            console.log("--- ETAPA 2.1: Analisando a Matriz SAEP... ---");
            
            // O seu código de pré-processamento do XLSX permanece aqui
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

            const saepAnalysisPrompt = `
            Você é um analista de dados. Sua única tarefa é analisar o dossiê de texto da Matriz de Referência SAEP fornecido.
            Encontre a Unidade Curricular (UC) "${ucName}" e execute as seguintes extrações:
            1. Extraia o código e a descrição completa da "CAPACIDADE SAEP" principal associada a esta UC.
            2. Extraia a lista completa de números e descrições textuais dos "CONHECIMENTOS" vinculados a esta UC.
            FORMATE O RESULTADO como uma única string de texto com múltiplas linhas, seguindo EXATAMENTE este formato:
            "CÓDIGO - Descrição completa da Capacidade SAEP.
            Se NÃO encontrar a UC "${ucName}" no dossiê, responda APENAS com a palavra "NAO_ENCONTRADO".
            `;
            
            const modelTextOnly = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
            const saepResult = await modelTextOnly.generateContent([saepAnalysisPrompt, dossieMatriz]);
            const analysisResult = saepResult.response.text();
            
            // Verifica se a IA encontrou a UC
            if (analysisResult.trim() !== "NAO_ENCONTRADO") {
                saepMatrixString = analysisResult; // Atualiza com o resultado real
                console.log("Análise da Matriz concluída com sucesso.");
                sendUpdate("Análise da Matriz concluída com sucesso.");
            } else {
                console.log(`A UC "${ucName}" não foi encontrada na Matriz SAEP.`);
                sendUpdate(`Aviso: A UC "${ucName}" não foi encontrada na Matriz SAEP.`);
            }
        } else {
            console.log("Nenhum ficheiro de Matriz SAEP foi enviado. A usar valor padrão.");
            sendUpdate("Aviso: Nenhum ficheiro de Matriz SAEP foi enviado. A prosseguir sem cruzamento.");
        }

        // --- ETAPA 2.2: ELABORAÇÃO DO CONTEÚDO DE CADA TÓPICO ---
        // (Esta parte do código permanece exatamente a mesma, pois já usa a variável saepMatrixString)
        sendUpdate("ETAPA 2.2: A elaborar o conteúdo de cada tópico do PDF...");
        console.log("--- ETAPA 2.2: Elaborando conteúdo de cada tópico... ---");
        const conteudoDetalhado = [];

        for (const [index, title] of topicTitles.entries()) {
            sendUpdate(`   - A processar tópico ${index + 1} de ${topicTitles.length}: "${title}"`);
            
            // =========================================================================
            // ✨ PROMPT ATUALIZADO COM MATRIZ DE DECISÃO PARA AVALIAÇÃO ✨
            // =========================================================================
            const elaboratorPrompt = `
                Você é um professor especialista em design instrucional. Sua tarefa é elaborar o conteúdo detalhado para um único tópico de um plano de curso, seguindo uma matriz de decisão pedagógica de forma INFLEXÍVEL.

                Tópico a ser detalhado: "${title}"
                Contexto da Posição: Este é o tópico número ${index + 1} de um total de ${topicTitles.length} tópicos.

                Gere um único objeto JSON aplicando as seguintes regras de conteúdo:

                1.  **PARA A CHAVE "oque":**
                    * Formate o valor EXATAMENTE assim:
                        "[Listar as capacidades técnicas relevantes para este tópico, extraídas do PDF];

                        Por meio de:

                        ${title.toUpperCase()}
                        *Se houver subtópicos, liste-os numericamente, por exemplo:
                        X.1. Subtópico 1
                        X.2. Subtópico 2..."

                2.  **PARA A CHAVE "como" (Estratégia de Ensino):**
                    * ESCOLHA no mínimo 1 e no máximo 2 estratégias da lista a seguir: ["Exposição dialogada", "Atividade prática", "Trabalho em grupo"].
                    * **FORMATAÇÃO OBRIGATÓRIA:** O texto final DEVE seguir este formato exato: comece com o nome da estratégia escolhida, seguido de dois pontos e um espaço, e então a descrição com verbos no infinitivo impessoal.
                    * Se houver duas estratégias, separe-as com uma linha em branco.
                    * A descrição deve ser bem resumida e com exemplos práticos.

                3.  **PARA AS CHAVES "instrumentos" e "criterios":**
                    * **MATRIZ DE DECISÃO PARA "instrumentos":** Sua escolha DEVE seguir estritamente estas regras, baseada na primeira estratégia escolhida em "como":
                        * Se a estratégia for "Atividade prática": ESCOLHA entre "Ficha de Observação", "Relatório" ou "Portfólio".
                        * Se a estratégia for "Exposição dialogada": ESCOLHA entre "Prova de Resposta Construída" ou "Autoavaliação".
                        * Se a estratégia for "Trabalho em grupo": ESCOLHA entre "Relatório" ou "Portfólio".
                    * **REGRA ESPECIAL DE FIM DE CURSO:** Se este tópico for o último ou o penúltimo (ou seja, se o número do tópico for ${topicTitles.length} ou ${topicTitles.length - 1}), você PODE escolher "Prova Prática" ou "Prova Objetiva", caso seja a opção mais lógica. Fora isso, EVITE estes dois instrumentos.
                    * **"criterios":** Defina UM critério de avaliação claro, direto e no passado, no formato "O aluno...", que se relacione DIRETAMENTE com o instrumento escolhido.

                4.  **PARA AS OUTRAS CHAVES ("onde", "recursos", "situacaoAprendizagem"):**
                    * Preencha com informações pertinentes e diretas para o tópico em questão.
                
                5.  **CÁLCULOS:**
                    * Estime uma "cargaHoraria" numérica lógica para este tópico.
                    * Deixe as chaves "inicio" e "fim" como strings vazias, pois elas serão calculadas depois.
            `;

            const elaboratorResult = await model.generateContent([elaboratorPrompt, filePart]);
            const topicDetailJson = JSON.parse(elaboratorResult.response.text());

            // Adiciona o resultado da análise (ou o texto padrão) ao JSON
            topicDetailJson.saep = saepMatrixString;
            
            conteudoDetalhado.push(topicDetailJson);
        }
        console.log("Elaboração de todos os tópicos concluída.");
        sendUpdate("Elaboração de todos os tópicos concluída.");

        // =========================================================================
        // ✨ NOVA ETAPA 2.3: GERADOR INTELIGENTE DE AVALIAÇÃO FINAL ✨
        // =========================================================================
        if (conteudoDetalhado.length > 0) {
            sendUpdate("ETAPA 2.3: A gerar uma avaliação final contextualizada...");
            console.log("--- ETAPA 2.3: Gerando avaliação final contextualizada... ---");

            const todosOsTopicos = topicTitles.join('; ');
            const ultimoTopico = conteudoDetalhado[conteudoDetalhado.length - 1];

            const finalAssessmentPrompt = `
                Você é um coordenador pedagógico encarregado de criar a avaliação final para a Unidade Curricular (UC) "${ucName}".
                A UC abordou os seguintes tópicos: "${todosOsTopicos}".

                Sua tarefa é criar um objeto JSON com três chaves ("instrumentos", "como", "criterios") para a avaliação somativa final.

                Siga estas regras INFLEXIVELMENTE:
                1.  **PARA A CHAVE "instrumentos":** Analise os tópicos e escolha o instrumento de avaliação final mais adequado da seguinte lista: ["Trabalho Final", "Prova Prática", "Prova Objetiva"]. A sua escolha deve ser a que melhor avalia o conjunto das competências desenvolvidas.
                2.  **PARA A CHAVE "como":** Crie uma descrição resumida para a "Estratégia de Ensino" (neste caso, uma atividade avaliativa) que seja coerente com o instrumento escolhido e que abranja os principais temas da UC. Use verbos no infinitivo.
                3.  **PARA A CHAVE "criterios":** Defina UM critério de avaliação claro, direto e no passado (formato "O aluno..."), que avalie o desempenho do aluno na atividade final proposta.
            `;
            
            // Usamos o modelo que espera JSON
            const assessmentResult = await model.generateContent([finalAssessmentPrompt, filePart]);
            const assessmentJson = JSON.parse(assessmentResult.response.text());

            // Substituímos os valores do último tópico pelos valores gerados
            ultimoTopico.instrumentos = assessmentJson.instrumentos || "Prova Prática";
            ultimoTopico.como = assessmentJson.como || "Atividade avaliativa final.";
            ultimoTopico.criterios = assessmentJson.criterios || "O aluno demonstrou as competências da UC.";
            
            console.log(`Avaliação final definida como: "${ultimoTopico.instrumentos}".`);
            sendUpdate(`Avaliação final definida como: "${ultimoTopico.instrumentos}".`);
        }

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