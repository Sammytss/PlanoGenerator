const axios = require('axios');
const XLSX = require('xlsx');
const { client, generationConfig } = require('../config/ai');
const { APPS_SCRIPT_URL, LOGOTIPO_URL } = require('../config');
const { normalizarInstrumentos, usaFichaDeObservacao } = require('./instrumentos');
const { separarCapacidadesEConhecimento } = require('./planParser');

/**
 * Fluxo completo de geração do plano.
 * - Lê dados do formulário e ficheiros
 * - Usa Gemini para extrair tópicos e elaborar conteúdos
 * - Calcula cronograma/datas
 * - Envia payload para o Apps Script
 *
 * @param {{ body: any, pdfFile: Express.Multer.File | null, matrixFile: Express.Multer.File | null }} params
 * @param {(msg: string) => void} sendUpdate função para enviar mensagens de progresso (streaming)
 * @returns {Promise<any>} dados retornados pelo Apps Script (spreadsheetUrl e spreadsheetName)
 */
async function gerarPlano({ body, pdfFile, matrixFile }, sendUpdate) {
  let {
    courseName,
    ucName,
    instructorName,
    classCode,
    modality,
    unidadeEscolar,
    startDate,
    endDate,
    totalHours,
    shift,
    capacidades,
    topicos,
    classDates,
    weekdays,
    holidays,
    vacationStart,
    vacationEnd,
    observacoes,
  } = body;

  courseName = courseName ? courseName.toUpperCase() : '';
  ucName = ucName ? ucName.toUpperCase() : '';
  instructorName = instructorName ? instructorName.toUpperCase() : '';
  classCode = classCode ? classCode.toUpperCase() : '';
  modality = modality ? modality.toUpperCase() : '';

  // Prepara o contexto das instruções do usuário, se existirem
  let userInstructionsContext = '';
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

  const filePart = {
    inlineData: {
      data: pdfFile.buffer.toString('base64'),
      mimeType: pdfFile.mimetype,
    },
  };

  // --- ETAPA 1: O EXTRATOR ---
  sendUpdate('ETAPA 1: A extrair a lista de tópicos do PDF');

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

  const extractorResult = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [extractorPrompt, filePart],
    config: generationConfig
  });
  const topicListJson = JSON.parse(extractorResult.text);
  const topicTitles = topicListJson.topicos;

  if (!topicTitles || topicTitles.length === 0) {
    throw new Error('A Etapa 1 não conseguiu encontrar tópicos no PDF.');
  }

  sendUpdate(`Extração concluída. Encontrados ${topicTitles.length} tópicos`);

  // =========================================================================
  //          ETAPA 2 FINAL: LÓGICA CONDICIONAL DA MATRIZ SAEP
  // =========================================================================

  let saepMatrixString = 'Não possui cruzamento de MATRIZ'; // Valor padrão

  //         --- ETAPA 2.1: ANÁLISE DA MATRIZ SE EXISTIR ---
  if (matrixFile) {
    sendUpdate('ETAPA 2.1: A analisar a Matriz SAEP para a Unidade Curricular');
    console.log('--- ETAPA 2.1: Analisando a Matriz SAEP... ---');

    const workbook = XLSX.read(matrixFile.buffer, { type: 'buffer' });
    const sheetDetalhamento = workbook.Sheets.Detalhamento;
    const sheetRelacionamento = workbook.Sheets.Relacionamento;
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

    const saepResult = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [saepAnalysisPrompt, dossieMatriz]
    });
    const analysisResult = saepResult.text;

    // Verifica se a IA encontrou a UC
    if (analysisResult.trim() !== 'NAO_ENCONTRADO') {
      saepMatrixString = analysisResult; // Atualiza com o resultado real
      console.log('Análise da Matriz concluída com sucesso.');
      sendUpdate('Análise da Matriz concluída com sucesso');
    } else {
      console.log(`A UC "${ucName}" não foi encontrada na Matriz SAEP.`);
      sendUpdate(`Aviso: A UC "${ucName}" não foi encontrada na Matriz SAEP`);
    }
  } else {
    console.log('Nenhum ficheiro de Matriz SAEP foi enviado. A usar valor padrão.');
    sendUpdate('Aviso: Nenhum ficheiro de Matriz SAEP foi enviado. A prosseguir sem cruzamento');
  }

  // --- ETAPA 2.2: ELABORAÇÃO DO CONTEÚDO DE CADA TÓPICO ---

  sendUpdate('ETAPA 2.2: A elaborar o conteúdo de cada tópico do PDF');
  console.log('--- ETAPA 2.2: Elaborando conteúdo de cada tópico... ---');

  const conteudoDetalhado = [];

  for (const [index, title] of topicTitles.entries()) {
    sendUpdate(`   - A processar tópico ${index + 1} de ${topicTitles.length}: "${title}"`);

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

                1.1 **PARA A CHAVE "capacidades" (lista estruturada):**
                    * Devolva AS MESMAS capacidades usadas na chave "oque", mas como um ARRAY DE STRINGS.
                    * Cada string deve conter o código e a descrição integral da capacidade (ex.: "H99 - Aplicar linguagem de programação por meio do ambiente integrado de desenvolvimento (IDE)").
                    * Esta lista é usada para montar as Fichas de Observação e as Situações de Aprendizagem, por isso NÃO abrevie e NÃO agrupe capacidades diferentes na mesma string.

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
                         
                4.  **PARA AS OUTRAS CHAVES ("onde", "recursos"):**
                    * Preencha com informações pertinentes para o conhecimento em questão.
                    * **NÃO gere "situacaoAprendizagem".** Pela MSEP, uma situação de aprendizagem agrupa várias
                      capacidades e corresponde a um bloco de aproximadamente 60 horas, e não a um único
                      conhecimento. Esse campo é preenchido posteriormente, por bloco de 60 horas.
                
                5.  **PARA A CHAVE "recursos" (Formatação Específica):**
                    * **FORMATAÇÃO OBRIGATÓRIA:** Formate o resultado como uma ÚNICA string de texto onde CADA recurso individual está em uma NOVA LINHA e TERMINA com um PONTO E VÍRGULA (;).
                    * **EXEMPLO DE FORMATAÇÃO CORRETA:** "Data show;\\nQuadro;\\nPincel;\\nComputadores;"
                    * NÃO adicione marcadores (como '*') ou numeração. Apenas o recurso seguido de ponto e vírgula e uma quebra de linha.
                    
                6.  **CÁLCULOS:**
                    * Estime uma "cargaHoraria" numérica lógica.
                    * Deixe as chaves "inicio" e "fim" como strings vazias.
            `;

    const elaboratorResult = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [elaboratorPrompt, filePart],
      config: generationConfig
    });
    const topicDetailJson = JSON.parse(elaboratorResult.text);

    // Adiciona o resultado da análise ao JSON
    topicDetailJson.saep = saepMatrixString;

    // Dados estruturados usados pelas páginas de Ficha de Observação e de
    // Situação de Aprendizagem. Mantemos "oque" intacto para a planilha.
    topicDetailJson.conhecimento = title;
    if (!Array.isArray(topicDetailJson.capacidades)) {
      const { capacidades } = separarCapacidadesEConhecimento(topicDetailJson.oque || '');
      topicDetailJson.capacidades = capacidades;
    }

    // Normaliza os instrumentos para permitir filtrar os blocos que pedem ficha
    topicDetailJson.instrumentosNormalizados = normalizarInstrumentos(
      topicDetailJson.instrumentos
    );

    conteudoDetalhado.push(topicDetailJson);
  }

  console.log('Elaboração de todos os tópicos concluída.');
  sendUpdate('Elaboração de todos os tópicos concluída');

  // =========================================================================
  //          ETAPA 2.3: GERADOR INTELIGENTE DE AVALIAÇÃO FINAL
  // =========================================================================
  if (conteudoDetalhado.length > 0) {
    sendUpdate('ETAPA 2.3: A gerar uma avaliação final contextualizada');
    console.log('--- ETAPA 2.3: Gerando avaliação final contextualizada... ---');

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

    const assessmentResult = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [finalAssessmentPrompt, filePart],
      config: generationConfig
    });
    const assessmentJson = JSON.parse(assessmentResult.text);

    // Substituição dos valores do último tópico pelos valores gerados
    ultimoTopico.instrumentos = assessmentJson.instrumentos || 'Prova Prática';
    ultimoTopico.como = assessmentJson.como || 'Atividade avaliativa final.';
    ultimoTopico.criterios =
      assessmentJson.criterios || 'O aluno demonstrou as competências da UC.';

    console.log(`Avaliação final definida como: "${ultimoTopico.instrumentos}".`);
    sendUpdate(`Avaliação final definida como: "${ultimoTopico.instrumentos}"`);
  }

  // =========================================================================
  //                     LÓGICA DE DATAS CENÁRIOS A e B
  // =========================================================================
  const cargaDiaria = parseInt(shift, 10);

  const parsedHolidays = (holidays || '')
    .split(',')
    .map((h) => h.trim())
    .filter((h) => h)
    .map(
      (h) =>
        new Date(h.split('/').reverse().join('-') + 'T00:00:00').getTime()
    );

  const vacationStartDate = vacationStart
    ? new Date(vacationStart + 'T00:00:00')
    : null;
  const vacationEndDate = vacationEnd
    ? new Date(vacationEnd + 'T00:00:00')
    : null;

  const isExceptionDay = (date) => {
    const dateTimestamp = date.getTime();
    if (parsedHolidays.includes(dateTimestamp)) return true;
    if (
      vacationStartDate &&
      vacationEndDate &&
      date >= vacationStartDate &&
      date <= vacationEndDate
    ) {
      return true;
    }
    return false;
  };

  let validClassDays = [];

  //  GERAÇÃO DA LISTA DE DIAS VÁLIDOS
  if (classDates && classDates.trim() !== '') {
    // Datas Específicas
    console.log('MODO: Datas Específicas.');
    validClassDays = classDates
      .split(', ')
      .map(
        (d) =>
          new Date(d.split('/').reverse().join('-') + 'T00:00:00')
      )
      .filter((date) => !isExceptionDay(date))
      .sort((a, b) => a - b);
  } else {
    // Recorrente
    console.log('MODO: Recorrente (Dias da Semana).');

    const totalAulasNecessarias = Math.ceil(
      parseInt(totalHours, 10) / cargaDiaria
    );
    const selectedWeekdays = (
      Array.isArray(weekdays) ? weekdays : weekdays ? [weekdays] : []
    ).map(Number);
    let currentDate = new Date(startDate + 'T00:00:00');

    while (validClassDays.length < totalAulasNecessarias) {
      const dayOfWeek = currentDate.getDay();

      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        if (
          (selectedWeekdays.length > 0 &&
            selectedWeekdays.includes(dayOfWeek)) ||
          selectedWeekdays.length === 0
        ) {
          if (!isExceptionDay(currentDate)) {
            validClassDays.push(new Date(currentDate));
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);

      // Proteção contra loops infinitos
      if (
        currentDate.getFullYear() >
        new Date(startDate).getFullYear() + 3
      ) {
        break;
      }
    }
  }

  if (validClassDays.length === 0) {
    throw new Error('Nenhuma data de aula válida foi encontrada.');
  }

  console.log(`DIAS VÁLIDOS ENCONTRADOS: ${validClassDays.length}`);

  // DISTRIBUIÇÃO INTELIGENTE
  const totalAulasDisponiveis = validClassDays.length;
  const totalTopicos = conteudoDetalhado.length;
  let planoFinal = [];

  if (totalAulasDisponiveis >= totalTopicos) {
    // --- CENÁRIO A: EXPANSÃO. Quando há mais dias que tópicos ---
    console.log('Cenário A: Expansão');

    const estimativaAulas = conteudoDetalhado.map(() => 1);
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
    console.log('Cenário B: Compactação');

    // Inicializa os slots dos dias
    planoFinal = validClassDays.map(() => ({
      oque: [],
      como: [],
      recursos: [],
      instrumentos: [],
      criterios: [],
      onde: [],
      capacidades: [],
      conhecimentos: [],
      saep: '',
      cargaHoraria: cargaDiaria.toString(),
    }));

    // Distribui os tópicos nos slots disponíveis
    conteudoDetalhado.forEach((item, index) => {
      const dayIndex = Math.floor(
        (index * totalAulasDisponiveis) / totalTopicos
      );
      const safeDayIndex = Math.min(dayIndex, totalAulasDisponiveis - 1);

      const diaAlvo = planoFinal[safeDayIndex];

      if (item.oque) diaAlvo.oque.push(item.oque);
      if (item.como) diaAlvo.como.push(item.como);
      if (item.recursos) diaAlvo.recursos.push(item.recursos);
      if (item.onde) diaAlvo.onde.push(item.onde);

      // Evita duplicatas em instrumentos
      if (
        item.instrumentos &&
        !diaAlvo.instrumentos.includes(item.instrumentos)
      ) {
        diaAlvo.instrumentos.push(item.instrumentos);
      }

      if (item.criterios) diaAlvo.criterios.push(item.criterios);

      // Preserva os dados estruturados usados pelas fichas e situações
      (item.capacidades || []).forEach((c) => {
        if (!diaAlvo.capacidades.includes(c)) diaAlvo.capacidades.push(c);
      });
      if (item.conhecimento) diaAlvo.conhecimentos.push(item.conhecimento);

      if (!diaAlvo.saep) diaAlvo.saep = item.saep;
    });

    // Converte os arrays de volta para strings formatadas
    planoFinal = planoFinal.map((dia) => {
      const instrumentos = dia.instrumentos.join(' / ');
      return {
        oque: dia.oque.join('\n\n---\n\n'),
        como: dia.como.join('\n\n'),
        recursos: dia.recursos.join('\n'),
        instrumentos,
        instrumentosNormalizados: normalizarInstrumentos(instrumentos),
        criterios: dia.criterios.join('\n'),
        // Junta os locais removendo duplicatas (ex: Lab Info / Sala Aula)
        onde: [...new Set(dia.onde)].join(' / '),
        capacidades: dia.capacidades,
        conhecimento: dia.conhecimentos.join('; '),
        saep: dia.saep,
        cargaHoraria: dia.cargaHoraria,
      };
    });
  }

  // Substitui o array original pelo processado
  conteudoDetalhado.length = 0;
  planoFinal.forEach((item) => conteudoDetalhado.push(item));

  const dataFimCalculada =
    validClassDays[validClassDays.length - 1].toLocaleDateString('pt-BR');
  sendUpdate('Cronograma distribuído com sucesso');

  // --- ETAPA 3: ENVIAR PARA A PLANILHA ---
  const payloadParaAppsScript = {
    nomeCurso: courseName,
    nomeUC: ucName,
    instrutor: instructorName,
    codigoTurma: classCode,
    modalidade: modality,
    unidadeEscolar: unidadeEscolar || 'Palmas - Centro de Educação e Tecnologia - CETEC',
    dataInicioCurso: new Date(startDate + 'T00:00:00').toLocaleDateString(
      'pt-BR'
    ),
    dataFimCurso: dataFimCalculada,
    cargaHorariaTotal: totalHours,
    conteudoDetalhado: conteudoDetalhado,
    imageUrl: LOGOTIPO_URL,
    diasDeAulaValidos: validClassDays.map((date) =>
      date.toLocaleDateString('pt-BR')
    ),
    shift: shift,
  };

  sendUpdate('ETAPA 3: A comunicar com o Google e a criar a sua planilha');
  const appsScriptResponse = await axios.post(
    APPS_SCRIPT_URL,
    payloadParaAppsScript
  );

  // ---------------------------------------------------------------------
  // Plano em formato estruturado, devolvido ao navegador para ser guardado
  // em sessionStorage e reutilizado pelas páginas de Ficha de Observação e
  // de Situação de Aprendizagem. Nada é persistido no servidor.
  // ---------------------------------------------------------------------
  const plano = montarPlanoEstruturado({
    payload: payloadParaAppsScript,
    conteudoDetalhado,
    diasDeAula: payloadParaAppsScript.diasDeAulaValidos,
  });

  return {
    ...appsScriptResponse.data,
    plano,
  };
}

/**
 * Converte o conteúdo enviado ao Apps Script na mesma estrutura devolvida pelo
 * planParser, de forma que as páginas seguintes funcionem indistintamente com
 * um plano recém-gerado ou com um plano importado de uma planilha.
 *
 * O agrupamento em páginas reproduz o limite de 60 horas por aba aplicado pelo
 * Apps Script, fazendo cada página corresponder a uma situação de aprendizagem.
 *
 * @param {{ payload: object, conteudoDetalhado: object[], diasDeAula: string[] }} params
 * @returns {object} Plano estruturado.
 */
function montarPlanoEstruturado({ payload, conteudoDetalhado, diasDeAula }) {
  const LIMITE_HORAS_POR_PAGINA = 60;

  const blocos = [];
  const paginas = [];

  let paginaIndex = 1;
  let horasNaPagina = 0;
  let diaIndex = 0;
  let paginaAtual = { nome: `Plano (Parte ${paginaIndex})`, horas: 0, blocosIds: [] };
  paginas.push(paginaAtual);

  conteudoDetalhado.forEach((item, index) => {
    const horasArray = String(item.cargaHoraria || '')
      .split(',')
      .map((h) => parseInt(h.trim(), 10) || 0)
      .filter((h) => h > 0);

    const instrumentos =
      item.instrumentosNormalizados || normalizarInstrumentos(item.instrumentos);

    const bloco = {
      id: `bloco-${index + 1}`,
      pagina: paginaAtual.nome,
      oque: item.oque || '',
      capacidades: item.capacidades || [],
      conhecimento: item.conhecimento || '',
      saep: item.saep || '',
      como: item.como || '',
      onde: item.onde || '',
      recursos: item.recursos || '',
      criterios: item.criterios || '',
      instrumentosTexto: item.instrumentos || '',
      instrumentos,
      usaFichaObservacao: usaFichaDeObservacao(instrumentos),
      situacaoAprendizagem: '',
      cargaHoraria: 0,
      aulas: [],
    };

    // Um bloco pode atravessar a quebra de página. Nesse caso o Apps Script
    // reescreve o conhecimento na aba seguinte, logo o bloco pertence a todas
    // as páginas que as suas aulas tocam — e, portanto, às situações de
    // aprendizagem correspondentes.
    const paginasTocadas = [];

    horasArray.forEach((horasDoDia) => {
      if (diaIndex >= diasDeAula.length) return;

      // Reproduz a quebra de página do Apps Script
      if (horasNaPagina > 0 && horasNaPagina + horasDoDia > LIMITE_HORAS_POR_PAGINA) {
        paginaIndex += 1;
        horasNaPagina = 0;
        paginaAtual = { nome: `Plano (Parte ${paginaIndex})`, horas: 0, blocosIds: [] };
        paginas.push(paginaAtual);
      }

      if (paginasTocadas.indexOf(paginaAtual) === -1) {
        paginasTocadas.push(paginaAtual);
        if (paginasTocadas.length === 1) bloco.pagina = paginaAtual.nome;
      }

      bloco.cargaHoraria += horasDoDia;
      bloco.aulas.push({ horas: horasDoDia, data: diasDeAula[diaIndex] });
      horasNaPagina += horasDoDia;
      // A carga horária da página conta as aulas efetivamente nela realizadas
      paginaAtual.horas += horasDoDia;
      diaIndex += 1;
    });

    if (bloco.aulas.length > 0) {
      paginasTocadas.forEach((pagina) => {
        if (!pagina.blocosIds.includes(bloco.id)) pagina.blocosIds.push(bloco.id);
      });
      blocos.push(bloco);
    }
  });

  return {
    origem: 'plano-gerado',
    importadoEm: new Date().toISOString(),
    identificacao: {
      unidadeEscolar: payload.unidadeEscolar,
      curso: payload.nomeCurso,
      codigoTurma: payload.codigoTurma,
      unidadeCurricular: payload.nomeUC,
      periodo: `${payload.dataInicioCurso} - ${payload.dataFimCurso}`,
      dataInicio: payload.dataInicioCurso,
      dataFim: payload.dataFimCurso,
      modalidade: payload.modalidade,
      cargaHorariaTotal: payload.cargaHorariaTotal,
      instrutor: payload.instrutor,
    },
    paginas: paginas.filter((p) => p.blocosIds.length > 0),
    blocos,
  };
}

module.exports = {
  gerarPlano,
};

