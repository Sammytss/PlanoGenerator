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
// Os modelos Gemini das famílias 2.5 e 3.x são modelos de raciocínio: os tokens
// de "thinking" são descontados do maxOutputTokens. Com um valor apertado e o
// thinking em modo automático, o modelo gasta parte do orçamento a pensar e
// devolve JSON cortado a meio, com finishReason MAX_TOKENS. Sintomas:
//
//   SyntaxError: Unexpected end of JSON input
//   SyntaxError: Unterminated string in JSON at position 2348
//
// Medição com gemini-2.5-flash (extração de 40 conhecimentos):
//   8192  tokens, thinking automático -> MAX_TOKENS (1666 thinking + 6512 saída)
//   8192  tokens, thinking desligado  -> STOP, 2690 tokens de saída, 16s
//   32768 tokens, thinking automático -> STOP, 8722 thinking + 9823 saída, 105s
//
// Escolhemos um thinkingBudget explícito e baixo, com um maxOutputTokens
// bastante acima dele. Assim mantém-se alguma capacidade de raciocínio sem que
// o orçamento de saída fique à mercê de quanto o modelo decide pensar.
//
// Comparação dos modelos com esta mesma configuração e carga (pedido de 40
// conhecimentos), que motivou a adoção do gemini-3.6-flash:
//   gemini-2.5-flash -> 93s, 11968 tokens de saída, devolveu 53 itens
//   gemini-3.5-flash -> 32s,  5004 tokens de saída, devolveu 40 itens
//   gemini-3.6-flash -> 27s,  3454 tokens de saída, devolveu 40 itens
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
