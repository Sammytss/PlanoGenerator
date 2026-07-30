const { client } = require('../config/ai');

// ---------------------------------------------------------------------------
// Execução resiliente de chamadas ao Vertex AI
// ---------------------------------------------------------------------------
// Concentra aqui três proteções que faltavam e que causavam falhas em produção:
//
// 1. TRUNCAGEM POR MAX_TOKENS
//    O gemini-2.5-flash é um modelo de raciocínio e os tokens de "thinking"
//    são descontados do maxOutputTokens. Com um orçamento apertado, o modelo
//    gasta parte dele a pensar e o JSON sai cortado a meio, o que produzia
//    "Unexpected end of JSON input" ou "Unterminated string in JSON".
//    Passámos a verificar finishReason e a devolver um erro explícito.
//
// 2. QUOTA ESGOTADA (HTTP 429)
//    A elaboração faz uma chamada por conhecimento. Sem repetição, um 429 no
//    meio do percurso perdia todo o trabalho já feito. Agora há espera
//    exponencial antes de desistir.
//
// 3. JSON INVÁLIDO
//    JSON.parse era chamado diretamente sobre a resposta, resultando em
//    SyntaxError sem contexto. Agora a mensagem diz qual etapa falhou e o
//    início da resposta é registado para diagnóstico.
// ---------------------------------------------------------------------------

/** Número de tentativas por chamada (1 inicial + repetições). */
const MAX_TENTATIVAS = 4;

/** Espera base entre tentativas, duplicada a cada falha. */
const ESPERA_BASE_MS = 4000;

/** Códigos HTTP que compensa repetir: quota e indisponibilidade temporária. */
const STATUS_REPETIVEIS = [429, 500, 502, 503, 504];

/**
 * Pausa a execução.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extrai o código de estado de um erro do SDK do Vertex AI.
 * @param {any} erro
 * @returns {number|null}
 */
function statusDoErro(erro) {
  if (!erro) return null;
  if (typeof erro.status === 'number') return erro.status;
  if (erro.code && typeof erro.code === 'number') return erro.code;

  // Alguns erros trazem o JSON da API na mensagem
  const encontrado = /"code"\s*:\s*(\d{3})/.exec(erro.message || '');
  return encontrado ? parseInt(encontrado[1], 10) : null;
}

/**
 * Chama o modelo repetindo em caso de quota esgotada ou falha temporária.
 *
 * @param {object} params
 * @param {string} params.model Nome do modelo.
 * @param {any[]} params.contents Conteúdos da chamada.
 * @param {object} [params.config] Configuração de geração.
 * @param {string} params.etapa Nome legível da etapa, usado nas mensagens.
 * @param {(msg: string) => void} [params.sendUpdate] Progresso para o utilizador.
 * @returns {Promise<object>} Resposta do SDK.
 * @throws {Error} QUOTA_ESGOTADA quando todas as tentativas falham por 429.
 */
async function chamarModelo({ model, contents, config, etapa, sendUpdate }) {
  let ultimoErro = null;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
    try {
      return await client.models.generateContent({ model, contents, config });
    } catch (erro) {
      ultimoErro = erro;
      const status = statusDoErro(erro);

      if (!STATUS_REPETIVEIS.includes(status) || tentativa === MAX_TENTATIVAS) {
        break;
      }

      const espera = ESPERA_BASE_MS * Math.pow(2, tentativa - 1);
      const motivo = status === 429 ? 'limite de uso da IA atingido' : `falha temporária (${status})`;

      console.warn(
        `[${etapa}] ${motivo}. Nova tentativa ${tentativa + 1}/${MAX_TENTATIVAS} em ${espera / 1000}s.`
      );
      if (sendUpdate) {
        sendUpdate(
          `Aguardando: ${motivo}. Nova tentativa em ${espera / 1000}s (${tentativa}/${MAX_TENTATIVAS - 1})`
        );
      }

      await esperar(espera);
    }
  }

  if (statusDoErro(ultimoErro) === 429) {
    const erro = new Error('QUOTA_ESGOTADA');
    erro.etapa = etapa;
    erro.causa = ultimoErro;
    throw erro;
  }

  throw ultimoErro;
}

/**
 * Verifica se a resposta do modelo está completa.
 *
 * @param {object} resposta Resposta do SDK.
 * @param {string} etapa Nome legível da etapa.
 * @throws {Error} RESPOSTA_TRUNCADA ou RESPOSTA_VAZIA.
 */
function validarResposta(resposta, etapa) {
  const candidato = (resposta && resposta.candidates && resposta.candidates[0]) || {};
  const motivo = candidato.finishReason;
  const uso = (resposta && resposta.usageMetadata) || {};

  if (motivo === 'MAX_TOKENS') {
    console.error(
      `[${etapa}] Resposta truncada por MAX_TOKENS. ` +
        `thinking=${uso.thoughtsTokenCount || 0} saida=${uso.candidatesTokenCount || 0}. ` +
        'Aumente maxOutputTokens ou reduza thinkingBudget em src/config/ai.js.'
    );
    const erro = new Error('RESPOSTA_TRUNCADA');
    erro.etapa = etapa;
    throw erro;
  }

  const texto = (resposta && resposta.text) || '';
  if (!texto.trim()) {
    console.error(`[${etapa}] Resposta vazia. finishReason=${motivo}.`);
    const erro = new Error('RESPOSTA_VAZIA');
    erro.etapa = etapa;
    throw erro;
  }
}

/**
 * Chama o modelo e devolve a resposta como texto simples.
 *
 * @param {object} params Ver chamarModelo.
 * @returns {Promise<string>} Texto devolvido pelo modelo.
 */
async function gerarTexto(params) {
  const resposta = await chamarModelo(params);
  validarResposta(resposta, params.etapa);
  return resposta.text;
}

/**
 * Chama o modelo e devolve a resposta já convertida em objeto.
 *
 * @param {object} params Ver chamarModelo.
 * @returns {Promise<any>} Objeto resultante do JSON devolvido pelo modelo.
 * @throws {Error} JSON_INVALIDO quando a resposta não é JSON válido.
 */
async function gerarJson(params) {
  const resposta = await chamarModelo(params);
  validarResposta(resposta, params.etapa);

  const texto = resposta.text;

  try {
    return JSON.parse(texto);
  } catch (erro) {
    console.error(
      `[${params.etapa}] JSON inválido devolvido pelo modelo: ${erro.message}\n` +
        `Início da resposta: ${texto.slice(0, 400)}`
    );
    const falha = new Error('JSON_INVALIDO');
    falha.etapa = params.etapa;
    falha.causa = erro;
    throw falha;
  }
}

module.exports = {
  gerarTexto,
  gerarJson,
  chamarModelo,
  validarResposta,
  statusDoErro,
};
