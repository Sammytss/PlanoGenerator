const axios = require('axios');
const { APPS_SCRIPT_URL, LOGOTIPO_URL } = require('../config');

// ---------------------------------------------------------------------------
// Exportação de Fichas de Observação e Situações de Aprendizagem
// ---------------------------------------------------------------------------
// O Apps Script cria um Google Docs a partir do conteúdo estruturado enviado
// daqui. A partir do id devolvido, montamos as três formas de consumo pedidas:
//
//   - Google Docs editável: o link "/copy" abre o diálogo de cópia, colocando
//     o documento no Drive da conta Google em que o professor está autenticado.
//     Optámos por partilhar o original apenas como leitura (tal como já é feito
//     com as planilhas) para não expor documentos com nomes de alunos a
//     qualquer pessoa com o link.
//   - DOCX: endpoint nativo de exportação do Google Docs.
//   - PDF: endpoint nativo de exportação do Google Docs.
// ---------------------------------------------------------------------------

/**
 * Monta as URLs de consumo de um Google Docs a partir do seu id.
 * @param {string} documentId
 * @returns {{ docUrl: string, copyUrl: string, docxUrl: string, pdfUrl: string }}
 */
function montarLinks(documentId) {
  const base = `https://docs.google.com/document/d/${documentId}`;
  return {
    docUrl: `${base}/edit`,
    copyUrl: `${base}/copy`,
    docxUrl: `${base}/export?format=docx`,
    pdfUrl: `${base}/export?format=pdf`,
  };
}

/**
 * Envia o conteúdo ao Apps Script e devolve os links do documento criado.
 *
 * @param {'ficha'|'situacao'} acao Tipo de documento a criar.
 * @param {string} titulo Nome do ficheiro no Drive.
 * @param {object} conteudo Estrutura própria de cada tipo de documento.
 * @returns {Promise<object>} Links do documento.
 * @throws {Error} EXPORTACAO_INDISPONIVEL quando o Apps Script não respondeu
 *                 como esperado (tipicamente por não ter sido reimplantado).
 */
async function exportarDocumento(acao, titulo, conteudo) {
  const payload = {
    acao,
    titulo,
    imageUrl: LOGOTIPO_URL,
    conteudo,
  };

  let resposta;
  try {
    resposta = await axios.post(APPS_SCRIPT_URL, payload, { timeout: 120000 });
  } catch (erro) {
    console.error('Falha ao contactar o Apps Script para exportação:', erro.message);
    throw new Error('EXPORTACAO_INDISPONIVEL');
  }

  const dados = resposta && resposta.data;

  if (!dados || dados.success !== true || !dados.documentId) {
    console.error('Resposta inesperada do Apps Script na exportação:', dados);
    throw new Error('EXPORTACAO_INDISPONIVEL');
  }

  return {
    documentId: dados.documentId,
    documentName: dados.documentName || titulo,
    ...montarLinks(dados.documentId),
  };
}

module.exports = {
  exportarDocumento,
  montarLinks,
};
