const { generationConfig } = require('../config/ai');
const { gerarJson } = require('./aiRunner');

// ---------------------------------------------------------------------------
// Geração de Fichas de Observação segundo a MSEP 2019
// ---------------------------------------------------------------------------
// A ficha de observação "permite um olhar dirigido sobre o desempenho do Aluno
// em tarefas individuais ou em grupos" e "requer a construção prévia de um
// roteiro ou uma lista de questionamentos que se deseja observar" (MSEP, p.127).
//
// A MSEP admite dois métodos de descrição dos critérios (p.131-133):
//   - DICOTÓMICO: arguições respondidas com Sim/Não (Escalas de Cotejo).
//   - GRADUAL: rubricas cumulativas, recomendadas para capacidades
//     socioemocionais por serem "mais intangíveis para serem dicotomizadas".
//
// Todo critério deve respeitar quatro características: mensuração,
// objetividade, granularidade e transparência.
// ---------------------------------------------------------------------------

// Config com folga de tokens: uma ficha gradual tem 4 rubricas por critério e
// pode chegar facilmente às dezenas de milhares de caracteres. O thinkingBudget
// vem de generationConfig e é deliberadamente baixo — ver a nota em config/ai.js
// sobre os tokens de raciocínio consumirem o orçamento de saída.
const configFicha = { ...generationConfig, maxOutputTokens: 40960, temperature: 0.3 };

/** Escala de conceitos da MSEP (p.155). */
const ESCALA_CONCEITOS = [
  { conceito: 'A', minimo: 90, descricao: 'Desenvolveu as situações de aprendizagem propostas, alcançando mais de 90% dos seus critérios de avaliação, obtendo o resultado esperado.' },
  { conceito: 'B', minimo: 70, descricao: 'Desenvolveu as situações de aprendizagem propostas, alcançando entre 70% e 89% dos seus critérios de avaliação, sem comprometer o resultado esperado.' },
  { conceito: 'C', minimo: 51, descricao: 'Desenvolveu as situações de aprendizagem propostas, alcançando entre 51% e 69% dos seus critérios de avaliação, comprometendo parcialmente o resultado esperado.' },
  { conceito: 'D', minimo: 0, descricao: 'Não conseguiu desenvolver as situações de aprendizagem propostas, alcançando menos de 50% dos seus critérios de avaliação, comprometendo significativamente o resultado esperado.' },
];

/** Trecho de prompt partilhado pelos dois métodos. */
const REGRAS_MSEP = `
REGRAS INFLEXÍVEIS DA METODOLOGIA SENAI DE EDUCAÇÃO PROFISSIONAL (MSEP 2019):

1. Cada critério deve possuir as QUATRO características fundamentais:
   - MENSURAÇÃO: é possível verificar objetivamente se foi atingido.
   - OBJETIVIDADE: redação inequívoca, sem espaço para interpretações divergentes.
   - GRANULARIDADE: descreve uma microetapa específica do percurso da capacidade.
   - TRANSPARÊNCIA: o Aluno entende exatamente o que será verificado.
2. O nível de complexidade do critério NUNCA pode ser maior que o da capacidade a que se refere.
3. Os critérios devem indicar desempenhos profissionais OBSERVÁVEIS durante a atividade.
4. Quando houver vários critérios para a mesma capacidade, organize-os do mais simples ao mais complexo.
5. Os critérios devem cobrir as duas vertentes previstas na MSEP:
   - PROCESSO DE EXECUÇÃO: procedimentos e comportamentos durante a atividade.
   - PRODUTO: o resultado final entregue pelo Aluno.
6. NÃO use linguagem vaga ("adequadamente", "corretamente" sozinhos, "de forma satisfatória").
   Descreva o que exatamente caracteriza o desempenho esperado.
`;

/**
 * Monta o contexto textual do bloco do plano que será avaliado.
 * @param {object} bloco Bloco do plano (conhecimento, capacidades, estratégia...).
 * @param {object} identificacao Dados do curso.
 * @returns {string}
 */
function montarContexto(bloco, identificacao) {
  return `
CONTEXTO DO PLANEJAMENTO DOCENTE:
- Curso: ${identificacao.curso || 'não informado'}
- Unidade Curricular: ${identificacao.unidadeCurricular || 'não informada'}
- Modalidade: ${identificacao.modalidade || 'não informada'}
- Carga horária do bloco a ser avaliado: ${bloco.cargaHoraria || 'não informada'} horas

CAPACIDADES A SEREM AVALIADAS (uma entrada de ficha para cada uma):
${(bloco.capacidades || []).map((c, i) => `${i + 1}. ${c}`).join('\n') || 'Não informadas'}

CONHECIMENTO TRABALHADO:
${bloco.conhecimento || bloco.oque || 'Não informado'}

ESTRATÉGIA DE ENSINO E DESCRIÇÃO DA ATIVIDADE:
${bloco.como || 'Não informada'}

AMBIENTE PEDAGÓGICO: ${bloco.onde || 'Não informado'}
RECURSOS DIDÁTICOS: ${bloco.recursos || 'Não informados'}
INSTRUMENTO DE AVALIAÇÃO PREVISTO: ${(bloco.instrumentos || []).join(', ') || 'Ficha de Observação'}
CRITÉRIO GERAL JÁ PREVISTO NO PLANO: ${bloco.criterios || 'Não informado'}
${bloco.situacaoAprendizagem ? `SITUAÇÃO DE APRENDIZAGEM RELACIONADA: ${bloco.situacaoAprendizagem}` : ''}
`;
}

/**
 * Gera os critérios de uma ficha de observação pelo método DICOTÓMICO.
 * @param {string} contexto
 * @param {string} instrucoes Instruções livres do professor.
 * @returns {Promise<object>}
 */
async function gerarDicotomico(contexto, instrucoes) {
  const prompt = `
Você é um especialista em avaliação da aprendizagem do SENAI, responsável por elaborar
uma FICHA DE OBSERVAÇÃO pelo MÉTODO DICOTÓMICO (Escala de Cotejo).

${contexto}
${instrucoes ? `\nINSTRUÇÕES ADICIONAIS DO DOCENTE (prioridade alta):\n${instrucoes}\n` : ''}
${REGRAS_MSEP}

REGRAS ESPECÍFICAS DO MÉTODO DICOTÓMICO:
- Cada critério deve ser redigido como uma ARGUIÇÃO, ou seja, uma PERGUNTA terminada em "?".
- A pergunta deve começar por "O aluno" seguido do verbo NO PRETÉRITO PERFEITO, tal como nos
  exemplos da MSEP: "O aluno identificou a fonte geradora dos riscos...?",
  "O aluno indicou, pelo menos, três medidas de controle...?".
  NUNCA use o presente ("O aluno identifica") — a observação é registada após o desempenho.
- A pergunta deve admitir apenas duas respostas: Sim ou Não.
- Gere de 2 a 3 critérios para CADA capacidade listada.
- Varie a natureza dos critérios: alguns qualitativos e pelo menos um quantitativo
  (que exija contagem, quantidade mínima ou medida verificável).

Responda EXCLUSIVAMENTE com um objeto JSON neste formato:
{
  "titulo": "Título curto da atividade observada",
  "descricaoAtividade": "2 a 3 frases descrevendo a atividade prática que o docente irá observar.",
  "itens": [
    {
      "capacidade": "Texto integral da capacidade, copiado da lista acima",
      "criterios": [
        { "texto": "O aluno ...?" }
      ]
    }
  ]
}
`;

  return gerarJson({
    model: 'gemini-2.5-flash',
    contents: [prompt],
    config: configFicha,
    etapa: 'Ficha de observação (dicotómico)',
  });
}

/**
 * Gera os critérios de uma ficha de observação pelo método GRADUAL (rubricas).
 * @param {string} contexto
 * @param {string} instrucoes
 * @returns {Promise<object>}
 */
async function gerarGradual(contexto, instrucoes) {
  const prompt = `
Você é um especialista em avaliação da aprendizagem do SENAI, responsável por elaborar
uma FICHA DE OBSERVAÇÃO pelo MÉTODO GRADUAL (matriz de rubricas).

${contexto}
${instrucoes ? `\nINSTRUÇÕES ADICIONAIS DO DOCENTE (prioridade alta):\n${instrucoes}\n` : ''}
${REGRAS_MSEP}

REGRAS ESPECÍFICAS DO MÉTODO GRADUAL:
- Cada critério é uma PERGUNTA abrangente terminada em "?", redigida de modo a admitir
  respostas graduais, começando por "O aluno" seguido do verbo NO PRETÉRITO PERFEITO
  (ex.: "O aluno realizou a análise do risco físico presente no ambiente avaliado?").
  NUNCA use o presente ("O aluno realiza").
- As rubricas descrevem o desempenho também no pretérito ("O aluno não conseguiu identificar...",
  "O aluno identificou o risco físico, sua fonte geradora e trajetória.").
- Cada critério possui EXATAMENTE 4 rubricas, numeradas de 1 a 4, CUMULATIVAS e CRESCENTES:
  - Nível 1: o Aluno não conseguiu realizar o que era esperado.
  - Nível 2: realizou parcialmente, com lacunas relevantes.
  - Nível 3: realizou o desempenho esperado por completo.
  - Nível 4: superou o esperado, acrescentando elemento além do desempenho padrão.
- Cada rubrica descreve o desempenho de forma concreta e observável; NUNCA use apenas
  "insuficiente", "regular", "bom", "ótimo".
- Gere de 1 a 2 critérios para CADA capacidade listada.

Responda EXCLUSIVAMENTE com um objeto JSON neste formato:
{
  "titulo": "Título curto da atividade observada",
  "descricaoAtividade": "2 a 3 frases descrevendo a atividade prática que o docente irá observar.",
  "itens": [
    {
      "capacidade": "Texto integral da capacidade, copiado da lista acima",
      "criterios": [
        {
          "texto": "O aluno ...?",
          "rubricas": [
            { "nivel": 1, "descricao": "..." },
            { "nivel": 2, "descricao": "..." },
            { "nivel": 3, "descricao": "..." },
            { "nivel": 4, "descricao": "..." }
          ]
        }
      ]
    }
  ]
}
`;

  return gerarJson({
    model: 'gemini-2.5-flash',
    contents: [prompt],
    config: configFicha,
    etapa: 'Ficha de observação (gradual)',
  });
}

/**
 * Garante a consistência estrutural da resposta da IA, evitando que a página
 * quebre por causa de um campo em falta.
 *
 * @param {object} bruto Resposta da IA.
 * @param {'dicotomico'|'gradual'} metodo
 * @returns {object[]} Itens normalizados.
 */
function sanearItens(bruto, metodo) {
  const itens = Array.isArray(bruto && bruto.itens) ? bruto.itens : [];

  return itens
    .map((item, indiceItem) => {
      const criterios = Array.isArray(item.criterios) ? item.criterios : [];

      return {
        capacidade: String(item.capacidade || `Capacidade ${indiceItem + 1}`).trim(),
        criterios: criterios
          .map((criterio, indiceCriterio) => {
            const texto = String(criterio.texto || '').trim();
            if (!texto) return null;

            const base = {
              id: `c${indiceItem + 1}-${indiceCriterio + 1}`,
              texto,
            };

            if (metodo !== 'gradual') return base;

            const rubricas = Array.isArray(criterio.rubricas) ? criterio.rubricas : [];
            // Garante sempre 4 rubricas, preenchendo lacunas
            base.rubricas = [1, 2, 3, 4].map((nivel) => {
              const encontrada = rubricas.find((r) => Number(r.nivel) === nivel);
              return {
                nivel,
                descricao: String((encontrada && encontrada.descricao) || `Nível ${nivel}`).trim(),
              };
            });

            return base;
          })
          .filter(Boolean),
      };
    })
    .filter((item) => item.criterios.length > 0);
}

/**
 * Gera a ficha de observação completa para um bloco do plano.
 *
 * @param {object} params
 * @param {object} params.bloco Bloco do plano a ser avaliado.
 * @param {object} params.identificacao Dados do curso/UC/instrutor.
 * @param {'dicotomico'|'gradual'} params.metodo Método de descrição dos critérios.
 * @param {string} [params.instrucoes] Instruções livres do docente.
 * @returns {Promise<object>} Ficha pronta para ser renderizada e preenchida.
 */
async function gerarFicha({ bloco, identificacao, metodo, instrucoes }) {
  if (!bloco) throw new Error('BLOCO_NAO_INFORMADO');

  const metodoFinal = metodo === 'gradual' ? 'gradual' : 'dicotomico';
  const contexto = montarContexto(bloco, identificacao || {});

  const bruto =
    metodoFinal === 'gradual'
      ? await gerarGradual(contexto, instrucoes)
      : await gerarDicotomico(contexto, instrucoes);

  const itens = sanearItens(bruto, metodoFinal);

  if (itens.length === 0) {
    throw new Error('FICHA_SEM_CRITERIOS');
  }

  const totalCriterios = itens.reduce((soma, i) => soma + i.criterios.length, 0);

  return {
    metodo: metodoFinal,
    titulo: String((bruto && bruto.titulo) || bloco.conhecimento || 'Ficha de Observação').trim(),
    descricaoAtividade: String((bruto && bruto.descricaoAtividade) || '').trim(),
    identificacao: identificacao || {},
    bloco: {
      id: bloco.id,
      conhecimento: bloco.conhecimento || bloco.oque || '',
      cargaHoraria: bloco.cargaHoraria || 0,
      instrumentos: bloco.instrumentos || [],
      como: bloco.como || '',
      onde: bloco.onde || '',
      recursos: bloco.recursos || '',
      situacaoAprendizagem: bloco.situacaoAprendizagem || '',
      periodo:
        bloco.aulas && bloco.aulas.length
          ? `${bloco.aulas[0].data} a ${bloco.aulas[bloco.aulas.length - 1].data}`
          : '',
    },
    itens,
    totalCriterios,
    escalaConceitos: ESCALA_CONCEITOS,
    geradoEm: new Date().toISOString(),
  };
}

module.exports = {
  gerarFicha,
  ESCALA_CONCEITOS,
};
