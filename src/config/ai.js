const { VertexAI } = require('@google-cloud/vertexai');
const { VERTEX_PROJECT_ID, VERTEX_LOCATION } = require('./index');

// Inicialização do cliente Vertex AI
const vertexAI = new VertexAI({ project: VERTEX_PROJECT_ID, location: VERTEX_LOCATION });

const generationConfig = {
  temperature: 0.4,
  maxOutputTokens: 8192,
  responseMimeType: 'application/json',
};

// Modelo configurado para retornar JSON (usado na maioria das etapas)
// Nota: 'gemini-1.5-pro' é amplamente suportado no Vertex AI. 
const model = vertexAI.preview.getGenerativeModel({
  model: 'gemini-1.5-pro',
  generationConfig,
});

// Modelo "texto livre" para análises da matriz SAEP
const textModel = vertexAI.preview.getGenerativeModel({
  model: 'gemini-1.5-pro',
});

module.exports = {
  model,
  textModel,
};

