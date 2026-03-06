// =========================================================================
//            VERSÃO FINAL COM DIVISÃO DE TÓPICOS ENTRE PÁGINAS
// =========================================================================

// Modalidades que NÃO exibem a coluna "Identificação - MATRIZ DE REFERÊNCIA SAEP"
var MODALIDADES_SEM_SAEP = ['APRENDIZAGEM', 'QUALIFICAÇÃO', 'APERFEIÇOAMENTO', 'CURSOS LIVRES'];

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
  sheet.getRange("C5:H5").merge().setValue("Palmas - Centro de Educação e Tecnologia - CETEC");
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

function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);
    var spreadsheet = SpreadsheetApp.create("Plano de Curso - " + dados.nomeCurso);
    spreadsheet.setSpreadsheetTimeZone('America/Sao_Paulo');

    var limiteHorasPorPagina = 60;

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

    var currentRow = 13;
    var horasNaPaginaAtual = 0;
    var diaDeAulaIndex = 0;

    var courseContent = dados.conteudoDetalhado;
    var diasDeAula = dados.diasDeAulaValidos || [];

    if (courseContent && courseContent.length > 0) {
      courseContent.forEach(function (topic) {
        var horasArray = topic.cargaHoraria.split(',').map(function (h) { return parseInt(h.trim(), 10) || 0; });

        var startRowForTopicOnThisPage = currentRow;
        var rowsForTopicOnThisPage = 0;
        var topicInfoWrittenOnThisPage = false;

        for (var i = 0; i < horasArray.length; i++) {
          var horasDoDia = horasArray[i];
          if (diaDeAulaIndex >= diasDeAula.length) break;

          if (horasNaPaginaAtual > 0 && (horasNaPaginaAtual + horasDoDia) > limiteHorasPorPagina) {
            if (rowsForTopicOnThisPage > 0) {
              sheetAtual.getRange(startRowForTopicOnThisPage, 1, rowsForTopicOnThisPage, 3).merge();
              if (semSaep) {
                sheetAtual.getRange(startRowForTopicOnThisPage, 4, rowsForTopicOnThisPage, 3).merge();
                sheetAtual.getRange(startRowForTopicOnThisPage, 7, rowsForTopicOnThisPage, 2).merge();
                sheetAtual.getRange(startRowForTopicOnThisPage, 9, rowsForTopicOnThisPage, 3).merge();
                sheetAtual.getRange(startRowForTopicOnThisPage, 13, rowsForTopicOnThisPage, 3).merge();
                sheetAtual.getRange(startRowForTopicOnThisPage, 16, rowsForTopicOnThisPage, 1).merge();
                sheetAtual.getRange(startRowForTopicOnThisPage, 17, rowsForTopicOnThisPage, 1).merge();
              } else {
                sheetAtual.getRange(startRowForTopicOnThisPage, 4, rowsForTopicOnThisPage, 1).merge();
                sheetAtual.getRange(startRowForTopicOnThisPage, 5, rowsForTopicOnThisPage, 3).merge();
                sheetAtual.getRange(startRowForTopicOnThisPage, 8, rowsForTopicOnThisPage, 2).merge();
                sheetAtual.getRange(startRowForTopicOnThisPage, 10, rowsForTopicOnThisPage, 3).merge();
                sheetAtual.getRange(startRowForTopicOnThisPage, 14, rowsForTopicOnThisPage, 3).merge();
                sheetAtual.getRange(startRowForTopicOnThisPage, 17, rowsForTopicOnThisPage, 1).merge();
                sheetAtual.getRange(startRowForTopicOnThisPage, 18, rowsForTopicOnThisPage, 1).merge();
              }
            }
            paginaIndex++;
            sheetAtual = spreadsheet.insertSheet("Plano (Parte " + paginaIndex + ")");
            semSaep = criarCabecalho(sheetAtual, dados);
            currentRow = 13;
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
            sheetAtual.getRange(currentRow, colSituacao).setValue(topic.situacaoAprendizagem);
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

        if (rowsForTopicOnThisPage > 0) {
          sheetAtual.getRange(startRowForTopicOnThisPage, 1, rowsForTopicOnThisPage, 3).merge();
          if (semSaep) {
            sheetAtual.getRange(startRowForTopicOnThisPage, 4, rowsForTopicOnThisPage, 3).merge();
            sheetAtual.getRange(startRowForTopicOnThisPage, 7, rowsForTopicOnThisPage, 2).merge();
            sheetAtual.getRange(startRowForTopicOnThisPage, 9, rowsForTopicOnThisPage, 3).merge();
            sheetAtual.getRange(startRowForTopicOnThisPage, 13, rowsForTopicOnThisPage, 3).merge();
            sheetAtual.getRange(startRowForTopicOnThisPage, 16, rowsForTopicOnThisPage, 1).merge();
            sheetAtual.getRange(startRowForTopicOnThisPage, 17, rowsForTopicOnThisPage, 1).merge();
          } else {
            sheetAtual.getRange(startRowForTopicOnThisPage, 4, rowsForTopicOnThisPage, 1).merge();
            sheetAtual.getRange(startRowForTopicOnThisPage, 5, rowsForTopicOnThisPage, 3).merge();
            sheetAtual.getRange(startRowForTopicOnThisPage, 8, rowsForTopicOnThisPage, 2).merge();
            sheetAtual.getRange(startRowForTopicOnThisPage, 10, rowsForTopicOnThisPage, 3).merge();
            sheetAtual.getRange(startRowForTopicOnThisPage, 14, rowsForTopicOnThisPage, 3).merge();
            sheetAtual.getRange(startRowForTopicOnThisPage, 17, rowsForTopicOnThisPage, 1).merge();
            sheetAtual.getRange(startRowForTopicOnThisPage, 18, rowsForTopicOnThisPage, 1).merge();
          }
        }
      });
    }

    // --- Bloco de Partilha e Resposta ---
    var file = DriveApp.getFileById(spreadsheet.getId());
    // Apenas visualização para quem tiver o link (mais seguro que edição)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      spreadsheetUrl: spreadsheet.getUrl(),
      spreadsheetName: spreadsheet.getName()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("ERRO no Apps Script: " + error.toString() + " Stack: " + error.stack);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

