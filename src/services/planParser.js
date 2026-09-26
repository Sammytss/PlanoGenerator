const XLSX = require('xlsx');
const { normalizarInstrumentos, usaFichaDeObservacao } = require('./instrumentos');

// ---------------------------------------------------------------------------
// Leitura de uma planilha de Planejamento Docente já gerada pelo Plano Generator
// ---------------------------------------------------------------------------
// Permite que o professor use as páginas de Ficha de Observação e de Situação de
// Aprendizagem sem ter gerado o plano na mesma sessão do navegador.
//
// O leiaute reproduzido aqui é exatamente o escrito por apps-script/doPost.js:
//   - Linhas 5 a 8: bloco de identificação do curso
//   - Linhas 10 a 12: cabeçalho da tabela
//   - Linha 13 em diante: dados, um bloco de conhecimento por conjunto de linhas
//   - Cada aba corresponde a um bloco de até 60 horas
// ---------------------------------------------------------------------------

/** Posições das colunas quando a coluna SAEP está presente (A–T). */
const LAYOUT_COM_SAEP = {
  oque: 1,
  saep: 4,
  como: 5,
  onde: 8,
  recursos: 10,
  carga: 13,
  criterios: 14,
  instrumentos: 17,
  situacao: 18,
  inicio: 19,
  fim: 20,
};

/** Posições das colunas quando a coluna SAEP é omitida (A–S). */
const LAYOUT_SEM_SAEP = {
  oque: 1,
  saep: null,
  como: 4,
  onde: 7,
  recursos: 9,
  carga: 12,
  criterios: 13,
  instrumentos: 16,
  situacao: 17,
  inicio: 18,
  fim: 19,
};

/**
 * Lê o valor de uma célula pela sua posição (1-indexada em linha e coluna).
 * @param {object} sheet Aba do workbook.
 * @param {number} linha Número da linha (1-indexado).
 * @param {number} coluna Número da coluna (1-indexado).
 * @returns {string} Valor como texto, já aparado. String vazia se não existir.
 */
function celula(sheet, linha, coluna) {
  if (!linha || !coluna) return '';
  const endereco = XLSX.utils.encode_cell({ r: linha - 1, c: coluna - 1 });
  const cel = sheet[endereco];
  if (!cel) return '';
  if (cel.t === 'd' && cel.v instanceof Date) {
    return cel.v.toLocaleDateString('pt-BR');
  }
  const valor = cel.w !== undefined ? cel.w : cel.v;
  return valor === undefined || valor === null ? '' : String(valor).trim();
}

/**
 * Lê uma célula numérica (usada para a carga horária de cada linha de aula).
 * @param {object} sheet
 * @param {number} linha
 * @param {number} coluna
 * @returns {number} 0 quando a célula está vazia ou não é numérica.
 */
function celulaNumero(sheet, linha, coluna) {
  const bruto = celula(sheet, linha, coluna);
  const numero = parseInt(String(bruto).replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(numero) ? 0 : numero;
}

/**
 * Separa o conteúdo do campo "O que?" nas capacidades e no conhecimento.
 *
 * O planGenerator grava esse campo no formato:
 *   "[H97 - ...];\n[H98 - ...];\n\nPor meio de:\n\n<conhecimento e subtópicos>"
 *
 * @param {string} oque Texto completo da célula.
 * @returns {{ capacidades: string[], conhecimento: string }}
 */
function separarCapacidadesEConhecimento(oque) {
  if (!oque) return { capacidades: [], conhecimento: '' };

  const marcador = /por\s+meio\s+de\s*:?/i;
  const posicao = oque.search(marcador);

  let blocoCapacidades = oque;
  let conhecimento = '';

  if (posicao !== -1) {
    blocoCapacidades = oque.slice(0, posicao);
    conhecimento = oque
      .slice(posicao)
      .replace(marcador, '')
      .trim();
  }

  const capacidades = blocoCapacidades
    .replace(/^\s*\[|\]\s*$/g, '')
    .split(/;\s*|\n+/)
    .map((c) => c.replace(/^[\s\-*•\[\]]+|[\s\[\],;.]+$/g, '').trim())
    .filter((c) => c.length > 2);

  return { capacidades, conhecimento };
}

/**
 * Detecta se a aba usa o leiaute com ou sem a coluna SAEP.
 * A célula D11 contém o título "Identificação - MATRIZ DE REFERÊNCIA SAEP"
 * apenas no leiaute completo.
 * @param {object} sheet
 * @returns {boolean} true quando a coluna SAEP está ausente.
 */
function detectarLayoutSemSaep(sheet) {
  const d11 = celula(sheet, 11, 4).toUpperCase();
  return !d11.includes('SAEP');
}

/**
 * Extrai o bloco de identificação do curso (linhas 5 a 8).
 * @param {object} sheet
 * @returns {object}
 */
function lerIdentificacao(sheet) {
  const periodo = celula(sheet, 5, 12);
  const [dataInicio, dataFim] = periodo.split(/\s*-\s*/);

  return {
    unidadeEscolar: celula(sheet, 5, 3),
    curso: celula(sheet, 6, 3),
    codigoTurma: celula(sheet, 7, 3),
    unidadeCurricular: celula(sheet, 8, 3),
    periodo,
    dataInicio: dataInicio || '',
    dataFim: dataFim || '',
    modalidade: celula(sheet, 6, 12),
    cargaHorariaTotal: celula(sheet, 7, 12),
    instrutor: celula(sheet, 8, 12),
  };
}

/**
 * Lê todos os blocos de conhecimento de uma aba.
 *
 * Um bloco começa na linha em que a coluna "O que?" tem conteúdo (as demais
 * linhas do bloco ficam vazias por causa da mesclagem) e termina na linha
 * anterior ao próximo bloco.
 *
 * @param {object} sheet
 * @param {object} layout Mapa de colunas.
 * @param {string} nomePagina
 * @param {number} deslocamentoId Contador global para gerar ids únicos.
 * @returns {object[]} Blocos encontrados.
 */
function lerBlocos(sheet, layout, nomePagina, deslocamentoId) {
  const intervalo = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const ultimaLinha = intervalo.e.r + 1;

  const blocos = [];
  let blocoAtual = null;

  for (let linha = 13; linha <= ultimaLinha; linha += 1) {
    const oque = celula(sheet, linha, layout.oque);
    const horas = celulaNumero(sheet, linha, layout.carga);
    const dataInicio = celula(sheet, linha, layout.inicio);

    // Linha completamente vazia: nada a fazer
    if (!oque && !horas && !dataInicio) continue;

    if (oque) {
      const { capacidades, conhecimento } = separarCapacidadesEConhecimento(oque);
      const instrumentosBrutos = celula(sheet, linha, layout.instrumentos);
      const instrumentos = normalizarInstrumentos(instrumentosBrutos);

      blocoAtual = {
        id: `bloco-${deslocamentoId + blocos.length + 1}`,
        pagina: nomePagina,
        linhaInicial: linha,
        oque,
        capacidades,
        conhecimento,
        saep: layout.saep ? celula(sheet, linha, layout.saep) : '',
        como: celula(sheet, linha, layout.como),
        onde: celula(sheet, linha, layout.onde),
        recursos: celula(sheet, linha, layout.recursos),
        criterios: celula(sheet, linha, layout.criterios),
        instrumentosTexto: instrumentosBrutos,
        instrumentos,
        usaFichaObservacao: usaFichaDeObservacao(instrumentos),
        situacaoAprendizagem: celula(sheet, linha, layout.situacao),
        cargaHoraria: 0,
        aulas: [],
      };
      blocos.push(blocoAtual);
    }

    if (blocoAtual && (horas || dataInicio)) {
      blocoAtual.cargaHoraria += horas;
      blocoAtual.aulas.push({
        horas,
        data: dataInicio,
      });
    }
  }

  return blocos;
}

/**
 * Converte o buffer de uma planilha gerada pelo Plano Generator na mesma
 * estrutura de plano usada pelas páginas de Ficha de Observação e Situação de
 * Aprendizagem.
 *
 * @param {Buffer} buffer Conteúdo do ficheiro .xlsx enviado pelo professor.
 * @returns {object} Plano importado.
 * @throws {Error} Quando a planilha não tem o formato esperado.
 */
function importarPlanilha(buffer) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch (e) {
    throw new Error('PLANILHA_ILEGIVEL');
  }

  const nomesAbas = (workbook.SheetNames || []).filter((nome) => {
    const sheet = workbook.Sheets[nome];
    if (!sheet) return false;
    // Uma aba de plano tem o título "O que? - Cruzamento de:" na célula A11
    return celula(sheet, 11, 1).toLowerCase().includes('o que');
  });

  if (nomesAbas.length === 0) {
    throw new Error('PLANILHA_FORA_DO_FORMATO');
  }

  const primeira = workbook.Sheets[nomesAbas[0]];
  const identificacao = lerIdentificacao(primeira);

  const paginas = [];
  const blocos = [];

  nomesAbas.forEach((nome) => {
    const sheet = workbook.Sheets[nome];
    const semSaep = detectarLayoutSemSaep(sheet);
    const layout = semSaep ? LAYOUT_SEM_SAEP : LAYOUT_COM_SAEP;

    const blocosDaPagina = lerBlocos(sheet, layout, nome, blocos.length);
    const horas = blocosDaPagina.reduce((total, b) => total + b.cargaHoraria, 0);

    paginas.push({
      nome,
      semSaep,
      horas,
      blocosIds: blocosDaPagina.map((b) => b.id),
    });

    blocosDaPagina.forEach((b) => blocos.push(b));
  });

  if (blocos.length === 0) {
    throw new Error('PLANILHA_SEM_CONTEUDO');
  }

  return {
    origem: 'planilha-importada',
    importadoEm: new Date().toISOString(),
    identificacao,
    paginas,
    blocos,
  };
}

module.exports = {
  importarPlanilha,
  separarCapacidadesEConhecimento,
  LAYOUT_COM_SAEP,
  LAYOUT_SEM_SAEP,
};
