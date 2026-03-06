const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY } = require('./index');

// Inicialização do cliente Gemini a partir da chave já validada em config/index
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const generationConfig = {
  temperature: 0.4,
  maxOutputTokens: 8192,
  responseMimeType: 'application/json',
};

// Modelo configurado para retornar JSON (usado na maioria das etapas)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro',
  generationConfig,
});

// Modelo "texto livre" para análises da matriz SAEP
const textModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro',
});

module.exports = {
  model,
  textModel,
};

