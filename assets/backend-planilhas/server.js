// --- server.js ---

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors'); // Importa o pacote CORS

// Configuração do servidor
const app = express();
const port = 3000;
const upload = multer({ storage: multer.memoryStorage() }); // Para receber arquivos em memória

app.use(cors()); // Habilita o CORS para que sua página web possa chamar este servidor
app.use(express.json()); // Permite que o servidor entenda JSON

// --- CONFIGURAÇÃO DAS SUAS CHAVES ---
const GEMINI_API_KEY = "AIzaSyBwMp1n1KPAo4z8kkwvYPIeZXqTd4sLAF0"; // <-- COLOQUE SUA CHAVE AQUI
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzjhausZnorbTPezSG6G1Nwdw7FA9fS-6ygG71DXpElhR50yDUXPod1BFfhUW2ZnRN7/exec"; // <-- COLOQUE O URL DA SUA "FÁBRICA" AQUI

// Inicializa o cliente do Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

// Endpoint principal que a sua página web irá chamar
app.post('/gerar-plano', upload.single('pdfFile'), async (req, res) => {
    console.log("Recebido pedido para gerar plano...");

    try {
        const { courseName, ucName, startDate, endDate, totalHours } = req.body;
        const pdfFile = req.file;

        if (!pdfFile) {
            return res.status(400).send({ error: 'Nenhum arquivo PDF foi enviado.' });
        }

        // 1. ANÁLISE DO PDF COM GEMINI
        console.log("Enviando PDF para análise do Gemini...");
        
       // =================================================================================
        //  ✨ PROMPT FINAL - COMBINANDO EXPERTISE PEDAGÓGICA E REQUISITOS TÉCNICOS ✨
        // =================================================================================
        const prompt = `
            Sua tarefa é atuar como um professor especialista em design instrucional para ensino técnico. Analise o PDF e os dados fornecidos para elaborar um plano de curso completo e detalhado.

            Dados de entrada:
            - Nome do Curso: ${courseName}
            - Nome da UC: ${ucName}
            - Período: ${startDate} a ${endDate}
            - Carga Horária Total: ${totalHours}

            Siga RIGOROSAMENTE as seguintes regras para extrair e gerar o conteúdo:

            1.  **CÁLCULO DE DATAS E CARGA HORÁRIA:**
                * Distribua a "Carga Horária Total" de forma lógica entre os tópicos do conteúdo.
                * Calcule as datas de "Início" e "Fim" para cada tópico, baseando-se no período total do curso e na carga horária de cada tópico. Assuma uma carga diária de 4 horas/dia se não especificado.

            2.  **ESTRUTURA DO CONTEÚDO (chave "oque"):**
                * Para cada tópico principal do PDF, o valor da chave "oque" deve ser uma string formatada exatamente assim:
                    "[Listar capacidades trabalhadas no tópico, separadas por ponto e vírgula];
                    Por meio de:
                    TÓPICO PRINCIPAL EM MAIÚSCULAS
                    X.1. Subtópico 1
                    X.2. Subtópico 2"

            3.  **ESTRATÉGIAS DE ENSINO (chave "como"):**
                * Para cada tópico, detalhe as estratégias, como "Exposição Dialogada", "Atividades Práticas", etc. As descrições devem ser ricas e com exemplos práticos. Ex: "Exposição Dialogada: Apresentar os conceitos de IoT com exemplos do cotidiano, como smartwatches e assistentes virtuais...".

            4.  **CRITÉRIOS DE AVALIAÇÃO (chave "criterios"):**
                * Para cada tópico, defina critérios claros no formato "O aluno demonstrou...".

            5.  **GERAÇÃO DA SAÍDA:**
                * Sua resposta final deve ser EXCLUSIVAMENTE um objeto JSON válido, sem nenhum texto, saudação ou explicação fora do JSON.
                * O objeto JSON DEVE ter a chave "conteudoDetalhado", que é um array de objetos.
                * Cada objeto no array DEVE conter TODAS as seguintes chaves, preenchidas com o conteúdo gerado: "oque", "como", "onde", "recursos", "cargaHoraria", "criterios", "instrumentos", "situacaoAprendizagem", "inicio", "fim".
        `;
        
        const filePart = {
            inlineData: {
                data: pdfFile.buffer.toString("base64"),
                mimeType: pdfFile.mimetype
            },
        };

        const result = await model.generateContent([prompt, filePart]);
        const responseText = result.response.text();

        // Limpeza e extração do JSON (caso o modelo ainda use markdown)
        const match = responseText.match(/```json([\s\S]*?)```/);
        let jsonString;
        if (match && match[1]) {
            jsonString = match[1].trim(); // Pega o conteúdo de dentro do bloco markdown
        } else {
            jsonString = responseText.trim(); // Assume que a resposta já é JSON puro
        }
        
        const geminiJson = JSON.parse(jsonString);
        
        console.log("Gemini retornou o conteúdo detalhado.");

        // 2. CHAMADA PARA O GOOGLE APPS SCRIPT
        const payloadParaAppsScript = {
            nomeCurso: courseName,
            nomeUC: ucName,
            dataInicioCurso: new Date(startDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
            dataFimCurso: new Date(endDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
            cargaHorariaTotal: totalHours,
            conteudoDetalhado: geminiJson.conteudoDetalhado
        };

        console.log("Enviando dados para o Google Apps Script...");
        const appsScriptResponse = await axios.post(APPS_SCRIPT_URL, payloadParaAppsScript);

        // 3. RETORNO PARA O FRONTEND
        console.log("Planilha criada! Retornando link para o usuário.");
        res.send(appsScriptResponse.data);

    } catch (error) {
        console.error("Erro no processo:", error);
        res.status(500).send({ error: "Falha ao processar a solicitação.", details: error.message });
    }
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor backend rodando em http://localhost:${port}`);
});