// =========================================================================
// ✨ VERSÃO FINAL COM DIVISÃO DE TÓPICOS ENTRE PÁGINAS (LÓGICA CORRIGIDA) ✨
// =========================================================================

/**
 * Função reutilizável para criar o cabeçalho e a estrutura da tabela numa página.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet A página (aba) onde o cabeçalho será criado.
 * @param {Object} dados Os dados recebidos do servidor.
 */
function criarCabecalho(sheet, dados) {
  sheet.setHiddenGridlines(true);

  if (dados.imageUrl && dados.imageUrl.startsWith("http")) {
    try {
      var imagem = sheet.insertImage(dados.imageUrl, 2, 1);
      imagem.setWidth(300).setHeight(130);
    } catch (e) { Logger.log("Falha ao inserir imagem: " + e); }
  }

  // Título Principal
  sheet.getRange("A2").setValue("PLANEJAMENTO DOCENTE");
  sheet.getRange("A2:T2").merge().setHorizontalAlignment("center").setVerticalAlignment("middle").setFontWeight("bold").setFontSize(35);

  // Bloco de Informações do Curso
  sheet.getRange("B5").setValue("Unidade Escolar:");
  sheet.getRange("C5:H5").merge().setValue("Palmas - Centro de Educação e Tecnologia - CETEC");
  sheet.getRange("J5:K5").merge().setValue("Início e Fim:");
  sheet.getRange("L5:T5").merge().setValue(dados.dataInicioCurso + " - " + dados.dataFimCurso);
  sheet.getRange("B6").setValue("Curso:");
  sheet.getRange("C6:H6").merge().setValue(dados.nomeCurso);
  sheet.getRange("J6:K6").merge().setValue("Modalidade:");
  sheet.getRange("L6:T6").merge().setValue(dados.modalidade || "N/A");

  sheet.getRange("B7").setValue("Código da Turma:");
  sheet.getRange("C7:H7").merge().setValue(dados.codigoTurma || "N/A"); // Usa o dado do formulário

  sheet.getRange("J7:K7").merge().setValue("Carga Horária da U.C:");
  sheet.getRange("L7:T7").merge().setValue(dados.cargaHorariaTotal).setHorizontalAlignment("left");
  sheet.getRange("B8").setValue("Unidade Curricular:");
  sheet.getRange("C8:H8").merge().setValue(dados.nomeUC);
  sheet.getRange("J8:K8").merge().setValue("Instrutor:");
  sheet.getRange("L8:T8").merge().setValue(dados.instrutor || "N/A");

  // Formatação do Bloco de Informações
  sheet.getRange("A5:B8").setFontWeight("bold");
  sheet.getRange("J5:K8").setFontWeight("bold");
  sheet.getRange("C5:H8").setBackground("#dbe5f1");
  sheet.getRange("L5:T8").setBackground("#dbe5f1");
  sheet.getRange("B5:T8").setVerticalAlignment("middle");
  sheet.setRowHeights(5, 4, 30);
  for (var i = 5; i <= 8; i++) {
    sheet.getRange(i, 3, 1, 6).setBorder(true, false, true, false, false, false, '#1a73e8', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.getRange(i, 12, 1, 9).setBorder(true, false, true, false, false, false, '#1a73e8', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }

  // Bloco da Tabela de Conteúdo
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

  // Borda externa geral
  sheet.getRange("A10:T12").setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
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
    criarCabecalho(sheetAtual, dados);

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

        // Itera por CADA DIA de aula do tópico
        for (var i = 0; i < horasArray.length; i++) {
          var horasDoDia = horasArray[i];
          if (diaDeAulaIndex >= diasDeAula.length) break;

          // **A NOVA LÓGICA DE DIVISÃO**
          // Se este dia de aula for estourar o limite, cria uma nova página ANTES de o escrever.
          if (horasNaPaginaAtual > 0 && (horasNaPaginaAtual + horasDoDia) > limiteHorasPorPagina) {
            // 1. Mescla a parte do tópico que ficou na página anterior
            if (rowsForTopicOnThisPage > 0) {
              sheetAtual.getRange(startRowForTopicOnThisPage, 1, rowsForTopicOnThisPage, 3).merge();
              sheetAtual.getRange(startRowForTopicOnThisPage, 4, rowsForTopicOnThisPage, 1).merge();
              sheetAtual.getRange(startRowForTopicOnThisPage, 5, rowsForTopicOnThisPage, 3).merge();
              sheetAtual.getRange(startRowForTopicOnThisPage, 8, rowsForTopicOnThisPage, 2).merge();
              sheetAtual.getRange(startRowForTopicOnThisPage, 10, rowsForTopicOnThisPage, 3).merge();
              sheetAtual.getRange(startRowForTopicOnThisPage, 14, rowsForTopicOnThisPage, 3).merge();
              sheetAtual.getRange(startRowForTopicOnThisPage, 17, rowsForTopicOnThisPage, 1).merge();
              sheetAtual.getRange(startRowForTopicOnThisPage, 18, rowsForTopicOnThisPage, 1).merge();
            }

            // 2. Cria a nova página e o novo cabeçalho
            paginaIndex++;
            sheetAtual = spreadsheet.insertSheet("Plano (Parte " + paginaIndex + ")");
            criarCabecalho(sheetAtual, dados);
            currentRow = 13;
            horasNaPaginaAtual = 0;

            // 3. Reinicia os contadores para a nova página
            startRowForTopicOnThisPage = currentRow;
            rowsForTopicOnThisPage = 0;
            topicInfoWrittenOnThisPage = false;
          }

          // Escreve as informações principais do tópico (O que?, Como?, etc.)
          // apenas uma vez por página para cada segmento do tópico.
          if (!topicInfoWrittenOnThisPage) {
            sheetAtual.getRange(currentRow, 1).setValue(topic.oque);
            sheetAtual.getRange(currentRow, 4).setValue(topic.saep || "-");
            sheetAtual.getRange(currentRow, 5).setValue(topic.como);
            sheetAtual.getRange(currentRow, 8).setValue(topic.onde);
            sheetAtual.getRange(currentRow, 10).setValue(topic.recursos);
            sheetAtual.getRange(currentRow, 14).setValue(topic.criterios);
            sheetAtual.getRange(currentRow, 17).setValue(topic.instrumentos);
            sheetAtual.getRange(currentRow, 18).setValue(topic.situacaoAprendizagem);
            topicInfoWrittenOnThisPage = true;
          }

          // Escreve os dados do dia de aula
          var dataCorreta = diasDeAula[diaDeAulaIndex];
          sheetAtual.getRange(currentRow, 13).setValue(horasDoDia);
          sheetAtual.getRange(currentRow, 19).setValue(dataCorreta);
          sheetAtual.getRange(currentRow, 20).setValue(dataCorreta);

          // Formata a linha individualmente antes da mesclagem
          var rangeDaLinhaIndividual = sheetAtual.getRange(currentRow, 1, 1, 20);
          rangeDaLinhaIndividual.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
          rangeDaLinhaIndividual.setVerticalAlignment("middle").setHorizontalAlignment("center").setWrap(true);
          sheetAtual.getRange(currentRow, 1, 1, 3).setHorizontalAlignment("left");

          // Atualiza os contadores
          horasNaPaginaAtual += horasDoDia;
          rowsForTopicOnThisPage++;
          currentRow++;
          diaDeAulaIndex++;
        }

        // Mescla a parte final do tópico na última página em que ele apareceu
        if (rowsForTopicOnThisPage > 0) {
          sheetAtual.getRange(startRowForTopicOnThisPage, 1, rowsForTopicOnThisPage, 3).merge();
          sheetAtual.getRange(startRowForTopicOnThisPage, 4, rowsForTopicOnThisPage, 1).merge();
          sheetAtual.getRange(startRowForTopicOnThisPage, 5, rowsForTopicOnThisPage, 3).merge();
          sheetAtual.getRange(startRowForTopicOnThisPage, 8, rowsForTopicOnThisPage, 2).merge();
          sheetAtual.getRange(startRowForTopicOnThisPage, 10, rowsForTopicOnThisPage, 3).merge();
          sheetAtual.getRange(startRowForTopicOnThisPage, 14, rowsForTopicOnThisPage, 3).merge();
          sheetAtual.getRange(startRowForTopicOnThisPage, 17, rowsForTopicOnThisPage, 1).merge();
          sheetAtual.getRange(startRowForTopicOnThisPage, 18, rowsForTopicOnThisPage, 1).merge();
        }
      });
    }

    // --- Bloco de Partilha e Resposta ---
    var file = DriveApp.getFileById(spreadsheet.getId());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);

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