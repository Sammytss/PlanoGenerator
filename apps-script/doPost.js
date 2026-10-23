// =========================================================================
//   PLANO GENERATOR - APPS SCRIPT
//   - Planilha de Planejamento Docente (ação padrão)
//   - Ficha de Observação em Google Docs (acao: "ficha")
//   - Situação de Aprendizagem em Google Docs (acao: "situacao")
// =========================================================================

// Modalidades que NÃO exibem a coluna "Identificação - MATRIZ DE REFERÊNCIA SAEP"
var MODALIDADES_SEM_SAEP = ['APRENDIZAGEM', 'QUALIFICAÇÃO', 'APERFEIÇOAMENTO', 'CURSOS LIVRES'];

// Limite de horas por aba. Cada aba corresponde a uma Situação de Aprendizagem.
var LIMITE_HORAS_POR_PAGINA = 60;

/**
 * Execute esta função MANUALMENTE no editor do Apps Script depois de colar
 * uma versão que use novos serviços do Google.
 *
 * O Apps Script deduz os escopos OAuth a partir do código, mas uma implantação
 * já existente continua a correr com os escopos autorizados anteriormente.
 * Publicar uma nova versão NÃO desencadeia nova autorização — é preciso executar
 * uma função no editor e aceitar as permissões.
 *
 * Sintoma típico quando esta etapa é esquecida:
 *   "Você não tem permissão para chamar DocumentApp.create.
 *    Permissões necessárias: https://www.googleapis.com/auth/documents"
 *
 * Esta função toca em todos os serviços usados pelo script (Documentos,
 * Planilhas, Drive e pedidos externos) e limpa o que criou.
 */
function autorizarPermissoes() {
  var falhas = [];

  var doc = DocumentApp.create('PlanoGenerator - teste de permissoes');
  var planilha = SpreadsheetApp.create('PlanoGenerator - teste de permissoes');

  // O logotipo institucional é carregado por UrlFetchApp. Sem este escopo, os
  // Google Docs são criados SEM o logo, e a falha é silenciosa em produção.
  try {
    UrlFetchApp.fetch('https://www.google.com/favicon.ico');
  } catch (e) {
    falhas.push(
      'script.external_request (UrlFetchApp) — sem ele os documentos saem SEM o logotipo do SENAI'
    );
  }

  // Remove os ficheiros de teste
  DriveApp.getFileById(doc.getId()).setTrashed(true);
  DriveApp.getFileById(planilha.getId()).setTrashed(true);

  if (falhas.length > 0) {
    var aviso =
      'AUTORIZAÇÃO INCOMPLETA. Escopos em falta:\n  - ' + falhas.join('\n  - ') +
      '\n\nCorreção: em ⚙️ Configurações do projeto, ative "Mostrar o arquivo de manifesto ' +
      'appsscript.json", substitua-o pelo conteúdo de apps-script/appsscript.json ' +
      '(que declara todos os escopos explicitamente) e execute esta função novamente.';
    Logger.log(aviso);
    throw new Error(aviso);
  }

  Logger.log('Todas as permissões concedidas. Publique agora uma NOVA VERSÃO da implantação.');
  return 'OK';
}

/**
 * Verifica se a modalidade do curso deve ocultar a coluna SAEP.
 * @param {string} modalidade Valor do campo modalidade (ex: "Aprendizagem").
 * @returns {boolean} true se a coluna SAEP deve ser removida.
 */
function modalidadeSemSaep(modalidade) {
  if (!modalidade || typeof modalidade !== 'string') return false;
  var m = modalidade.toUpperCase().trim();
  return MODALIDADES_SEM_SAEP.indexOf(m) !== -1;
}

/**
 * Cria o cabeçalho e a estrutura da tabela numa página.
 * Se a modalidade for Aprendizagem, Qualificação, Aperfeiçoamento ou Cursos Livres,
 * a coluna "Identificação - MATRIZ DE REFERÊNCIA SAEP" é omitida.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet A página (aba) onde o cabeçalho será criado.
 * @param {Object} dados Os dados recebidos do servidor.
 * @returns {boolean} true se a planilha está sem coluna SAEP (layout com 19 colunas).
 */
function criarCabecalho(sheet, dados) {
  sheet.setHiddenGridlines(true);
  var semSaep = modalidadeSemSaep(dados.modalidade);

  if (dados.imageUrl && dados.imageUrl.startsWith("http")) {
    try {
      var imagem = sheet.insertImage(dados.imageUrl, 2, 1);
      imagem.setWidth(300).setHeight(130);
    } catch (e) { Logger.log("Falha ao inserir imagem: " + e); }
  }

  // Título Principal (usa T2 ou S2 conforme layout)
  var ultimaCol = semSaep ? 'S' : 'T';
  sheet.getRange("A2").setValue("PLANEJAMENTO DOCENTE");
  sheet.getRange("A2:" + ultimaCol + "2").merge().setHorizontalAlignment("center").setVerticalAlignment("middle").setFontWeight("bold").setFontSize(35);

  // Bloco de Informações do Curso
  sheet.getRange("B5").setValue("Unidade Escolar:");
  sheet.getRange("C5:H5").merge().setValue(dados.unidadeEscolar || "Palmas - Centro de Educação e Tecnologia - CETEC");
  sheet.getRange("J5:K5").merge().setValue("Início e Fim:");
  sheet.getRange("L5:" + ultimaCol + "5").merge().setValue(dados.dataInicioCurso + " - " + dados.dataFimCurso);
  sheet.getRange("B6").setValue("Curso:");
  sheet.getRange("C6:H6").merge().setValue(dados.nomeCurso);
  sheet.getRange("J6:K6").merge().setValue("Modalidade:");
  sheet.getRange("L6:" + ultimaCol + "6").merge().setValue(dados.modalidade || "N/A");
  sheet.getRange("B7").setValue("Código da Turma:");
  sheet.getRange("C7:H7").merge().setValue(dados.codigoTurma || "N/A");
  sheet.getRange("J7:K7").merge().setValue("Carga Horária da U.C:");
  sheet.getRange("L7:" + ultimaCol + "7").merge().setValue(dados.cargaHorariaTotal).setHorizontalAlignment("left");
  sheet.getRange("B8").setValue("Unidade Curricular:");
  sheet.getRange("C8:H8").merge().setValue(dados.nomeUC);
  sheet.getRange("J8:K8").merge().setValue("Instrutor:");
  sheet.getRange("L8:" + ultimaCol + "8").merge().setValue(dados.instrutor || "N/A");

  sheet.getRange("A5:B8").setFontWeight("bold");
  sheet.getRange("J5:K8").setFontWeight("bold");
  sheet.getRange("C5:H8").setBackground("#dbe5f1");
  sheet.getRange("L5:" + ultimaCol + "8").setBackground("#dbe5f1");
  sheet.getRange("B5:" + ultimaCol + "8").setVerticalAlignment("middle");
  sheet.setRowHeights(5, 4, 30);
  for (var i = 5; i <= 8; i++) {
    sheet.getRange(i, 3, 1, 6).setBorder(true, false, true, false, false, false, '#1a73e8', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.getRange(i, 12, 1, 9).setBorder(true, false, true, false, false, false, '#1a73e8', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }

  // Bloco da Tabela de Conteúdo (com ou sem coluna SAEP)
  if (semSaep) {
    // Layout sem coluna SAEP: 19 colunas (A–S)
    sheet.getRange("A10:L10").merge().setValue("Plano de Ensino").setHorizontalAlignment("center");
    sheet.getRange("M10:S10").merge().setValue("Plano de Aula").setHorizontalAlignment("center");
    sheet.getRange("A10:S10").setFontWeight("bold").setVerticalAlignment("middle");
    sheet.getRange("A11:C12").merge().setValue("O que? - Cruzamento de:\nSubfunção\nCapacidade\nConhecimento");
    sheet.getRange("D11:F12").merge().setValue("Como?\nEstratégia de Ensino");
    sheet.getRange("G11:H12").merge().setValue("Onde?\nAmbientes Pedagógicos");
    sheet.getRange("I11:K12").merge().setValue("Recursos Didáticos");
    sheet.getRange("L11:L12").merge().setValue("Carga Horária");
    sheet.getRange("M11:O12").merge().setValue("Critérios de Avaliação");
    sheet.getRange("P11:P12").merge().setValue("Instrumentos de Avaliação da Aprendizagem");
    sheet.getRange("Q11:Q12").merge().setValue("Situação de Aprendizagem");
    sheet.getRange("R11:S11").merge().setValue("Quando");
    sheet.getRange("R12").setValue("Início");
    sheet.getRange("S12").setValue("Fim");
    sheet.getRange("A11:S12").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);
    sheet.getRange("A10:L12").setBackground("#d6e3bc");
    sheet.getRange("M10:S12").setBackground("#dbe5f1");
    sheet.setRowHeight(11, 60);
    sheet.setRowHeight(12, 40);
    sheet.getRange("A10:S12").setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    sheet.hideColumns(20);
  } else {
    // Layout com coluna SAEP: 20 colunas (A–T)
    sheet.getRange("A10:M10").merge().setValue("Plano de Ensino").setHorizontalAlignment("center");
    sheet.getRange("N10:T10").merge().setValue("Plano de Aula").setHorizontalAlignment("center");
    sheet.getRange("A10:T10").setFontWeight("bold").setVerticalAlignment("middle");
    sheet.getRange("A11:C12").merge().setValue("O que? - Cruzamento de:\nSubfunção\nCapacidade\nConhecimento");
    sheet.getRange("D11:D12").merge().setValue("Identificação - MATRIZ DE REFERÊNCIA SAEP");
    sheet.getRange("E11:G12").merge().setValue("Como?\nEstratégia de Ensino");
    sheet.getRange("H11:I12").merge().setValue("Onde?\nAmbientes Pedagógicos");
    sheet.getRange("J11:L12").merge().setValue("Recursos Didáticos");
    sheet.getRange("M11:M12").merge().setValue("Carga Horária");
    sheet.getRange("N11:P12").merge().setValue("Critérios de Avaliação");
    sheet.getRange("Q11:Q12").merge().setValue("Instrumentos de Avaliação da Aprendizagem");
    sheet.getRange("R11:R12").merge().setValue("Situação de Aprendizagem");
    sheet.getRange("S11:T11").merge().setValue("Quando");
    sheet.getRange("S12").setValue("Início");
    sheet.getRange("T12").setValue("Fim");
    sheet.getRange("A11:T12").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);
    sheet.getRange("A10:M12").setBackground("#d6e3bc");
    sheet.getRange("N10:T12").setBackground("#dbe5f1");
    sheet.setRowHeight(11, 60);
    sheet.setRowHeight(12, 40);
    sheet.getRange("A10:T12").setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  }
  return semSaep;
}

/**
 * Fecha a coluna "Situação de Aprendizagem" de uma aba.
 *
 * Pela Metodologia SENAI, uma situação de aprendizagem agrupa várias capacidades
 * e corresponde a um bloco de aproximadamente 60 horas — e não a cada
 * conhecimento isolado. Como cada aba já é um bloco de 60 horas, a coluna é
 * mesclada de ponta a ponta e recebe uma referência única para o documento
 * elaborado na página "Situação de Aprendizagem" do Plano Generator.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Aba a fechar.
 * @param {number} coluna Índice da coluna Situação de Aprendizagem.
 * @param {number} primeiraLinha Primeira linha de dados (13).
 * @param {number} ultimaLinha Última linha de dados escrita nesta aba.
 * @param {number} numeroSituacao Número sequencial da situação de aprendizagem.
 */
function fecharColunaSituacao(sheet, coluna, primeiraLinha, ultimaLinha, numeroSituacao) {
  var totalLinhas = ultimaLinha - primeiraLinha + 1;
  if (totalLinhas < 1) return;

  var numeroFormatado = numeroSituacao < 10 ? '0' + numeroSituacao : String(numeroSituacao);
  var texto =
    'SITUAÇÃO DE APRENDIZAGEM ' + numeroFormatado + '\n\n' +
    'Elabore o documento completo desta situação de aprendizagem na página ' +
    '"Situação de Aprendizagem" do Plano Generator.';

  var intervalo = sheet.getRange(primeiraLinha, coluna, totalLinhas, 1);
  if (totalLinhas > 1) intervalo.merge();

  intervalo
    .setValue(texto)
    .setWrap(true)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setFontWeight('bold');
}

/**
 * Mescla as colunas de um tópico dentro de uma aba.
 * A coluna Situação de Aprendizagem é deliberadamente excluída: ela é mesclada
 * por página inteira em fecharColunaSituacao.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} linhaInicial Primeira linha do tópico nesta aba.
 * @param {number} totalLinhas Número de linhas ocupadas pelo tópico.
 * @param {boolean} semSaep Layout em uso.
 */
function mesclarColunasDoTopico(sheet, linhaInicial, totalLinhas, semSaep) {
  if (totalLinhas < 1) return;

  sheet.getRange(linhaInicial, 1, totalLinhas, 3).merge();

  if (semSaep) {
    sheet.getRange(linhaInicial, 4, totalLinhas, 3).merge();  // Como
    sheet.getRange(linhaInicial, 7, totalLinhas, 2).merge();  // Onde
    sheet.getRange(linhaInicial, 9, totalLinhas, 3).merge();  // Recursos
    sheet.getRange(linhaInicial, 13, totalLinhas, 3).merge(); // Critérios
    sheet.getRange(linhaInicial, 16, totalLinhas, 1).merge(); // Instrumentos
  } else {
    sheet.getRange(linhaInicial, 4, totalLinhas, 1).merge();  // SAEP
    sheet.getRange(linhaInicial, 5, totalLinhas, 3).merge();  // Como
    sheet.getRange(linhaInicial, 8, totalLinhas, 2).merge();  // Onde
    sheet.getRange(linhaInicial, 10, totalLinhas, 3).merge(); // Recursos
    sheet.getRange(linhaInicial, 14, totalLinhas, 3).merge(); // Critérios
    sheet.getRange(linhaInicial, 17, totalLinhas, 1).merge(); // Instrumentos
  }
}

/**
 * Cria a planilha de Planejamento Docente (comportamento original da aplicação).
 * @param {Object} dados Payload enviado pelo backend.
 * @returns {Object} Resposta com o URL da planilha criada.
 */
function criarPlanilhaPlanejamento(dados) {
  var spreadsheet = SpreadsheetApp.create(dados.nomeUC);
  spreadsheet.setSpreadsheetTimeZone('America/Sao_Paulo');

  var paginaIndex = 1;
  var sheetAtual = spreadsheet.getSheets()[0];
  sheetAtual.setName("Plano (Parte " + paginaIndex + ")");
  var semSaep = criarCabecalho(sheetAtual, dados);

  var totalCols = semSaep ? 19 : 20;
  var colComo = semSaep ? 4 : 5;
  var colOnde = semSaep ? 7 : 8;
  var colRecursos = semSaep ? 9 : 10;
  var colCarga = semSaep ? 12 : 13;
  var colCriterios = semSaep ? 13 : 14;
  var colInstrumentos = semSaep ? 16 : 17;
  var colSituacao = semSaep ? 17 : 18;
  var colQuandoInicio = semSaep ? 18 : 19;
  var colQuandoFim = semSaep ? 19 : 20;

  var PRIMEIRA_LINHA = 13;
  var currentRow = PRIMEIRA_LINHA;
  var horasNaPaginaAtual = 0;
  var diaDeAulaIndex = 0;

  var courseContent = dados.conteudoDetalhado;
  var diasDeAula = dados.diasDeAulaValidos || [];

  if (courseContent && courseContent.length > 0) {
    courseContent.forEach(function (topic) {
      var horasArray = String(topic.cargaHoraria).split(',').map(function (h) { return parseInt(h.trim(), 10) || 0; });

      var startRowForTopicOnThisPage = currentRow;
      var rowsForTopicOnThisPage = 0;
      var topicInfoWrittenOnThisPage = false;

      for (var i = 0; i < horasArray.length; i++) {
        var horasDoDia = horasArray[i];
        if (diaDeAulaIndex >= diasDeAula.length) break;

        if (horasNaPaginaAtual > 0 && (horasNaPaginaAtual + horasDoDia) > LIMITE_HORAS_POR_PAGINA) {
          // Fecha o tópico e a situação de aprendizagem da página que termina
          mesclarColunasDoTopico(sheetAtual, startRowForTopicOnThisPage, rowsForTopicOnThisPage, semSaep);
          fecharColunaSituacao(sheetAtual, colSituacao, PRIMEIRA_LINHA, currentRow - 1, paginaIndex);

          paginaIndex++;
          sheetAtual = spreadsheet.insertSheet("Plano (Parte " + paginaIndex + ")");
          semSaep = criarCabecalho(sheetAtual, dados);
          currentRow = PRIMEIRA_LINHA;
          horasNaPaginaAtual = 0;
          startRowForTopicOnThisPage = currentRow;
          rowsForTopicOnThisPage = 0;
          topicInfoWrittenOnThisPage = false;
        }

        if (!topicInfoWrittenOnThisPage) {
          sheetAtual.getRange(currentRow, 1).setValue(topic.oque);
          if (!semSaep) sheetAtual.getRange(currentRow, 4).setValue(topic.saep || "-");
          sheetAtual.getRange(currentRow, colComo).setValue(topic.como);
          sheetAtual.getRange(currentRow, colOnde).setValue(topic.onde);
          sheetAtual.getRange(currentRow, colRecursos).setValue(topic.recursos);
          sheetAtual.getRange(currentRow, colCriterios).setValue(topic.criterios);
          sheetAtual.getRange(currentRow, colInstrumentos).setValue(topic.instrumentos);
          topicInfoWrittenOnThisPage = true;
        }

        var dataCorreta = diasDeAula[diaDeAulaIndex];
        sheetAtual.getRange(currentRow, colCarga).setValue(horasDoDia);
        sheetAtual.getRange(currentRow, colQuandoInicio).setValue(dataCorreta);
        sheetAtual.getRange(currentRow, colQuandoFim).setValue(dataCorreta);

        var rangeDaLinhaIndividual = sheetAtual.getRange(currentRow, 1, 1, totalCols);
        rangeDaLinhaIndividual.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
        rangeDaLinhaIndividual.setVerticalAlignment("middle").setHorizontalAlignment("center").setWrap(true);
        sheetAtual.getRange(currentRow, 1, 1, 3).setHorizontalAlignment("left");

        horasNaPaginaAtual += horasDoDia;
        rowsForTopicOnThisPage++;
        currentRow++;
        diaDeAulaIndex++;
      }

      mesclarColunasDoTopico(sheetAtual, startRowForTopicOnThisPage, rowsForTopicOnThisPage, semSaep);
    });

    // Fecha a situação de aprendizagem da última página
    fecharColunaSituacao(sheetAtual, colSituacao, PRIMEIRA_LINHA, currentRow - 1, paginaIndex);
  }

  var file = DriveApp.getFileById(spreadsheet.getId());
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    spreadsheetUrl: spreadsheet.getUrl(),
    spreadsheetName: spreadsheet.getName(),
    totalSituacoesAprendizagem: paginaIndex
  };
}

// =========================================================================
//                    DOCUMENTOS EM GOOGLE DOCS
// =========================================================================

/**
 * Insere o logotipo institucional no topo do documento.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {string} imageUrl
 */
function inserirLogotipo(body, imageUrl) {
  if (!imageUrl || imageUrl.indexOf('http') !== 0) return;
  try {
    var blob = UrlFetchApp.fetch(imageUrl).getBlob();
    var imagem = body.insertImage(0, blob);
    imagem.setWidth(180);
    imagem.setHeight(78);
    imagem.getParent().asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  } catch (e) {
    Logger.log('Falha ao inserir logotipo no documento: ' + e);
  }
}

/**
 * Acrescenta um título de secção padronizado.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {string} texto
 */
function secao(body, texto) {
  var p = body.appendParagraph(texto.toUpperCase());
  p.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  p.setSpacingBefore(14).setSpacingAfter(4);
  p.editAsText().setBold(true).setForegroundColor('#1a4f8b').setFontSize(11);
}

/**
 * Acrescenta um parágrafo simples de corpo de texto.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {string} texto
 */
function paragrafo(body, texto) {
  if (!texto) return;
  String(texto).split(/\n{2,}/).forEach(function (bloco) {
    var p = body.appendParagraph(bloco.trim());
    p.setSpacingAfter(6);
    p.editAsText().setBold(false).setFontSize(10).setForegroundColor('#000000');
  });
}

/**
 * Acrescenta uma lista com marcadores.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {string[]} itens
 */
function lista(body, itens) {
  (itens || []).forEach(function (item) {
    if (!item) return;
    var li = body.appendListItem(String(item).trim());
    li.setGlyphType(DocumentApp.GlyphType.BULLET);
    li.editAsText().setBold(false).setFontSize(10).setForegroundColor('#000000');
  });
}

/**
 * Cria uma tabela formatada, com a primeira linha em destaque.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Array<Array<string>>} linhas Matriz de células (linha 0 é o cabeçalho).
 */
function tabela(body, linhas) {
  if (!linhas || linhas.length === 0) return;

  var t = body.appendTable(linhas);
  t.setBorderColor('#7f7f7f');

  for (var l = 0; l < t.getNumRows(); l++) {
    var linha = t.getRow(l);
    for (var c = 0; c < linha.getNumCells(); c++) {
      var celula = linha.getCell(c);
      celula.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(5).setPaddingRight(5);
      var texto = celula.editAsText();
      texto.setFontSize(9);
      if (l === 0) {
        texto.setBold(true);
        celula.setBackgroundColor('#dbe5f1');
      } else {
        texto.setBold(false);
      }
    }
  }
  body.appendParagraph('').setSpacingAfter(6);
}

/**
 * Monta a tabela de identificação comum aos dois documentos.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Array<Array<string>>} pares Pares [rótulo, valor].
 */
function tabelaIdentificacao(body, pares) {
  var t = body.appendTable(pares);
  t.setBorderColor('#7f7f7f');
  for (var l = 0; l < t.getNumRows(); l++) {
    var linha = t.getRow(l);
    linha.getCell(0).setBackgroundColor('#f0f0f0').setWidth(150);
    for (var c = 0; c < linha.getNumCells(); c++) {
      var celula = linha.getCell(c);
      celula.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(5).setPaddingRight(5);
      celula.editAsText().setFontSize(9).setBold(c === 0);
    }
  }
  body.appendParagraph('').setSpacingAfter(6);
}

/**
 * Cria o documento da Ficha de Observação.
 * @param {Object} conteudo Ficha preenchida enviada pelo navegador.
 * @param {string} imageUrl Logotipo institucional.
 * @returns {GoogleAppsScript.Document.Document}
 */
function criarDocumentoFicha(conteudo, titulo, imageUrl) {
  var doc = DocumentApp.create(titulo);
  var body = doc.getBody();
  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(36).setMarginRight(36);

  var ident = conteudo.identificacao || {};
  var bloco = conteudo.bloco || {};
  var aluno = conteudo.aluno || {};
  var gradual = conteudo.metodo === 'gradual';

  var cabecalho = body.appendParagraph('FICHA DE OBSERVAÇÃO');
  cabecalho.setHeading(DocumentApp.ParagraphHeading.TITLE);
  cabecalho.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var subtitulo = body.appendParagraph(
    'Instrumento de Avaliação da Aprendizagem — Metodologia SENAI de Educação Profissional'
  );
  subtitulo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  subtitulo.editAsText().setFontSize(9).setItalic(true).setForegroundColor('#666666');

  inserirLogotipo(body, imageUrl);

  secao(body, 'Identificação');
  tabelaIdentificacao(body, [
    ['Unidade Escolar', ident.unidadeEscolar || '—'],
    ['Curso', ident.curso || '—'],
    ['Unidade Curricular', ident.unidadeCurricular || '—'],
    ['Modalidade', ident.modalidade || '—'],
    ['Código da Turma', ident.codigoTurma || '—'],
    ['Instrutor', ident.instrutor || '—'],
    ['Aluno', aluno.nome || '—'],
    ['Data da observação', aluno.data || '—'],
    ['Avaliador', aluno.avaliador || ident.instrutor || '—']
  ]);

  secao(body, 'Atividade Observada');
  paragrafo(body, conteudo.titulo || bloco.conhecimento || '');
  paragrafo(body, conteudo.descricaoAtividade || '');

  tabelaIdentificacao(body, [
    ['Conhecimento', bloco.conhecimento || '—'],
    ['Carga horária', (bloco.cargaHoraria ? bloco.cargaHoraria + ' horas' : '—')],
    ['Período', bloco.periodo || '—'],
    ['Ambiente pedagógico', bloco.onde || '—'],
    ['Instrumento', (bloco.instrumentos || []).join(' / ') || 'Ficha de Observação'],
    ['Método dos critérios', gradual ? 'Gradual (rubricas de 1 a 4)' : 'Dicotómico (Escala de Cotejo)']
  ]);

  secao(body, 'Critérios de Avaliação');

  var linhas = [];
  if (gradual) {
    linhas.push(['Capacidade', 'Critério de Avaliação', 'Rubricas (1 a 4)', 'Autoav.', 'Aval.']);
  } else {
    linhas.push(['Capacidade', 'Critério de Avaliação', 'Autoav.', 'Aval.']);
  }

  (conteudo.itens || []).forEach(function (item) {
    (item.criterios || []).forEach(function (criterio, indice) {
      var capacidade = indice === 0 ? (item.capacidade || '') : '';
      if (gradual) {
        var rubricas = (criterio.rubricas || []).map(function (r) {
          return r.nivel + ' — ' + r.descricao;
        }).join('\n');
        linhas.push([
          capacidade,
          criterio.texto || '',
          rubricas,
          criterio.autoavaliacao ? String(criterio.autoavaliacao) : '',
          criterio.avaliacao ? String(criterio.avaliacao) : ''
        ]);
      } else {
        linhas.push([
          capacidade,
          criterio.texto || '',
          criterio.autoavaliacao || '',
          criterio.avaliacao || ''
        ]);
      }
    });
  });

  tabela(body, linhas);

  var legenda = body.appendParagraph(
    gradual
      ? 'Legenda: 1 = Não atingiu | 2 = Atingiu parcialmente | 3 = Atingiu o esperado | 4 = Superou o esperado'
      : 'Legenda: S = Atingiu | N = Não atingiu'
  );
  legenda.editAsText().setFontSize(9).setItalic(true);

  var resultado = conteudo.resultado || {};
  if (resultado.total) {
    secao(body, 'Resultado da Observação');
    tabelaIdentificacao(body, [
      ['Critérios atingidos', (resultado.atingidos || 0) + ' de ' + resultado.total],
      ['Aproveitamento', (resultado.percentual || 0) + '%'],
      ['Conceito', resultado.conceito || '—'],
      ['Descrição do conceito', resultado.conceitoDescricao || '—']
    ]);
  }

  secao(body, 'Observações e Feedback ao Aluno');
  paragrafo(body, conteudo.observacoes || '');
  body.appendParagraph('');
  body.appendParagraph('');

  var assinatura = body.appendParagraph('____________________________________');
  assinatura.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  assinatura.setSpacingBefore(24).setSpacingAfter(0);
  assinatura.editAsText().setFontSize(9).setBold(false);

  var rotuloAssinatura = body.appendParagraph('Assinatura do Instrutor');
  rotuloAssinatura.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  rotuloAssinatura.editAsText().setFontSize(9).setBold(false);

  doc.saveAndClose();
  return doc;
}

/**
 * Cria o documento da Situação de Aprendizagem.
 * @param {Object} conteudo Situação elaborada.
 * @param {string} titulo Nome do ficheiro.
 * @param {string} imageUrl Logotipo institucional.
 * @returns {GoogleAppsScript.Document.Document}
 */
function criarDocumentoSituacao(conteudo, titulo, imageUrl) {
  var doc = DocumentApp.create(titulo);
  var body = doc.getBody();
  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(36).setMarginRight(36);

  var ident = conteudo.identificacao || {};

  var cabecalho = body.appendParagraph('PLANEJAMENTO DA SITUAÇÃO DE APRENDIZAGEM');
  cabecalho.setHeading(DocumentApp.ParagraphHeading.TITLE);
  cabecalho.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var subtitulo = body.appendParagraph('Metodologia SENAI de Educação Profissional');
  subtitulo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  subtitulo.editAsText().setFontSize(9).setItalic(true).setForegroundColor('#666666');

  inserirLogotipo(body, imageUrl);

  secao(body, 'Identificação');
  tabelaIdentificacao(body, [
    ['Unidade Escolar', ident.unidadeEscolar || '—'],
    ['Curso', ident.curso || '—'],
    ['Unidade Curricular', ident.unidadeCurricular || '—'],
    ['Modalidade', ident.modalidade || '—'],
    ['Carga horária da UC', ident.cargaHorariaTotal || '—'],
    ['Código da Turma', ident.codigoTurma || '—'],
    ['Instrutor', ident.instrutor || '—'],
    ['Situação de Aprendizagem', conteudo.numero + ' de ' + conteudo.totalSituacoes],
    ['Carga horária da situação', (conteudo.cargaHoraria || 0) + ' horas'],
    ['Número de aulas', String(conteudo.numeroAulas || '—')],
    ['Período', conteudo.periodo || '—']
  ]);

  secao(body, 'Título da Situação de Aprendizagem');
  paragrafo(body, conteudo.titulo || '');

  secao(body, 'Estratégia de Aprendizagem Desafiadora');
  var escolhida = (conteudo.estrategiaDesafiadora || {}).nome || '';
  var opcoes = ['Situação-Problema', 'Estudo de Caso', 'Projeto', 'Pesquisa Aplicada'];
  var marcadas = opcoes.map(function (opcao) {
    return (opcao === escolhida ? '( X ) ' : '(    ) ') + opcao;
  }).join('        ');
  paragrafo(body, marcadas);

  secao(body, 'Capacidades a Serem Desenvolvidas');
  lista(body, conteudo.capacidades);

  secao(body, 'Conhecimentos Relacionados');
  lista(body, conteudo.conhecimentos);

  secao(body, 'Contextualização');
  paragrafo(body, conteudo.contextualizacao || '');

  secao(body, 'Desafio');
  paragrafo(body, conteudo.desafio || '');

  secao(body, 'Resultados Esperados');
  lista(body, conteudo.resultadosEsperados);

  secao(body, 'Estratégias de Ensino e Descrição da Atividade');
  lista(body, conteudo.estrategiasEnsino);

  secao(body, 'Recursos Didáticos e Ambientes Pedagógicos');
  lista(body, (conteudo.recursosDidaticos || []).concat(conteudo.ambientesPedagogicos || []));

  secao(body, 'Critérios de Avaliação');
  lista(body, conteudo.criteriosAvaliacao);

  secao(body, 'Instrumentos de Avaliação da Aprendizagem');
  lista(body, conteudo.instrumentosAvaliacao);

  if (conteudo.etapas && conteudo.etapas.length > 0) {
    secao(body, 'Consolidação do Plano de Aula');
    var linhas = [['Etapa', 'Carga Horária', 'Descrição']];
    conteudo.etapas.forEach(function (e) {
      linhas.push([e.etapa || '', (e.cargaHoraria || 0) + 'h', e.descricao || '']);
    });
    tabela(body, linhas);
  }

  body.appendParagraph('');
  var validacao = body.appendParagraph(
    'Validação: este planejamento deve ser validado pelas Coordenações Técnica e Pedagógica ' +
    '(MSEP 2019, Etapa 3 — Validação do Plano de Ensino da Unidade Curricular).'
  );
  validacao.editAsText().setFontSize(9).setItalic(true).setForegroundColor('#666666');

  doc.saveAndClose();
  return doc;
}



/**
 * Cria um Google Docs a partir do conteúdo recebido e devolve o seu id.
 * O documento fica partilhado apenas para leitura; o backend monta o link
 * ".../copy" para que o professor faça uma cópia editável na sua própria conta.
 *
 * @param {Object} dados Payload com acao, titulo e conteudo.
 * @returns {Object} Resposta com documentId.
 */
function criarDocumento(dados) {
  var titulo = dados.titulo || 'Documento Plano Generator';
  var conteudo = dados.conteudo || {};

  var doc = dados.acao === 'ficha'
    ? criarDocumentoFicha(conteudo, titulo, dados.imageUrl)
    : criarDocumentoSituacao(conteudo, titulo, dados.imageUrl);

  var file = DriveApp.getFileById(doc.getId());
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    documentId: doc.getId(),
    documentName: doc.getName(),
    documentUrl: doc.getUrl()
  };
}

// =========================================================================
//                              ROTEAMENTO
// =========================================================================

/**
 * Ponto de entrada do Web App.
 * A ação padrão (sem o campo "acao") mantém o comportamento original de gerar
 * a planilha de planejamento docente.
 * @param {Object} e Evento HTTP do Apps Script.
 */
function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);

    var resposta;
    if (dados.acao === 'ficha' || dados.acao === 'situacao') {
      resposta = criarDocumento(dados);
    } else {
      resposta = criarPlanilhaPlanejamento(dados);
    }

    return ContentService.createTextOutput(JSON.stringify(resposta))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("ERRO no Apps Script: " + error.toString() + " Stack: " + error.stack);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
