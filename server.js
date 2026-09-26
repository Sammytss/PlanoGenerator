const express = require('express');
const path = require('path');
const cors = require('cors');
const { PORT, corsOptions, LOGOTIPO_URL } = require('./src/config');
const { upload, uploadPlanilha } = require('./src/config/upload');
const { gerarPlano } = require('./src/services/planGenerator');
const { importarPlanilha } = require('./src/services/planParser');
const { gerarFicha } = require('./src/services/fichaGenerator');
const {
  gerarSituacao,
  agruparBlocosPorCargaHoraria,
  ESTRATEGIAS_DESAFIADORAS,
} = require('./src/services/situacaoGenerator');
const { exportarDocumento } = require('./src/services/docExporter');
const { montarPlanoEnsino } = require('./src/services/planoEnsinoGenerator');
const { gerarDocx } = require('./src/services/docx/fo178');

const app = express();

// Middleware base
app.use(cors(corsOptions));
// Limite generoso: fichas de observação preenchidas com muitos critérios e
// rubricas ultrapassam com facilidade o limite padrão de 100kb.
app.use(express.json({ limit: '5mb' }));

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

app.get('/ficha-observacao', (req, res) => {
  res.sendFile(path.join(__dirname, 'ficha-observacao.html'));
});

app.get('/situacao-aprendizagem', (req, res) => {
  res.sendFile(path.join(__dirname, 'situacao-aprendizagem.html'));
});

app.get('/plano-ensino', (req, res) => {
  res.sendFile(path.join(__dirname, 'plano-ensino.html'));
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

    const capacidadesFile =
      req.files &&
      req.files.capacidadesFile &&
      Array.isArray(req.files.capacidadesFile) &&
      req.files.capacidadesFile[0]
        ? req.files.capacidadesFile[0]
        : null;

    const matrixFile =
      req.files &&
      req.files.matrixFile &&
      Array.isArray(req.files.matrixFile) &&
      req.files.matrixFile[0]
        ? req.files.matrixFile[0]
        : null;

    const data = await gerarPlano(
      { body: req.body, pdfFile, capacidadesFile, matrixFile },
      sendUpdate
    );

    // Mensagem final "DONE" enviada apenas aqui (controlador)
    sendUpdate(`DONE:${JSON.stringify(data)}`);
    res.end();
  } catch (error) {
    console.error('Erro no processo:', error);

    let userMessage = 'Ocorreu um erro interno ao gerar o plano. Tente novamente em alguns instantes.';

    if (error && typeof error.message === 'string') {
      if (error.message === 'QUOTA_ESGOTADA') {
        userMessage =
          'O limite de uso da IA do Google foi atingido. Aguarde alguns minutos e tente novamente. ' +
          'Se acontecer com frequência, será preciso aumentar a quota do projeto no Vertex AI.';
      } else if (error.message === 'FALHA_DE_REDE') {
        userMessage =
          `A ligação ao Vertex AI falhou em "${error.etapa || 'uma das etapas'}" e não recuperou ` +
          'após várias tentativas. Verifique a ligação à internet do servidor e tente novamente.';
      } else if (error.message === 'RESPOSTA_TRUNCADA') {
        userMessage =
          `A IA devolveu uma resposta incompleta em "${error.etapa || 'uma das etapas'}". ` +
          'Tente novamente; se persistir, o conteúdo desta UC pode ser extenso demais para uma única resposta.';
      } else if (error.message === 'JSON_INVALIDO' || error.message === 'RESPOSTA_VAZIA') {
        userMessage =
          `A IA devolveu uma resposta que não pôde ser interpretada em "${error.etapa || 'uma das etapas'}". ` +
          'Tente novamente em alguns instantes.';
      } else if (error.message.includes('É necessário enviar o PDF')) {
        // Erro de validação que o usuário precisa ver exatamente
        userMessage = 'É necessário enviar o PDF da Unidade Curricular para elaborar o plano.';
      } else if (error.message.includes('Nenhuma data de aula válida foi encontrada')) {
        userMessage =
          'Nenhuma data de aula válida foi encontrada. Verifique datas de início e término, dias de aula, feriados e férias.';
      } else if (error.message.includes('A Etapa 1 não conseguiu encontrar')) {
        // Esta mensagem já diz qual UC falhou e o que fazer a seguir — é mais
        // útil ao docente do que um texto genérico.
        userMessage = error.message;
      }
    }

    sendUpdate(`ERRO:${userMessage}`);
    res.end();
  }
});

/**
 * Traduz os erros levantados por src/services/aiRunner.js em mensagens que o
 * utilizador consegue interpretar e agir sobre.
 *
 * @param {Error} erro Erro capturado.
 * @param {string} acao Descrição da ação que falhou (ex.: "gerar a ficha").
 * @returns {string} Mensagem para o utilizador.
 */
function mensagemErroIa(erro, acao) {
  const etapa = (erro && erro.etapa) || 'uma das etapas';

  switch (erro && erro.message) {
    case 'QUOTA_ESGOTADA':
      return (
        'O limite de uso da IA do Google foi atingido. Aguarde alguns minutos e tente novamente. ' +
        'Se acontecer com frequência, será preciso aumentar a quota do projeto no Vertex AI.'
      );
    case 'FALHA_DE_REDE':
      return (
        `A ligação ao Vertex AI falhou em "${etapa}" e não recuperou após várias tentativas. ` +
        'Verifique a ligação à internet do servidor e tente novamente.'
      );
    case 'RESPOSTA_TRUNCADA':
      return (
        `A IA devolveu uma resposta incompleta em "${etapa}". Tente novamente; se persistir, ` +
        'reduza o número de capacidades deste item ou use o campo de instruções para pedir algo mais sucinto.'
      );
    case 'JSON_INVALIDO':
    case 'RESPOSTA_VAZIA':
      return `A IA devolveu uma resposta que não pôde ser interpretada em "${etapa}". Tente novamente em alguns instantes.`;
    case 'FICHA_SEM_CRITERIOS':
      return 'A IA não conseguiu elaborar critérios para este item. Tente novamente ou use o campo de instruções para dar mais contexto.';
    default:
      return `Ocorreu um erro ao ${acao}. Tente novamente em alguns instantes.`;
  }
}

// ---------------------------------------------------------------------------
// Importação de um plano a partir de uma planilha já gerada
// ---------------------------------------------------------------------------
// Permite usar a Ficha de Observação e a Situação de Aprendizagem sem ter
// gerado o planejamento na mesma sessão do navegador.
app.post('/api/importar-plano', uploadPlanilha, (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Envie a planilha de planejamento docente em formato .xlsx.',
    });
  }

  try {
    const plano = importarPlanilha(req.file.buffer);
    return res.json({ success: true, plano });
  } catch (erro) {
    console.error('Erro ao importar planilha:', erro);

    const mensagens = {
      PLANILHA_ILEGIVEL: 'Não foi possível ler o ficheiro. Confirme que é uma planilha .xlsx válida.',
      PLANILHA_FORA_DO_FORMATO:
        'A planilha não parece ter sido gerada pelo Plano Generator. Envie o ficheiro exportado do Google Sheets sem alterar a estrutura das colunas.',
      PLANILHA_SEM_CONTEUDO: 'A planilha foi lida, mas nenhuma linha de planejamento foi encontrada.',
    };

    return res.status(400).json({
      success: false,
      error: mensagens[erro.message] || 'Não foi possível importar a planilha.',
    });
  }
});

// ---------------------------------------------------------------------------
// Geração de Ficha de Observação
// ---------------------------------------------------------------------------
app.post('/api/ficha-observacao', async (req, res) => {
  const { bloco, identificacao, metodo, instrucoes } = req.body || {};

  if (!bloco) {
    return res.status(400).json({
      success: false,
      error: 'Selecione um item do planejamento para gerar a ficha.',
    });
  }

  try {
    const ficha = await gerarFicha({ bloco, identificacao, metodo, instrucoes });
    return res.json({ success: true, ficha });
  } catch (erro) {
    console.error('Erro ao gerar ficha de observação:', erro);
    return res.status(erro.message === 'QUOTA_ESGOTADA' ? 429 : 500).json({
      success: false,
      error: mensagemErroIa(erro, 'gerar a ficha de observação'),
    });
  }
});

// ---------------------------------------------------------------------------
// Situações de Aprendizagem
// ---------------------------------------------------------------------------

// Lista as estratégias desafiadoras previstas na MSEP
app.get('/api/estrategias-desafiadoras', (req, res) => {
  res.json({ success: true, estrategias: ESTRATEGIAS_DESAFIADORAS });
});

// Expõe ao navegador o logotipo institucional configurado no .env, para que os
// documentos gerados no ecrã usem a mesma marca da planilha e dos Google Docs.
app.get('/api/config', (req, res) => {
  res.json({ success: true, logotipoUrl: LOGOTIPO_URL });
});

// Agrupa os blocos do plano em situações de aprendizagem de até 60 horas
app.post('/api/situacoes/agrupar', (req, res) => {
  const { plano } = req.body || {};

  if (!plano || !Array.isArray(plano.blocos) || plano.blocos.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Nenhum planejamento carregado. Gere um plano ou importe a planilha.',
    });
  }

  const grupos = agruparBlocosPorCargaHoraria(plano);

  return res.json({
    success: true,
    grupos: grupos.map((g) => ({
      numero: g.numero,
      titulo: g.titulo,
      horas: g.horas,
      blocosIds: g.blocos.map((b) => b.id),
      conhecimentos: g.blocos.map((b) => b.conhecimento || b.oque || ''),
      totalCapacidades: [
        ...new Set(g.blocos.flatMap((b) => b.capacidades || [])),
      ].length,
    })),
  });
});

// Elabora o conteúdo pedagógico de uma situação de aprendizagem
app.post('/api/situacao-aprendizagem', async (req, res) => {
  const { plano, numeroGrupo, estrategiaId, instrucoes } = req.body || {};

  if (!plano || !Array.isArray(plano.blocos) || plano.blocos.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Nenhum planejamento carregado. Gere um plano ou importe a planilha.',
    });
  }

  const grupos = agruparBlocosPorCargaHoraria(plano);
  const grupo = grupos.find((g) => g.numero === Number(numeroGrupo)) || grupos[0];

  if (!grupo) {
    return res.status(400).json({
      success: false,
      error: 'Não foi possível identificar o bloco de horas da situação de aprendizagem.',
    });
  }

  try {
    const situacao = await gerarSituacao({
      grupo,
      identificacao: plano.identificacao || {},
      estrategiaId,
      numero: grupo.numero,
      totalSituacoes: grupos.length,
      instrucoes,
    });

    return res.json({ success: true, situacao });
  } catch (erro) {
    console.error('Erro ao gerar situação de aprendizagem:', erro);
    return res.status(erro.message === 'QUOTA_ESGOTADA' ? 429 : 500).json({
      success: false,
      error: mensagemErroIa(erro, 'elaborar a situação de aprendizagem'),
    });
  }
});

// ---------------------------------------------------------------------------
// Plano de Ensino no formulário FO-178
// ---------------------------------------------------------------------------

// Elabora os campos do FO-178 que o planejamento não contém (perfil
// profissional, classificação das capacidades, composição da média e
// referências) e devolve o documento pronto para revisão do docente.
app.post('/api/plano-ensino', async (req, res) => {
  const { plano, situacoes, instrucoes } = req.body || {};

  if (!plano || !Array.isArray(plano.blocos) || plano.blocos.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Nenhum planejamento carregado. Gere um plano ou importe a planilha.',
    });
  }

  try {
    const planoEnsino = await montarPlanoEnsino({ plano, situacoes, instrucoes });
    return res.json({ success: true, planoEnsino });
  } catch (erro) {
    console.error('Erro ao montar o plano de ensino FO-178:', erro);
    return res.status(erro.message === 'QUOTA_ESGOTADA' ? 429 : 500).json({
      success: false,
      error: mensagemErroIa(erro, 'elaborar o Plano de Ensino'),
    });
  }
});

// Gera o ficheiro .docx a partir do plano de ensino já revisto pelo docente.
// O documento é montado sobre o próprio formulário oficial, pelo que conserva o
// cabeçalho de documento controlado, o logotipo e a orientação paisagem.
app.post('/api/plano-ensino/docx', (req, res) => {
  const { planoEnsino } = req.body || {};

  if (!planoEnsino || !Array.isArray(planoEnsino.linhas)) {
    return res.status(400).json({
      success: false,
      error: 'Conteúdo inválido para exportação do Plano de Ensino.',
    });
  }

  try {
    const ficheiro = gerarDocx(planoEnsino);
    const uc =
      (planoEnsino.identificacao && planoEnsino.identificacao.unidadeCurricular) ||
      'Plano de Ensino';
    // O nome vai num cabeçalho HTTP: mantemos apenas caracteres seguros.
    const nome = `FO-178 - ${uc}`.replace(/[^\w\s.-]/g, '').trim() || 'FO-178';

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${nome}.docx"`);
    res.setHeader('Content-Length', ficheiro.length);
    return res.end(ficheiro);
  } catch (erro) {
    console.error('Erro ao gerar o .docx do FO-178:', erro);

    const mensagens = {
      TEMPLATE_AUSENTE:
        'O modelo assets/templates/FO-178.docx não foi encontrado no servidor.',
      TEMPLATE_INVALIDO:
        'O modelo FO-178.docx não tem o formato esperado. Substitua-o pelo formulário oficial.',
    };

    return res.status(500).json({
      success: false,
      error: mensagens[erro.message] || 'Não foi possível gerar o ficheiro .docx.',
    });
  }
});

// ---------------------------------------------------------------------------
// Exportação para Google Docs (com links de DOCX e PDF)
// ---------------------------------------------------------------------------
app.post('/api/exportar-documento', async (req, res) => {
  const { tipo, titulo, conteudo } = req.body || {};

  if (!conteudo || (tipo !== 'ficha' && tipo !== 'situacao')) {
    return res.status(400).json({
      success: false,
      error: 'Conteúdo inválido para exportação.',
    });
  }

  try {
    const documento = await exportarDocumento(
      tipo,
      titulo || (tipo === 'ficha' ? 'Ficha de Observação' : 'Situação de Aprendizagem'),
      conteudo
    );
    return res.json({ success: true, documento });
  } catch (erro) {
    console.error('Erro ao exportar documento:', erro);
    return res.status(502).json({
      success: false,
      error:
        'Não foi possível criar o documento no Google Docs. Verifique se a versão mais recente do Apps Script foi implantada. Enquanto isso, use os botões Imprimir e Salvar em PDF.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend rodando em http://localhost:${PORT}`);
});

