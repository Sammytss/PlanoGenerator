const { generationConfig } = require('../config/ai');
const { gerarJson } = require('./aiRunner');

// ---------------------------------------------------------------------------
// Elaboração de Situações de Aprendizagem segundo a MSEP 2019 (§3.2.1.4)
// ---------------------------------------------------------------------------
// "As situações de aprendizagem compõem um conjunto de ações que, planejadas
// pedagogicamente, favorecem aprendizagens significativas, por meio da
// utilização de estratégias de aprendizagem desafiadoras e de diferentes
// estratégias de ensino." (MSEP, p.113)
//
// A elaboração segue a Etapa 2 da MSEP (p.137-143):
//   a) Seleção de capacidades e seus respectivos conhecimentos
//   b) Escolha da estratégia de aprendizagem desafiadora
//   c) Descrição: contextualização, desafio e resultados esperados
//   d) Definição das estratégias de ensino
//   e) Definição de recursos didáticos e ambientes pedagógicos
//   f) Proposição de critérios de avaliação
//   g) Seleção e elaboração de instrumentos de avaliação
//   h) Detalhamento em planos de aula
// ---------------------------------------------------------------------------

// Config com folga: uma SA reúne muitas capacidades e conhecimentos. O
// thinkingBudget vem de generationConfig e é deliberadamente baixo — ver a nota
// em config/ai.js sobre os tokens de raciocínio consumirem o orçamento de saída.
const configSituacao = { ...generationConfig, maxOutputTokens: 40960, temperature: 0.5 };

/**
 * Estratégias de aprendizagem desafiadoras definidas pela MSEP (p.114).
 * Não existem outras: a escolha do docente deve recair sobre uma destas.
 */
const ESTRATEGIAS_DESAFIADORAS = [
  {
    id: 'situacao-problema',
    nome: 'Situação-Problema',
    descricao: 'Apresenta um problema concreto do contexto profissional para o qual o Aluno deve construir uma solução viável.',
  },
  {
    id: 'estudo-de-caso',
    nome: 'Estudo de Caso',
    descricao: 'Analisa um caso real ou verossímil da ocupação, exigindo diagnóstico, análise crítica e recomendações fundamentadas.',
  },
  {
    id: 'projeto',
    nome: 'Projeto',
    descricao: 'Conduz o Aluno da concepção à entrega de um produto, bem ou serviço, com planejamento, execução e validação.',
  },
  {
    id: 'pesquisa-aplicada',
    nome: 'Pesquisa Aplicada',
    descricao: 'Gera conhecimentos para aplicações práticas voltadas à solução de problemas específicos do campo de atuação profissional.',
  },
];

/**
 * Carga horária de referência para uma situação de aprendizagem.
 * Alinhada ao limite de 60 horas por aba usado pelo Apps Script, o que faz cada
 * situação corresponder a exatamente uma página da planilha.
 */
const HORAS_POR_SITUACAO = 60;

/**
 * Agrupa os blocos do plano em conjuntos de até 60 horas.
 *
 * Quando o plano foi importado de uma planilha, as páginas já representam esse
 * agrupamento e são respeitadas. Caso contrário, os blocos são acumulados por
 * carga horária.
 *
 * @param {object} plano Plano gerado ou importado.
 * @param {number} [horasPorSituacao] Carga horária alvo de cada situação.
 * @returns {Array<{ numero: number, titulo: string, horas: number, blocos: object[] }>}
 */
function agruparBlocosPorCargaHoraria(plano, horasPorSituacao = HORAS_POR_SITUACAO) {
  const blocos = (plano && plano.blocos) || [];
  if (blocos.length === 0) return [];

  // Caminho preferencial: o plano já traz páginas de 60h definidas
  if (Array.isArray(plano.paginas) && plano.paginas.length > 0) {
    const grupos = plano.paginas
      .map((pagina, indice) => {
        const blocosDaPagina = blocos.filter((b) =>
          (pagina.blocosIds || []).includes(b.id)
        );
        return {
          numero: indice + 1,
          titulo: pagina.nome,
          // Prefere a carga horária real da página (as aulas nela realizadas).
          // Um bloco pode atravessar a quebra de página, por isso somar a carga
          // dos blocos daria um total diferente do que consta na planilha.
          horas:
            pagina.horas ||
            blocosDaPagina.reduce((s, b) => s + (b.cargaHoraria || 0), 0),
          blocos: blocosDaPagina,
        };
      })
      .filter((g) => g.blocos.length > 0);

    if (grupos.length > 0) return grupos;
  }

  // Alternativa: acumula os blocos até atingir a carga horária alvo
  const grupos = [];
  let atual = null;

  blocos.forEach((bloco) => {
    const horasDoBloco = bloco.cargaHoraria || 0;

    if (!atual || (atual.horas > 0 && atual.horas + horasDoBloco > horasPorSituacao)) {
      atual = { numero: grupos.length + 1, titulo: '', horas: 0, blocos: [] };
      grupos.push(atual);
    }

    atual.horas += horasDoBloco;
    atual.blocos.push(bloco);
  });

  return grupos;
}

/**
 * Reúne, sem duplicados, os valores de um campo em todos os blocos do grupo.
 * @param {object[]} blocos
 * @param {string} campo
 * @returns {string[]}
 */
function reunirCampo(blocos, campo) {
  const conjunto = [];
  blocos.forEach((bloco) => {
    const valor = bloco[campo];
    const lista = Array.isArray(valor)
      ? valor
      : String(valor || '')
          .split(/\s*[;\n]+\s*/)
          .map((v) => v.trim());

    lista.filter(Boolean).forEach((item) => {
      if (!conjunto.includes(item)) conjunto.push(item);
    });
  });
  return conjunto;
}

/**
 * Elabora o conteúdo pedagógico de uma situação de aprendizagem.
 *
 * @param {object} params
 * @param {object} params.grupo Grupo de blocos (saída de agruparBlocosPorCargaHoraria).
 * @param {object} params.identificacao Dados do curso/UC/instrutor.
 * @param {string} params.estrategiaId Estratégia desafiadora escolhida pelo docente.
 * @param {number} params.numero Número sequencial da situação na UC.
 * @param {number} params.totalSituacoes Total de situações previstas na UC.
 * @param {string} [params.instrucoes] Instruções livres do docente.
 * @returns {Promise<object>} Situação de aprendizagem pronta.
 */
async function gerarSituacao({
  grupo,
  identificacao,
  estrategiaId,
  numero,
  totalSituacoes,
  instrucoes,
}) {
  if (!grupo || !grupo.blocos || grupo.blocos.length === 0) {
    throw new Error('GRUPO_SEM_BLOCOS');
  }

  const estrategia =
    ESTRATEGIAS_DESAFIADORAS.find((e) => e.id === estrategiaId) ||
    ESTRATEGIAS_DESAFIADORAS[0];

  const capacidades = reunirCampo(grupo.blocos, 'capacidades');
  const conhecimentos = grupo.blocos.map((b) => b.conhecimento || b.oque || '').filter(Boolean);
  const estrategiasEnsino = reunirCampo(grupo.blocos, 'como');
  const ambientes = reunirCampo(grupo.blocos, 'onde');
  const recursos = reunirCampo(grupo.blocos, 'recursos');
  const instrumentos = reunirCampo(grupo.blocos, 'instrumentos');

  const aulas = grupo.blocos.reduce((s, b) => s + ((b.aulas && b.aulas.length) || 0), 0);
  const primeiraAula = grupo.blocos[0] && grupo.blocos[0].aulas && grupo.blocos[0].aulas[0];
  const ultimoBloco = grupo.blocos[grupo.blocos.length - 1];
  const ultimaAula =
    ultimoBloco && ultimoBloco.aulas && ultimoBloco.aulas[ultimoBloco.aulas.length - 1];

  const prompt = `
Você é um especialista em Prática Pedagógica do SENAI, responsável por elaborar uma
SITUAÇÃO DE APRENDIZAGEM conforme a Metodologia SENAI de Educação Profissional (MSEP 2019).

DADOS DA UNIDADE CURRICULAR:
- Curso: ${identificacao.curso || 'não informado'}
- Unidade Curricular: ${identificacao.unidadeCurricular || 'não informada'}
- Modalidade: ${identificacao.modalidade || 'não informada'}
- Carga horária total da UC: ${identificacao.cargaHorariaTotal || 'não informada'} horas
- Unidade Escolar: ${identificacao.unidadeEscolar || 'não informada'}

ESTA É A SITUAÇÃO DE APRENDIZAGEM ${numero} DE ${totalSituacoes} DA UNIDADE CURRICULAR.
- Carga horária desta situação: ${grupo.horas} horas
- Número de aulas previstas: ${aulas || 'a definir'}

CAPACIDADES A SEREM DESENVOLVIDAS NESTA SITUAÇÃO:
${capacidades.map((c, i) => `${i + 1}. ${c}`).join('\n') || 'Não informadas'}

CONHECIMENTOS RELACIONADOS:
${conhecimentos.map((c, i) => `${i + 1}. ${c}`).join('\n') || 'Não informados'}

ESTRATÉGIAS DE ENSINO JÁ PREVISTAS NO PLANO:
${estrategiasEnsino.join('\n') || 'Não informadas'}

AMBIENTES PEDAGÓGICOS: ${ambientes.join('; ') || 'Não informados'}
RECURSOS DIDÁTICOS: ${recursos.join('; ') || 'Não informados'}
INSTRUMENTOS DE AVALIAÇÃO PREVISTOS: ${instrumentos.join('; ') || 'Não informados'}

ESTRATÉGIA DE APRENDIZAGEM DESAFIADORA ESCOLHIDA PELO DOCENTE: ${estrategia.nome}
(${estrategia.descricao})
${instrucoes ? `\nINSTRUÇÕES ADICIONAIS DO DOCENTE (prioridade alta):\n${instrucoes}\n` : ''}

REGRAS INFLEXÍVEIS (MSEP, p.138-142):

SOBRE A CONTEXTUALIZAÇÃO:
- Deve permitir ao Aluno "visualizar-se em uma situação real de trabalho".
- Crie um cenário profissional verossímil, com empresa, setor e demanda concretos,
  ligado ao contexto de trabalho da ocupação do curso.
- Escreva de 2 a 4 parágrafos.

SOBRE O DESAFIO:
- Apresente o problema a ser solucionado e as atividades necessárias para resolvê-lo.
- O grau de complexidade deve ser adequado ao nível do curso e ao momento da formação:
  desafio insolúvel frustra, desafio trivial não desperta interesse.
- Dirija-se ao Aluno na segunda pessoa ("Você foi contratado como...", "Você deverá...").

SOBRE OS RESULTADOS ESPERADOS:
- Informe CLARAMENTE o produto final: relatório, protótipo, projeto, software, maquete,
  parecer, leiaute, vídeo, manual etc.
- Liste de 3 a 6 entregas concretas e verificáveis.

SOBRE OS CRITÉRIOS DE AVALIAÇÃO:
- Redija de 4 a 8 critérios observáveis, com mensuração, objetividade, granularidade e
  transparência, cobrindo tanto o PROCESSO DE EXECUÇÃO quanto o PRODUTO final.
- Comece cada critério por "O aluno" seguido do verbo NO PRETÉRITO PERFEITO
  (ex.: "O aluno instalou e configurou a IDE..."), nunca no presente.
- Nunca proponha critério mais complexo do que a capacidade a que se refere.

SOBRE O DETALHAMENTO EM PLANOS DE AULA:
- "Dificilmente uma situação de aprendizagem será executada em uma única aula."
- Divida a situação em 3 a 6 etapas sequenciais, cada uma com a sua carga horária,
  somando exatamente ${grupo.horas} horas.

Responda EXCLUSIVAMENTE com um objeto JSON neste formato:
{
  "titulo": "Título profissional e atrativo da situação de aprendizagem",
  "contextualizacao": "Texto corrido em parágrafos separados por \\n\\n",
  "desafio": "Texto corrido dirigido ao Aluno",
  "resultadosEsperados": ["entrega 1", "entrega 2"],
  "estrategiasEnsino": ["Exposição dialogada: ...", "Atividade prática: ..."],
  "recursosDidaticos": ["recurso 1", "recurso 2"],
  "ambientesPedagogicos": ["ambiente 1"],
  "criteriosAvaliacao": ["O aluno ...", "O aluno ..."],
  "instrumentosAvaliacao": ["instrumento 1"],
  "etapas": [
    { "etapa": "Nome da etapa", "cargaHoraria": 12, "descricao": "O que acontece nesta etapa" }
  ]
}
`;

  const bruto = await gerarJson({
    model: 'gemini-2.5-flash',
    contents: [prompt],
    config: configSituacao,
    etapa: `Situação de aprendizagem ${numero}`,
  });
  const lista = (valor) => (Array.isArray(valor) ? valor.map(String).filter(Boolean) : []);

  return {
    numero,
    totalSituacoes,
    identificacao,
    estrategiaDesafiadora: { id: estrategia.id, nome: estrategia.nome },
    cargaHoraria: grupo.horas,
    numeroAulas: aulas,
    periodo:
      primeiraAula && ultimaAula ? `${primeiraAula.data} a ${ultimaAula.data}` : '',
    capacidades,
    conhecimentos,
    titulo: String(bruto.titulo || `Situação de Aprendizagem ${numero}`).trim(),
    contextualizacao: String(bruto.contextualizacao || '').trim(),
    desafio: String(bruto.desafio || '').trim(),
    resultadosEsperados: lista(bruto.resultadosEsperados),
    estrategiasEnsino: lista(bruto.estrategiasEnsino).length
      ? lista(bruto.estrategiasEnsino)
      : estrategiasEnsino,
    recursosDidaticos: lista(bruto.recursosDidaticos).length
      ? lista(bruto.recursosDidaticos)
      : recursos,
    ambientesPedagogicos: lista(bruto.ambientesPedagogicos).length
      ? lista(bruto.ambientesPedagogicos)
      : ambientes,
    criteriosAvaliacao: lista(bruto.criteriosAvaliacao),
    instrumentosAvaliacao: lista(bruto.instrumentosAvaliacao).length
      ? lista(bruto.instrumentosAvaliacao)
      : instrumentos,
    etapas: Array.isArray(bruto.etapas)
      ? bruto.etapas.map((e) => ({
          etapa: String(e.etapa || '').trim(),
          cargaHoraria: Number(e.cargaHoraria) || 0,
          descricao: String(e.descricao || '').trim(),
        }))
      : [],
    blocosIds: grupo.blocos.map((b) => b.id),
    geradoEm: new Date().toISOString(),
  };
}

module.exports = {
  gerarSituacao,
  agruparBlocosPorCargaHoraria,
  ESTRATEGIAS_DESAFIADORAS,
  HORAS_POR_SITUACAO,
};
