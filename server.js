const express = require('express');
const path = require('path');
const cors = require('cors');
const { PORT, corsOptions } = require('./src/config');
const { upload } = require('./src/config/upload');
const { gerarPlano } = require('./src/services/planGenerator');

const app = express();

// Middleware base
app.use(cors(corsOptions));
app.use(express.json());

// ---------------------------------------------------------------------------
// Arquivos estáticos e página principal
// ---------------------------------------------------------------------------
app.use('/assets/css', express.static(path.join(__dirname, 'assets/css')));
app.use('/assets/js', express.static(path.join(__dirname, 'assets/js')));
app.use('/assets/Images', express.static(path.join(__dirname, 'assets/Images')));
app.use('/assets/data', express.static(path.join(__dirname, 'assets/data')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---------------------------------------------------------------------------
// Rota principal de geração de plano
// ---------------------------------------------------------------------------
app.post('/gerar-plano', upload, async (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const sendUpdate = (message) => {
    res.write(`${message}\n`);
  };

  try {
    const pdfFile =
      req.files &&
      req.files.pdfFile &&
      Array.isArray(req.files.pdfFile) &&
      req.files.pdfFile[0]
        ? req.files.pdfFile[0]
        : null;

    const matrixFile =
      req.files &&
      req.files.matrixFile &&
      Array.isArray(req.files.matrixFile) &&
      req.files.matrixFile[0]
        ? req.files.matrixFile[0]
        : null;

    const data = await gerarPlano(
      { body: req.body, pdfFile, matrixFile },
      sendUpdate
    );

    // Mensagem final "DONE" enviada apenas aqui (controlador)
    sendUpdate(`DONE:${JSON.stringify(data)}`);
    res.end();
  } catch (error) {
    console.error('Erro no processo:', error);

    let userMessage = 'Ocorreu um erro interno ao gerar o plano. Tente novamente em alguns instantes.';

    if (error && typeof error.message === 'string') {
      if (error.message.includes('É necessário enviar o PDF')) {
        // Erro de validação que o usuário precisa ver exatamente
        userMessage = 'É necessário enviar o PDF da Unidade Curricular para elaborar o plano.';
      } else if (error.message.includes('Nenhuma data de aula válida foi encontrada')) {
        userMessage =
          'Nenhuma data de aula válida foi encontrada. Verifique datas de início e término, dias de aula, feriados e férias.';
      } else if (error.message.includes('Etapa 1 não conseguiu encontrar tópicos')) {
        userMessage =
          'Não foi possível identificar os conhecimentos no PDF da UC. Confira se o documento está no formato esperado.';
      }
    }

    sendUpdate(`ERRO:${userMessage}`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend rodando em http://localhost:${PORT}`);
});

