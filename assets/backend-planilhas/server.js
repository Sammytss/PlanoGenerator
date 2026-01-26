// --- server.js ---
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');
const XLSX = require('xlsx');

// Diz ao dotenv para encontrar o ficheiro .env no diretório atual
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Atribui o valor do .env a uma constante
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Diagnóstico para confirmar
console.log("Chave de API atribuída à constante:", GEMINI_API_KEY ? "SUCESSO" : "FALHA - undefined");

// Verifica se a chave foi carregada
if (!GEMINI_API_KEY) {
    throw new Error("A chave GEMINI_API_KEY não foi encontrada no ficheiro .env. Verifique o ficheiro e reinicie o servidor.");
}

// Inicializa o Google AI com a constante
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const app = express();
const port = 3000;

// Configuração do Multer para múltiplos ficheiros
const upload = multer({ storage: multer.memoryStorage() }).fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'matrixFile', maxCount: 1 }
]);

app.use(cors());
app.use(express.json());

// Link do Apps Script para criar a planilha
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMD3VdA6awCyL8KBoOcc7e0qN-gyh9aOxRnByBFYxN8mmpOk79562lJqGUGVsK1ynr/exec";
const LOGOTIPO_URL = "https://www.imagemhost.com.br/images/2024/11/22/Logo-novo-SENAI_-sem-slogan_755X325.png";
const generationConfig = {
    temperature: 0.4,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
};
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro", generationConfig });


app.post('/gerar-plano', upload, async (req, res) => {

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    const sendUpdate = (message) => {
        res.write(`${message}\n`);
    };

    try {
        let { courseName, ucName, instructorName, classCode, modality, startDate, endDate, totalHours, shift, capacidades, topicos, classDates, weekdays, holidays, vacationStart, vacationEnd, observacoes } = req.body;
        courseName = courseName ? courseName.toUpperCase() : '';
        ucName = ucName ? ucName.toUpperCase() : '';
        instructorName = instructorName ? instructorName.toUpperCase() : '';
        classCode = classCode ? classCode.toUpperCase() : '';
        modality = modality ? modality.toUpperCase() : '';
        const pdfFile = req.files.pdfFile[0];
        const matrixFile = req.files.matrixFile ? req.files.matrixFile[0] : null;
        // Prepara o contexto das instruções do usuário, se existirem
        let userInstructionsContext = "";
        if (observacoes && observacoes.trim() !== '') {
            userInstructionsContext = `
            ATENÇÃO: O utilizador forneceu as seguintes instruções especiais que DEVEM ser consideradas com alta prioridade:
            --- INSTRUÇÕES DO UTILIZADOR ---
            ${observacoes}
            --- FIM DAS INSTRUÇÕES ---
            `;
        }

        if (!pdfFile) {
            throw new Error('É necessário enviar o PDF para a elaboração do plano.');
        }

        const filePart = { inlineData: { data: pdfFile.buffer.toString("base64"), mimeType: pdfFile.mimetype } };

        // --- ETAPA 1: O EXTRATOR ---
        sendUpdate("ETAPA 1: A extrair a lista de tópicos do PDF");
        // =========================================================================
        //                          PROMPT DO EXTRATOR
        // =========================================================================
        const extractorPrompt = `
        Você é um especialista em análise de documentos pedagógicos.
        ${userInstructionsContext} // <<-- INSTRUÇÕES INJETADAS AQUI
            Sua tarefa é analisar o Plano de Curso em PDF fornecido e extrair a lista de "Conhecimentos" associada à Unidade Curricular especificada.

            1.  **Encontre o Ponto de Início:** Percorra o documento e localize o ponto exato onde a Unidade Curricular "${ucName}" é formalmente introduzida. IGNORE todo o conteúdo que aparecer ANTES deste ponto.
            2.  **Localize a Secção de Conhecimentos:** Após encontrar a UC "${ucName}", procure pela secção que lista os conteúdos a serem ensinados. Esta secção pode chamar-se "Conhecimento", "Conhecimentos", "Conteúdo Programático" ou similar.
            3.  **Identifique o Formato da Lista:** Verifique se os conhecimentos estão apresentados como:
                * a) Uma lista numerada (com ou sem subtópicos).
                * b) Uma única string de texto onde os itens são separados por vírgulas.
            4.  **Extraia e Formate os Tópicos:**
                * **Se for uma lista numerada (Formato a):** Para cada item principal, crie uma string contendo o item principal e todos os seus subtópicos, cada um em nova linha (como no exemplo de MICROCONTROLADORES).
                * **Se for uma string com vírgulas (Formato b):** Identifique a string completa que contém os conhecimentos. Divida esta string usando a vírgula como delimitador. Remova quaisquer espaços em branco extras no início ou fim de cada item resultante.
            5.  **Defina o Ponto Final:** Pare a sua análise assim que encontrar o início de uma NOVA Unidade Curricular ou uma secção claramente não relacionada aos conhecimentos (como "Habilidades", "Avaliação", etc.). A sua extração deve conter APENAS os conhecimentos da UC "${ucName}".
            6.  **Formato de Saída:** Sua resposta deve ser EXCLUSIVAMENTE um objeto JSON com uma única chave chamada "topicos". O valor desta chave deve ser um array de strings, onde cada string é um conhecimento individual extraído e formatado conforme o passo 4.

            **Exemplo de Saída (Formato b):**
            Se o PDF contiver "Conhecimento: Abstração lógica, álgebra booleana, fluxogramas.", a saída DEVE ser:
            {
              "topicos": [
                "Abstração lógica",
                "álgebra booleana",
                "fluxogramas"
              ]
            }
        `;
        const extractorResult = await model.generateContent([extractorPrompt, filePart]);
        const topicListJson = JSON.parse(extractorResult.response.text());
        const topicTitles = topicListJson.topicos;
        if (!topicTitles || topicTitles.length === 0) throw new Error("A Etapa 1 não conseguiu encontrar tópicos no PDF.");
        sendUpdate(`Extração concluída. Encontrados ${topicTitles.length} tópicos`);

        // =========================================================================
        //          ETAPA 2 FINAL: LÓGICA CONDICIONAL DA MATRIZ SAEP 
        // =========================================================================

        let saepMatrixString = "Não possui cruzamento de MATRIZ"; // Valor padrão

        //         --- ETAPA 2.1: ANÁLISE DA MATRIZ SE EXISTIR ---
        if (matrixFile) {
            sendUpdate("ETAPA 2.1: A analisar a Matriz SAEP para a Unidade Curricular");
            console.log("--- ETAPA 2.1: Analisando a Matriz SAEP... ---");

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

            const modelTextOnly = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
            const saepResult = await modelTextOnly.generateContent([saepAnalysisPrompt, dossieMatriz]);
            const analysisResult = saepResult.response.text();

            // Verifica se a IA encontrou a UC
            if (analysisResult.trim() !== "NAO_ENCONTRADO") {
                saepMatrixString = analysisResult; // Atualiza com o resultado real
                console.log("Análise da Matriz concluída com sucesso.");
                sendUpdate("Análise da Matriz concluída com sucesso");
            } else {
                console.log(`A UC "${ucName}" não foi encontrada na Matriz SAEP.`);
                sendUpdate(`Aviso: A UC "${ucName}" não foi encontrada na Matriz SAEP`);
            }
        } else {
            console.log("Nenhum ficheiro de Matriz SAEP foi enviado. A usar valor padrão.");
            sendUpdate("Aviso: Nenhum ficheiro de Matriz SAEP foi enviado. A prosseguir sem cruzamento");
        }

        // --- ETAPA 2.2: ELABORAÇÃO DO CONTEÚDO DE CADA TÓPICO ---

        sendUpdate("ETAPA 2.2: A elaborar o conteúdo de cada tópico do PDF");
        console.log("--- ETAPA 2.2: Elaborando conteúdo de cada tópico... ---");
        const conteudoDetalhado = [];

        for (const [index, title] of topicTitles.entries()) {
            sendUpdate(`   - A processar tópico ${index + 1} de ${topicTitles.length}: "${title}"`);

            // =========================================================================
            //         PROMPT DO ELABORADOR FINAL COM METODOLOGIA SENAI INTEGRADA
            // =========================================================================
            const elaboratorPrompt = `
                Você é um especialista em Design Instrucional do SENAI. Sua tarefa é elaborar o conteúdo detalhado para um único Conhecimento, seguindo estritamente a Metodologia SENAI.

                Conhecimento a ser detalhado (pode incluir subtópicos): 
                ---
                ${title}
                ---
                Contexto da Posição: Este é o conhecimento número ${index + 1} de um total de ${topicTitles.length}.

                Gere um único objeto JSON aplicando as seguintes regras de conteúdo:

                1.  **PARA A CHAVE "oque" (Associação Capacidade-Conhecimento):**
                    * Primeiro, analise a lista completa de "Capacidades Técnicas" apresentada no PDF para a Unidade Curricular "${ucName}".
                    * Em seguida, para o Conhecimento "${title}", identifique e selecione da lista completa **APENAS a(s) Capacidade(s) Técnica(s) que são diretamente desenvolvidas por este Conhecimento**.
                    * **FORMATAÇÃO OBRIGATÓRIA:** Formate o valor EXATAMENTE assim:
                        "[Liste AQUI a(s) capacidade(s) técnica(s) que você selecionou];
                        
                        Por meio de:
                        
                        ${title}" 

                2.  **PARA A CHAVE "como" (Estratégia de Ensino):**
                    * ESCOLHA no mínimo 1 e no máximo 2 estratégias da lista a seguir: ["Exposição dialogada", "Atividade prática", "Trabalho em grupo"].
                    * **FORMATAÇÃO OBRIGATÓRIA:** O texto final DEVE seguir este formato exato: comece com o nome da estratégia escolhida, seguido de dois pontos e um espaço, e então a descrição com verbos no infinitivo impessoal.
                    * Se houver duas estratégias, separe-as com uma linha em branco.
                    * A descrição deve ser bem resumida e com exemplos práticos.

                3.  **PARA AS CHAVES "instrumentos" e "criterios":**
                    * **DIRETRIZES PEDAGÓGICAS PARA "instrumentos":** Em vez de uma regra fixa, a sua escolha deve ser uma decisão pedagógica baseada em TRÊS fatores:
                        a. **A Estratégia em "como":** O instrumento deve ser coerente com a estratégia (ex: uma "Ficha de Observação" faz sentido para uma "Atividade prática").
                        b. **O Conteúdo em "${title}":** O instrumento deve ser adequado para avaliar aquele conhecimento específico (ex: um "Relatório" para um tópico de análise, uma "Lista de Exercícios" para um tópico de cálculo).
                        c. **A Variedade:** **REGRA MAIS IMPORTANTE:** Esforce-se para variar os instrumentos ao longo do plano. EVITE repetir o mesmo instrumento de avaliação para conhecimentos seguidos, a menos que seja pedagogicamente essencial.
                    * **LISTA DE OPÇÕES DISPONÍVEIS:** "Lista de Exercícios", "Ficha de Observação", "Relatório", "Portfólio", "Prova de Resposta Construída", "Autoavaliação".
                    * **REGRA DE FIM DE CURSO:** Se este for o último ou penúltimo conhecimento, você PODE escolher "Prova Prática", "Prova Objetiva" ou "Trabalho em Grupo" se for lógico.
                    * **"criterios":** Defina UM critério de avaliação claro, direto e no passado, no formato "O aluno...", que se relacione DIRETAMENTE com o instrumento escolhido.
                         
                4.  **PARA AS OUTRAS CHAVES ("onde", "recursos", "situacaoAprendizagem"):**
                    * Preencha com informações pertinentes para o conhecimento em questão.
                
                5.  **PARA A CHAVE "recursos" (Formatação Específica):**
                    * **FORMATAÇÃO OBRIGATÓRIA:** Formate o resultado como uma ÚNICA string de texto onde CADA recurso individual está em uma NOVA LINHA e TERMINA com um PONTO E VÍRGULA (;).
                    * **EXEMPLO DE FORMATAÇÃO CORRETA:** "Data show;\\nQuadro;\\nPincel;\\nComputadores;"
                    * NÃO adicione marcadores (como '*') ou numeração. Apenas o recurso seguido de ponto e vírgula e uma quebra de linha.
                    
                6.  **CÁLCULOS:**
                    * Estime uma "cargaHoraria" numérica lógica.
                    * Deixe as chaves "inicio" e "fim" como strings vazias.
            `;

            const elaboratorResult = await model.generateContent([elaboratorPrompt, filePart]);
            const topicDetailJson = JSON.parse(elaboratorResult.response.text());

            // Adiciona o resultado da análise ao JSON
            topicDetailJson.saep = saepMatrixString;

            conteudoDetalhado.push(topicDetailJson);
        }
        console.log("Elaboração de todos os tópicos concluída.");
        sendUpdate("Elaboração de todos os tópicos concluída");

        // =========================================================================
        //          ETAPA 2.3: GERADOR INTELIGENTE DE AVALIAÇÃO FINAL 
        // =========================================================================
        if (conteudoDetalhado.length > 0) {
            sendUpdate("ETAPA 2.3: A gerar uma avaliação final contextualizada");
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

            // Substituição dos valores do último tópico pelos valores gerados
            ultimoTopico.instrumentos = assessmentJson.instrumentos || "Prova Prática";
            ultimoTopico.como = assessmentJson.como || "Atividade avaliativa final.";
            ultimoTopico.criterios = assessmentJson.criterios || "O aluno demonstrou as competências da UC.";

            console.log(`Avaliação final definida como: "${ultimoTopico.instrumentos}".`);
            sendUpdate(`Avaliação final definida como: "${ultimoTopico.instrumentos}"`);
        }

        // =========================================================================
        //                     LÓGICA DE DATAS CENÁRIOS A e B
        // =========================================================================
        const cargaDiaria = parseInt(shift, 10);
        const parsedHolidays = (holidays || '').split(',').map(h => h.trim()).filter(h => h).map(h => new Date(h.split('/').reverse().join('-') + 'T00:00:00').getTime());
        const vacationStartDate = vacationStart ? new Date(vacationStart + 'T00:00:00') : null;
        const vacationEndDate = vacationEnd ? new Date(vacationEnd + 'T00:00:00') : null;

        const isExceptionDay = (date) => {
            const dateTimestamp = date.getTime();
            if (parsedHolidays.includes(dateTimestamp)) return true;
            if (vacationStartDate && vacationEndDate && date >= vacationStartDate && date <= vacationEndDate) return true;
            return false;
        };

        let validClassDays = [];

        //  GERAÇÃO DA LISTA DE DIAS VÁLIDOS
        if (classDates && classDates.trim() !== '') {
            // Datas Específicas
            console.log("MODO: Datas Específicas.");
            validClassDays = classDates.split(', ')
                .map(d => new Date(d.split('/').reverse().join('-') + 'T00:00:00'))
                .filter(date => !isExceptionDay(date))
                .sort((a, b) => a - b);
        } else {
            // Recorrente
            console.log("MODO: Recorrente (Dias da Semana).");
            let totalAulasNecessarias = Math.ceil(parseInt(totalHours, 10) / cargaDiaria);
            let selectedWeekdays = (Array.isArray(weekdays) ? weekdays : (weekdays ? [weekdays] : [])).map(Number);
            let currentDate = new Date(startDate + 'T00:00:00');

            while (validClassDays.length < totalAulasNecessarias) {
                const dayOfWeek = currentDate.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    if ((selectedWeekdays.length > 0 && selectedWeekdays.includes(dayOfWeek)) || selectedWeekdays.length === 0) {
                        if (!isExceptionDay(currentDate)) {
                            validClassDays.push(new Date(currentDate));
                        }
                    }
                }
                currentDate.setDate(currentDate.getDate() + 1);
                if (currentDate.getFullYear() > new Date(startDate).getFullYear() + 3) break;
            }
        }

        if (validClassDays.length === 0) throw new Error("Nenhuma data de aula válida foi encontrada.");
        console.log(`DIAS VÁLIDOS ENCONTRADOS: ${validClassDays.length}`);


        // DISTRIBUIÇÃO INTELIGENTE
        const totalAulasDisponiveis = validClassDays.length;
        const totalTopicos = conteudoDetalhado.length;
        let planoFinal = [];

        if (totalAulasDisponiveis >= totalTopicos) {
            // --- CENÁRIO A: EXPANSÃO. Quando há mais dias que tópicos ---
            console.log("Cenário A: Expansão");

            let estimativaAulas = conteudoDetalhado.map(() => 1);
            let diasAlocados = totalTopicos;
            let diasRestantes = totalAulasDisponiveis - diasAlocados;

            let i = 0;
            while (diasRestantes > 0) {
                estimativaAulas[i]++;
                diasRestantes--;
                i = (i + 1) % totalTopicos;
            }

            conteudoDetalhado.forEach((item, index) => {
                const duracaoEmDias = estimativaAulas[index];

                // Gera carga horária separada por vírgulas para o Apps Script criar linhas
                const arrayCarga = Array(duracaoEmDias).fill(cargaDiaria);
                item.cargaHoraria = arrayCarga.join(', ');

                planoFinal.push(item);
            });

        } else {
            // --- CENÁRIO B: COMPACTAÇÃO. Quando há mais tópicos que dias ---
            console.log("Cenário B: Compactação");

            // Inicializa os slots dos dias
            planoFinal = validClassDays.map(() => ({
                oque: [], como: [], recursos: [], instrumentos: [], criterios: [], situacaoAprendizagem: [],
                onde: [], 
                saep: "",
                cargaHoraria: cargaDiaria.toString()
            }));

            // Distribui os tópicos nos slots disponíveis
            conteudoDetalhado.forEach((item, index) => {
                const dayIndex = Math.floor((index * totalAulasDisponiveis) / totalTopicos);
                const safeDayIndex = Math.min(dayIndex, totalAulasDisponiveis - 1);

                const diaAlvo = planoFinal[safeDayIndex];

                if (item.oque) diaAlvo.oque.push(item.oque);
                if (item.como) diaAlvo.como.push(item.como);
                if (item.recursos) diaAlvo.recursos.push(item.recursos);

                if (item.onde) diaAlvo.onde.push(item.onde);

                // Evita duplicatas em instrumentos
                if (item.instrumentos && !diaAlvo.instrumentos.includes(item.instrumentos)) {
                    diaAlvo.instrumentos.push(item.instrumentos);
                }

                if (item.criterios) diaAlvo.criterios.push(item.criterios);
                if (item.situacaoAprendizagem) diaAlvo.situacaoAprendizagem.push(item.situacaoAprendizagem);

                if (!diaAlvo.saep) diaAlvo.saep = item.saep;
            });

            // Converte os arrays de volta para strings formatadas
            planoFinal = planoFinal.map(dia => ({
                oque: dia.oque.join('\n\n---\n\n'),
                como: dia.como.join('\n\n'),
                recursos: dia.recursos.join('\n'),
                instrumentos: dia.instrumentos.join(' / '),
                criterios: dia.criterios.join('\n'),
                situacaoAprendizagem: dia.situacaoAprendizagem.join('\n\n'),
                // Junta os locais removendo duplicatas (ex: Lab Info / Sala Aula)
                onde: [...new Set(dia.onde)].join(' / '),
                saep: dia.saep,
                cargaHoraria: dia.cargaHoraria
            }));
        }

        // Substitui o array original pelo processado
        conteudoDetalhado.length = 0;
        planoFinal.forEach(item => conteudoDetalhado.push(item));

        const dataFimCalculada = validClassDays[validClassDays.length - 1].toLocaleDateString('pt-BR');
        sendUpdate("Cronograma distribuído com sucesso");
        // --- ETAPA 3: ENVIAR PARA A PLANILHA ---
        const payloadParaAppsScript = {
            nomeCurso: courseName,
            nomeUC: ucName,
            instrutor: instructorName,
            codigoTurma: classCode,
            modalidade: modality,
            dataInicioCurso: new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR'),
            dataFimCurso: dataFimCalculada,
            cargaHorariaTotal: totalHours,
            conteudoDetalhado: conteudoDetalhado,
            imageUrl: LOGOTIPO_URL,
            diasDeAulaValidos: validClassDays.map(date => date.toLocaleDateString('pt-BR')),
            shift: shift
        };

        sendUpdate("ETAPA 3: A comunicar com o Google e a criar a sua planilha");
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
