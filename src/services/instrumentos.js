// ---------------------------------------------------------------------------
// Instrumentos de avaliação da aprendizagem (MSEP 2019, p. 127-128)
// ---------------------------------------------------------------------------
// A IA escolhe os instrumentos em texto livre e, no cenário de compactação, o
// planGenerator concatena vários instrumentos com " / ". Para que as páginas de
// Ficha de Observação consigam filtrar os blocos de forma confiável, é preciso
// normalizar essas strings para um conjunto canónico.

/**
 * Instrumentos canónicos e as variações de escrita que devem ser mapeadas para
 * cada um deles. A comparação é feita sobre texto sem acentos e em minúsculas.
 */
const INSTRUMENTOS_CANONICOS = [
  { nome: 'Ficha de Observação', sinonimos: ['ficha de observacao', 'fichas de observacao', 'ficha observacao', 'roteiro de observacao', 'lista de verificacao'] },
  { nome: 'Relatório', sinonimos: ['relatorio', 'relatorios', 'relatorio tecnico', 'relatorio de aula pratica'] },
  { nome: 'Portfólio', sinonimos: ['portfolio', 'portfolios'] },
  { nome: 'Prova Objetiva', sinonimos: ['prova objetiva', 'provas objetivas', 'prova de multipla escolha'] },
  { nome: 'Prova de Resposta Construída', sinonimos: ['prova de resposta construida', 'prova de respostas construidas', 'prova dissertativa', 'prova discursiva'] },
  { nome: 'Prova Prática', sinonimos: ['prova pratica', 'provas praticas', 'avaliacao pratica'] },
  { nome: 'Lista de Exercícios', sinonimos: ['lista de exercicios', 'listas de exercicios', 'exercicios', 'estudo dirigido'] },
  { nome: 'Autoavaliação', sinonimos: ['autoavaliacao', 'auto avaliacao', 'auto-avaliacao'] },
  { nome: 'Trabalho em Grupo', sinonimos: ['trabalho em grupo', 'trabalhos em grupo', 'atividade em grupo'] },
  { nome: 'Trabalho Final', sinonimos: ['trabalho final', 'projeto final', 'trabalho de conclusao'] },
];

/**
 * Instrumentos para os quais a aplicação sabe gerar uma ficha de observação.
 * A MSEP descreve a ficha de observação como o instrumento adequado para os
 * domínios afetivo e psicomotor, ou seja, atividades práticas e capacidades
 * socioemocionais.
 */
const INSTRUMENTOS_OBSERVAVEIS = [
  'Ficha de Observação',
  'Prova Prática',
  'Trabalho em Grupo',
  'Trabalho Final',
  'Portfólio',
];

/**
 * Remove acentuação e normaliza espaços para permitir comparação tolerante.
 * @param {string} texto
 * @returns {string}
 */
function chaveComparacao(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte a string de instrumentos escrita pela IA (que pode conter vários
 * instrumentos separados por "/", ";", "," ou nova linha) numa lista de
 * instrumentos canónicos.
 *
 * Instrumentos desconhecidos são preservados com a escrita original, para que
 * nenhuma informação do plano seja perdida.
 *
 * @param {string} valor Texto bruto da coluna "Instrumentos de Avaliação".
 * @returns {string[]} Lista de instrumentos, sem duplicados.
 */
function normalizarInstrumentos(valor) {
  if (!valor || typeof valor !== 'string') return [];

  const partes = valor
    .split(/\s*[\/;\n]+\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const resultado = [];

  partes.forEach((parte) => {
    const chave = chaveComparacao(parte);
    if (!chave) return;

    const canonico = INSTRUMENTOS_CANONICOS.find(
      (i) => chaveComparacao(i.nome) === chave || i.sinonimos.includes(chave)
    );

    // Fallback: procura o canónico cujo nome esteja contido no texto
    const porInclusao =
      canonico ||
      INSTRUMENTOS_CANONICOS.find(
        (i) =>
          chave.includes(chaveComparacao(i.nome)) ||
          i.sinonimos.some((s) => chave.includes(s))
      );

    const nomeFinal = porInclusao ? porInclusao.nome : parte;
    if (!resultado.includes(nomeFinal)) resultado.push(nomeFinal);
  });

  return resultado;
}

/**
 * Indica se um bloco do plano é candidato natural a uma ficha de observação.
 * @param {string[]} instrumentos Lista já normalizada.
 * @returns {boolean}
 */
function usaFichaDeObservacao(instrumentos) {
  if (!Array.isArray(instrumentos)) return false;
  return instrumentos.some((i) => INSTRUMENTOS_OBSERVAVEIS.includes(i));
}

module.exports = {
  INSTRUMENTOS_CANONICOS,
  INSTRUMENTOS_OBSERVAVEIS,
  normalizarInstrumentos,
  usaFichaDeObservacao,
  chaveComparacao,
};
