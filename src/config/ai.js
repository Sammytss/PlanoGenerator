const { GoogleGenAI } = require('@google/genai');
const { VERTEX_PROJECT_ID, VERTEX_LOCATION } = require('./index');

// Inicialização do cliente Google Gen AI para Vertex AI
const client = new GoogleGenAI({
  vertexai: true,
  project: VERTEX_PROJECT_ID,
  location: VERTEX_LOCATION,
});

// ---------------------------------------------------------------------------
// Orçamento de tokens e raciocínio
// ---------------------------------------------------------------------------
// O gemini-2.5-flash é um modelo de raciocínio: os tokens de "thinking" são
// descontados do maxOutputTokens. Com o valor anterior (8192) e o thinking em
// modo automático, o modelo gastava parte do orçamento a pensar e devolvia JSON
// cortado a meio, com finishReason MAX_TOKENS. Sintomas em produção:
//
//   SyntaxError: Unexpected end of JSON input
//   SyntaxError: Unterminated string in JSON at position 2348
//
// Medição que sustentou os valores abaixo (extração de 40 conhecimentos):
//   8192  tokens, thinking automático -> MAX_TOKENS (1666 thinking + 6512 saída)
//   8192  tokens, thinking desligado  -> STOP, 2690 tokens de saída, 16s
//   32768 tokens, thinking automático -> STOP, 8722 thinking + 9823 saída, 105s
//
// Escolhemos um thinkingBudget explícito e baixo, com um maxOutputTokens
// bastante acima dele. Assim mantém-se alguma capacidade de raciocínio sem que
// o orçamento de saída fique à mercê de quanto o modelo decide pensar.
const MAX_OUTPUT_TOKENS = 24576;
const THINKING_BUDGET = 2048;

const generationConfig = {
  temperature: 0.4,
  maxOutputTokens: MAX_OUTPUT_TOKENS,
  responseMimeType: 'application/json',
  thinkingConfig: { thinkingBudget: THINKING_BUDGET },
};

/**
 * Configuração de geração de texto simples (sem JSON obrigatório).
 * Usada na análise da Matriz SAEP, que devolve texto corrido.
 */
const generationConfigTexto = {
  temperature: 0.4,
  maxOutputTokens: MAX_OUTPUT_TOKENS,
  thinkingConfig: { thinkingBudget: THINKING_BUDGET },
};

module.exports = {
  client,
  generationConfig,
  generationConfigTexto,
  MAX_OUTPUT_TOKENS,
  THINKING_BUDGET,
};
