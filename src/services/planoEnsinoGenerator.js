const { generationConfig } = require('../config/ai');
const { GEMINI_MODEL } = require('../config');
const { gerarJson } = require('./aiRunner');
const { agruparBlocosPorCargaHoraria } = require('./situacaoGenerator');

// ---------------------------------------------------------------------------
// Plano de Ensino no formulário FO-178 (revisão 05)
// ---------------------------------------------------------------------------
// O FO-178 pede tudo o que o planejamento já tem — capacidades, conhecimentos,
// estratégias de ensino, critérios, instrumentos e recursos — mais seis campos
// que não existem em lado nenhum do sistema nem nos planos de curso:
//
//   1. Função e Subfunção do perfil profissional
//   2. Objetivo Geral da Unidade Curricular
//   3. Classificação de cada capacidade em Básica, Técnica ou Socioemocional
//   4. Acessibilidade (a coluna do formulário junta-a a recursos e ambientes)
//   5. Avaliação (composição da média)
//   6. Referências bibliográficas
//
// Os três planos de curso analisados não trazem Função, Subfunção nem Objetivo
// Geral, pelo que estes campos são necessariamente elaborados pela IA a partir
// da CBO, do perfil profissional de conclusão e das capacidades da UC. São
// propostas para o docente rever, e a página de edição deixa isso explícito.
//
// A classificação das capacidades é feita numa única chamada, sobre o conjunto
// distinto de capacidades da UC, e devolvida como um mapa. Assim os blocos do
// plano não mudam de forma e as páginas de Ficha de Observação e de Situação de
// Aprendizagem continuam a funcionar sem alteração.
// ---------------------------------------------------------------------------

/** Tipos de capacidade previstos no formulário. */
const TIPOS_DE_CAPACIDADE = ['Básica', 'Técnica', 'Socioemocional'];

/**
 * Reúne as capacidades distintas de todos os blocos do plano, pela ordem em que
 * aparecem.
 * @param {object[]} blocos
 * @returns {string[]}
 */
function capacidadesDistintas(blocos) {
  const vistas = [];

  (blocos || []).forEach((bloco) => {
    (bloco.capacidades || []).forEach((capacidade) => {
      const texto = String(capacidade || '').trim();
      if (texto && !vistas.includes(texto)) vistas.push(texto);
    });
  });

  return vistas;
}

/**
 * Numera as aulas de cada bloco de forma acumulada ao longo da UC.
 *
 * O FO-178 tem uma coluna "Aula nº" e uma coluna "CH". Como cada linha do
 * documento corresponde a um conhecimento — e um conhecimento costuma ocupar
 * várias aulas —, a coluna traz o intervalo ("5 a 8") e a CH traz a soma.
 *
 * @param {object[]} blocos Blocos do plano, pela ordem cronológica.
 * @returns {Array<{ bloco: object, aulas: string, ch: number }>}
 */
function numerarAulas(blocos) {
  let proximaAula = 1;

  return (blocos || []).map((bloco) => {
    const totalAulas = (bloco.aulas || []).length;
    const horas =
      bloco.cargaHoraria ||
      (bloco.aulas || []).reduce((soma, aula) => soma + (aula.horas || 0), 0);

    let rotulo = '';

    if (totalAulas > 0) {
      const primeira = proximaAula;
      const ultima = proximaAula + totalAulas - 1;
      rotulo = primeira === ultima ? String(primeira) : `${primeira} a ${ultima}`;
      proximaAula = ultima + 1;
    }

    return { bloco, aulas: rotulo, ch: horas };
  });
}

/**
 * Junta ambientes pedagógicos, recursos didáticos e acessibilidade na coluna
 * única que o formulário prevê.
 *
 * @param {object} bloco
 * @param {string} acessibilidade Texto comum à UC, elaborado pela IA.
 * @returns {string}
 */
function montarRecursos(bloco, acessibilidade) {
  const partes = [];

  if (bloco.onde) partes.push(`Ambientes: ${String(bloco.onde).trim()}`);
  if (bloco.recursos) partes.push(String(bloco.recursos).trim());
  if (acessibilidade) partes.push(`Acessibilidade: ${String(acessibilidade).trim()}`);

  return partes.join('\n');
}

/**
 * Elabora, numa única chamada, os campos do FO-178 que o planejamento não tem.
 *
 * @param {object} params
 * @param {object} params.identificacao Dados do curso e da UC.
 * @param {string[]} params.capacidades Capacidades distintas da UC.
 * @param {string[]} params.conhecimentos Conhecimentos da UC.
 * @param {string[]} params.instrumentos Instrumentos de avaliação previstos.
 * @param {string} [params.instrucoes] Instruções livres do docente.
 * @returns {Promise<object>} Campos elaborados.
 */
async function elaborarCamposEmFalta({
  identificacao,
  capacidades,
  conhecimentos,
  instrumentos,
  instrucoes,
}) {
  const i = identificacao || {};

  const prompt = `
Você é um especialista em Prática Pedagógica do SENAI, a preencher o formulário
FO-178 (Plano de Ensino) segundo a Metodologia SENAI de Educação Profissional (MSEP 2019).

DADOS DA UNIDADE CURRICULAR:
- Curso: ${i.curso || 'não informado'}
- Unidade Curricular: ${i.unidadeCurricular || 'não informada'}
- Modalidade: ${i.modalidade || 'não informada'}
- Carga horária da UC: ${i.cargaHorariaTotal || 'não informada'} horas
- Unidade Escolar: ${i.unidadeEscolar || 'não informada'}

CAPACIDADES DESENVOLVIDAS NA UC:
${capacidades.map((c, n) => `${n + 1}. ${c}`).join('\n') || 'Não informadas'}

CONHECIMENTOS DA UC:
${conhecimentos.slice(0, 40).join('\n') || 'Não informados'}

INSTRUMENTOS DE AVALIAÇÃO PREVISTOS NO PLANEJAMENTO:
${instrumentos.join('; ') || 'Não informados'}
${instrucoes ? `\nINSTRUÇÕES ADICIONAIS DO DOCENTE (prioridade alta):\n${instrucoes}\n` : ''}

Elabore os campos do formulário que não constam do planejamento. Regras:

1. "funcao" e "subfuncao": a Função é a grande área de atuação do perfil
   profissional do curso (ex.: "Operação de sistemas computacionais"); a
   Subfunção é o recorte dessa função a que esta Unidade Curricular serve.
   Uma linha cada, sem ponto final.

2. "objetivoGeral": objetivo geral DESTA Unidade Curricular, começando por verbo
   no infinitivo e abrangendo o conjunto das capacidades listadas. Um parágrafo
   de 1 a 3 frases.

3. "capacidades": devolva TODAS as capacidades recebidas, na MESMA ordem e com o
   texto EXATAMENTE igual ao recebido, cada uma classificada em "tipo" com um
   destes três valores, e nenhum outro: "Básica", "Técnica" ou "Socioemocional".
   - Básica: leitura, interpretação, comunicação, cálculo, raciocínio lógico,
     termos técnicos e demais capacidades de suporte à ocupação.
   - Técnica: capacidades diretamente ligadas ao fazer da ocupação.
   - Socioemocional: atitudes e relações — iniciativa, ética, trabalho em
     equipa, responsabilidade, controlo emocional, cooperação.

4. "acessibilidade": uma frase sobre recursos e adaptações de acessibilidade
   pertinentes a esta UC (materiais ampliados, leitor de ecrã, legendagem,
   bancada de altura regulável, tempo adicional), adequada ao que se ensina.

5. "composicaoMedia": como se compõe a média da UC, coerente com os instrumentos
   de avaliação listados acima e com a escala de conceitos da MSEP. 2 a 4 linhas.

6. "referencias": 3 a 6 referências bibliográficas reais e pertinentes aos
   conhecimentos da UC, em formato ABNT, uma por linha. Use obras que existam
   de facto; não invente títulos, autores nem ISBN.

Responda EXCLUSIVAMENTE com um objeto JSON neste formato:
{
  "funcao": "...",
  "subfuncao": "...",
  "objetivoGeral": "...",
  "capacidades": [{ "descricao": "texto igual ao recebido", "tipo": "Técnica" }],
  "acessibilidade": "...",
  "composicaoMedia": "...",
  "referencias": "uma referência por linha"
}
`;

  return gerarJson({
    model: GEMINI_MODEL,
    contents: [prompt],
    config: { ...generationConfig, maxOutputTokens: 16384 },
    etapa: 'Plano de Ensino FO-178: campos complementares',
  });
}

/**
 * Extrai o texto da capacidade de um item devolvido pela IA.
 *
 * O modelo é instruído a usar a chave "descricao", mas nem sempre obedece: já
 * devolveu a lista com outras chaves e como array de strings simples. Como a
 * classificação inteira depende disto, aceitamos as variantes em vez de perder
 * os tipos todos de uma vez.
 *
 * @param {object|string} item
 * @returns {string}
 */
function textoDaCapacidade(item) {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  return String(
    item.descricao || item.capacidade || item.texto || item.nome || ''
  );
}

/**
 * Normaliza texto para comparação tolerante a acentos, caixa e pontuação.
 * @param {string} texto
 * @returns {string}
 */
function chaveDeCapacidade(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Converte a resposta da IA num mapa de capacidade para tipo.
 *
 * Usa duas estratégias, por esta ordem:
 *
 *   1. Por posição, quando a IA devolve tantas capacidades quantas recebeu.
 *      É o caso normal, e é imune a reescritas do texto — o pedido é explícito
 *      quanto a manter a ordem.
 *   2. Por texto normalizado, para o caso de a lista vir incompleta ou
 *      reordenada.
 *
 * Uma capacidade sem correspondência fica sem tipo, em vez de receber um tipo
 * errado: no documento sai sem o prefixo, e a página de revisão avisa quantas
 * ficaram assim.
 *
 * @param {Array<{ descricao?: string, tipo?: string }>|string[]} classificadas
 * @param {string[]} originais
 * @returns {Object<string, string>} Mapa de capacidade original para tipo.
 */
function montarMapaDeTipos(classificadas, originais) {
  const lista = Array.isArray(classificadas) ? classificadas : [];
  const mapa = {};

  const tipoValido = (item) =>
    item && TIPOS_DE_CAPACIDADE.includes(item.tipo) ? item.tipo : '';

  // 1. Correspondência por posição
  if (lista.length === originais.length) {
    originais.forEach((capacidade, indice) => {
      const tipo = tipoValido(lista[indice]);
      if (tipo) mapa[capacidade] = tipo;
    });
  }

  // 2. Correspondência por texto, para o que a posição não resolveu
  const porChave = {};
  lista.forEach((item) => {
    const tipo = tipoValido(item);
    const chave = chaveDeCapacidade(textoDaCapacidade(item));
    if (tipo && chave) porChave[chave] = tipo;
  });

  originais.forEach((capacidade) => {
    if (mapa[capacidade]) return;
    const tipo = porChave[chaveDeCapacidade(capacidade)];
    if (tipo) mapa[capacidade] = tipo;
  });

  const semTipo = originais.length - Object.keys(mapa).length;
  if (semTipo > 0) {
    console.warn(
      `[FO-178] ${semTipo} de ${originais.length} capacidades ficaram sem classificação. ` +
        `A IA devolveu ${lista.length} item(ns). Sairão no documento sem o prefixo ` +
        '[Básica]/[Técnica]/[Socioemocional].'
    );
  }

  return mapa;
}

/**
 * Monta o Plano de Ensino completo no formato exigido pelo FO-178.
 *
 * Produz um documento por Unidade Curricular. Quando a UC tem mais do que uma
 * situação de aprendizagem, o bloco descritivo do formulário (estratégia
 * desafiadora, contextualização, desafio e resultados esperados) repete-se uma
 * vez por situação, antes da tabela de aulas, que cobre a UC inteira.
 *
 * @param {object} params
 * @param {object} params.plano Plano gerado ou importado de planilha.
 * @param {object[]} [params.situacoes] Situações já elaboradas na sessão.
 * @param {string} [params.instrucoes] Instruções livres do docente.
 * @returns {Promise<object>} Estrutura aceite por services/docx/fo178.js.
 */
async function montarPlanoEnsino({ plano, situacoes, instrucoes }) {
  if (!plano || !Array.isArray(plano.blocos) || plano.blocos.length === 0) {
    throw new Error('PLANO_VAZIO');
  }

  const identificacao = plano.identificacao || {};
  const blocos = plano.blocos;

  const capacidades = capacidadesDistintas(blocos);
  const conhecimentos = blocos.map((b) => b.conhecimento || b.oque || '').filter(Boolean);
  const instrumentos = [...new Set(blocos.flatMap((b) => b.instrumentos || []))];

  const elaborado = await elaborarCamposEmFalta({
    identificacao,
    capacidades,
    conhecimentos,
    instrumentos,
    instrucoes,
  });

  const tipos = montarMapaDeTipos(elaborado.capacidades, capacidades);
  const acessibilidade = String(elaborado.acessibilidade || '').trim();

  const linhas = numerarAulas(blocos).map(({ bloco, aulas, ch }) => ({
    aulas,
    ch: ch ? String(ch) : '',
    capacidades: (bloco.capacidades || []).map((capacidade) => ({
      descricao: capacidade,
      tipo: tipos[capacidade] || '',
    })),
    conhecimentos: bloco.conhecimento || bloco.oque || '',
    estrategiasEnsino: bloco.como || '',
    criterios: bloco.criterios || '',
    instrumentos: (bloco.instrumentos || []).join('; ') || bloco.instrumentosTexto || '',
    recursos: montarRecursos(bloco, acessibilidade),
  }));

  // Quando o docente ainda não elaborou nenhuma situação de aprendizagem, o
  // bloco descritivo sai em branco: o formulário continua válido e o docente
  // preenche-o à mão ou volta à página de Situação de Aprendizagem.
  const grupos = agruparBlocosPorCargaHoraria(plano);
  const descritivos =
    Array.isArray(situacoes) && situacoes.length > 0
      ? situacoes.map((situacao) => ({
          titulo: situacao.titulo || '',
          estrategiaId:
            (situacao.estrategiaDesafiadora && situacao.estrategiaDesafiadora.id) ||
            situacao.estrategiaId ||
            '',
          contextualizacao: situacao.contextualizacao || '',
          desafio: situacao.desafio || '',
          resultadosEsperados: situacao.resultadosEsperados || [],
        }))
      : [{ titulo: '', estrategiaId: '', contextualizacao: '', desafio: '', resultadosEsperados: [] }];

  return {
    identificacao: {
      curso: identificacao.curso || '',
      unidadeCurricular: identificacao.unidadeCurricular || '',
      docente: identificacao.instrutor || '',
      cargaHoraria: identificacao.cargaHorariaTotal
        ? `${identificacao.cargaHorariaTotal} horas`
        : '',
    },
    perfil: {
      funcao: String(elaborado.funcao || '').trim(),
      subfuncao: String(elaborado.subfuncao || '').trim(),
      objetivoGeral: String(elaborado.objetivoGeral || '').trim(),
    },
    situacoes: descritivos,
    linhas,
    composicaoMedia: String(elaborado.composicaoMedia || '').trim(),
    referencias: String(elaborado.referencias || '').trim(),
    parecer: '',
    // Contexto para a página de edição, não vai para o documento
    meta: {
      totalSituacoesPrevistas: grupos.length,
      situacoesElaboradas: Array.isArray(situacoes) ? situacoes.length : 0,
      acessibilidade,
      camposElaboradosPelaIa: [
        'funcao',
        'subfuncao',
        'objetivoGeral',
        'composicaoMedia',
        'referencias',
        'acessibilidade',
      ],
      capacidadesSemClassificacao: capacidades.filter((c) => !tipos[c]),
      geradoEm: new Date().toISOString(),
    },
  };
}

module.exports = {
  montarPlanoEnsino,
  elaborarCamposEmFalta,
  numerarAulas,
  capacidadesDistintas,
  montarMapaDeTipos,
  montarRecursos,
  TIPOS_DE_CAPACIDADE,
};
