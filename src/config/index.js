const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Carregamento de variáveis de ambiente (.env)
// - Prioriza .env na raiz do projeto
// - Mantém compatibilidade com .env antigo em assets/backend-planilhas
// ---------------------------------------------------------------------------
const possibleEnvPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../assets/backend-planilhas/.env'),
];

const existingEnvPath = possibleEnvPaths.find((p) => fs.existsSync(p));

if (existingEnvPath) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  require('dotenv').config({ path: existingEnvPath });
} else {
  require('dotenv').config();
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log(
  'Chave de API atribuída à constante:',
  GEMINI_API_KEY ? 'SUCESSO' : 'FALHA - undefined'
);

if (!GEMINI_API_KEY) {
  throw new Error(
    'A chave GEMINI_API_KEY não foi encontrada no ficheiro .env. Verifique o ficheiro e reinicie o servidor.'
  );
}

// Porta do servidor HTTP
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// CORS
// - Por padrão, mantém comportamento aberto (como antes)
// - Permite restringir origens via CORS_ORIGINS="https://site1,https://site2"
// ---------------------------------------------------------------------------
const corsOrigins = process.env.CORS_ORIGINS;
const corsOptions = {};

if (corsOrigins) {
  const allowedOrigins = corsOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  corsOptions.origin = (origin, callback) => {
    // Requisições sem origin (ex.: curl, Postman) continuam permitidas
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  };
}

// ---------------------------------------------------------------------------
// URLs externas (Apps Script e logotipo)
// ---------------------------------------------------------------------------
const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwMD3VdA6awCyL8KBoOcc7e0qN-gyh9aOxRnByBFYxN8mmpOk79562lJqGUGVsK1ynr/exec';

const LOGOTIPO_URL =
  process.env.LOGOTIPO_URL ||
  'https://www.imagemhost.com.br/images/2024/11/22/Logo-novo-SENAI_-sem-slogan_755X325.png';

module.exports = {
  GEMINI_API_KEY,
  PORT,
  corsOptions,
  APPS_SCRIPT_URL,
  LOGOTIPO_URL,
};

