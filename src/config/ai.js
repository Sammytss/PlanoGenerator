const { GoogleGenAI } = require('@google/genai');
const { VERTEX_PROJECT_ID, VERTEX_LOCATION } = require('./index');

// Inicialização do cliente Google Gen AI para Vertex AI
const client = new GoogleGenAI({ 
  vertexai: true,
  project: VERTEX_PROJECT_ID, 
  location: VERTEX_LOCATION 
});

const generationConfig = {
  temperature: 0.4,
  maxOutputTokens: 8192,
  responseMimeType: 'application/json',
};

module.exports = {
  client,
  generationConfig,
};

