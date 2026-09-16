const fs = require('fs');
const path = require('path');
const { lerPacote, escreverPacote, substituirParte } = require('./zip');

// ---------------------------------------------------------------------------
// Geração do Plano de Ensino no formulário FO-178 (revisão 05)
// ---------------------------------------------------------------------------
// O ficheiro é montado a partir do próprio formulário oficial, guardado em
// assets/templates/FO-178.docx. Todas as partes do pacote são reaproveitadas
// tal como estão — estilos, fontes, numeração, tema e, sobretudo, o cabeçalho
// de documento controlado (ID, revisão, data, paginação) com o logotipo SENAI.
// Apenas "word/document.xml" é reescrito.
//
// Do document.xml original aproveitamos ainda duas peças, em vez de as fixar
// no código: a declaração de espaços de nomes (o elemento <w:document>) e o
// <w:sectPr> final, que define A4 paisagem, margens e as referências ao
// cabeçalho e rodapé. Assim, se o SENAI publicar uma revisão nova do
// formulário, basta substituir o .docx do template.
// ---------------------------------------------------------------------------

const CAMINHO_TEMPLATE = path.resolve(__dirname, '../../../assets/templates/FO-178.docx');

// ---------------------------------------------------------------------------
// Geometria das tabelas, medida no formulário original
// ---------------------------------------------------------------------------
// Cada tabela do FO-178 tem a sua própria grelha, largura e recuo — não há uma
// largura única. Reproduzi-las é o que mantém as colunas alinhadas de tabela
// para tabela, como no formulário impresso.
const TABELA_IDENTIFICACAO = { grelha: [2127, 8618, 1984, 2960], largura: 15689 };
const TABELA_PERFIL = { grelha: [2127, 13578], largura: 15705 };
const TABELA_ESTRATEGIAS = { grelha: [3933, 3934, 3934, 3934], largura: 15735 };
const TABELA_DESCRICAO = { grelha: [2552, 13183], largura: 15735 };
const TABELA_AULAS = {
  grelha: [708, 705, 3509, 2814, 2134, 1974, 1483, 2403],
  largura: 15730,
};
// As quatro tabelas de bloco do rodapé (Nota, Avaliação, Referências, Parecer)
// são mais largas que as restantes e recuam mais à esquerda.
const TABELA_BLOCO = { grelha: [15877], largura: 15877, recuo: -147 };

/** Recuo à esquerda usado por todas as tabelas exceto as de bloco. */
const RECUO_PADRAO = -5;

/** Cinzento das células de cabeçalho no formulário original. */
const FUNDO_CABECALHO = 'D9D9D9';

/**
 * As quatro estratégias de aprendizagem desafiadoras do formulário, na ordem
 * exata em que aparecem impressas. Os identificadores são os mesmos usados em
 * services/situacaoGenerator.js, para que a escolha do docente atravesse o
 * sistema sem tradução.
 */
const ESTRATEGIAS_FO178 = [
  { id: 'estudo-de-caso', rotulo: 'Estudo de caso' },
  { id: 'projeto', rotulo: 'Projeto (elaboração ou execução)' },
  { id: 'situacao-problema', rotulo: 'Situação-Problema' },
  { id: 'pesquisa-aplicada', rotulo: 'Pesquisa Aplicada' },
];

/**
 * Escapa texto para inserção em XML.
 * @param {*} texto
 * @returns {string}
 */
function esc(texto) {
  return String(texto === undefined || texto === null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converte texto em <w:r>, preservando quebras de linha como <w:br/>.
 *
 * O Word não interpreta "\n" dentro de <w:t>: sem esta conversão, todas as
 * capacidades e recursos de uma célula sairiam colados numa única linha.
 *
 * @param {string} texto
 * @param {{ negrito?: boolean, italico?: boolean, tamanho?: number }} [opcoes]
 * @returns {string} XML dos runs.
 */
function runs(texto, opcoes) {
  const o = opcoes || {};
  const propriedades =
    '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>' +
    (o.negrito ? '<w:b/><w:bCs/>' : '') +
    (o.italico ? '<w:i/><w:iCs/>' : '') +
    (o.tamanho ? `<w:sz w:val="${o.tamanho}"/><w:szCs w:val="${o.tamanho}"/>` : '') +
    '</w:rPr>';

  const linhas = String(texto === undefined || texto === null ? '' : texto).split('\n');

  return linhas
    .map((linha, indice) => {
      const quebra = indice > 0 ? '<w:br/>' : '';
      return `<w:r>${propriedades}${quebra}<w:t xml:space="preserve">${esc(linha)}</w:t></w:r>`;
    })
    .join('');
}

/**
 * Monta um parágrafo.
 * @param {string} texto
 * @param {{ negrito?: boolean, italico?: boolean, tamanho?: number, alinhamento?: string }} [opcoes]
 * @returns {string} XML do parágrafo.
 */
function paragrafo(texto, opcoes) {
  const o = opcoes || {};
  const alinhamento = o.alinhamento ? `<w:jc w:val="${o.alinhamento}"/>` : '';
  // A ordem dos elementos de <w:pPr> é imposta pelo esquema OOXML: keepNext
  // vem antes de spacing, e jc depois. Trocá-los faz o Word recusar o ficheiro.
  const manter = o.manterComProxima ? '<w:keepNext/>' : '';
  const propriedades =
    '<w:pPr>' +
    manter +
    '<w:spacing w:before="40" w:after="40"/>' +
    alinhamento +
    '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>' +
    (o.negrito ? '<w:b/><w:bCs/>' : '') +
    (o.italico ? '<w:i/><w:iCs/>' : '') +
    (o.tamanho ? `<w:sz w:val="${o.tamanho}"/><w:szCs w:val="${o.tamanho}"/>` : '') +
    '</w:rPr></w:pPr>';

  return `<w:p>${propriedades}${runs(texto, o)}</w:p>`;
}

/**
 * Monta uma célula de tabela.
 * @param {string} conteudoXml Parágrafos já montados.
 * @param {{ largura: number, colunas?: number, fundo?: string }} opcoes
 * @returns {string} XML da célula.
 */
function celula(conteudoXml, opcoes) {
  const o = opcoes || {};
  const span = o.colunas && o.colunas > 1 ? `<w:gridSpan w:val="${o.colunas}"/>` : '';

  // Mesclagem vertical: "inicio" abre o grupo e recebe o texto, "continua"
  // prolonga-o pelas linhas seguintes. É assim que os rótulos da tabela de
  // descrição ficam centrados ao longo das duas linhas da secção.
  let merge = '';
  if (o.vMerge === 'inicio') merge = '<w:vMerge w:val="restart"/>';
  else if (o.vMerge === 'continua') merge = '<w:vMerge/>';

  const fundo = o.fundo
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fundo}"/>`
    : '';

  // Ordem imposta pelo esquema OOXML: tcW, gridSpan, vMerge, shd, vAlign.
  return (
    '<w:tc><w:tcPr>' +
    `<w:tcW w:w="${o.largura}" w:type="dxa"/>` +
    span +
    merge +
    fundo +
    '<w:vAlign w:val="center"/>' +
    '</w:tcPr>' +
    (conteudoXml || paragrafo('')) +
    '</w:tc>'
  );
}

/**
 * Monta uma linha de tabela.
 * @param {string} celulasXml
 * @param {{ cabecalho?: boolean }} [opcoes] Repete a linha no topo de cada página.
 * @returns {string} XML da linha.
 */
function linha(celulasXml, opcoes) {
  const o = opcoes || {};
  // Ordem imposta pelo esquema OOXML: cantSplit antes de tblHeader.
  const propriedades =
    (o.naoPartir ? '<w:cantSplit/>' : '') + (o.cabecalho ? '<w:tblHeader/>' : '');

  return `<w:tr>${propriedades ? `<w:trPr>${propriedades}</w:trPr>` : ''}${celulasXml}</w:tr>`;
}

/**
 * Monta uma tabela com o estilo de grelha do formulário.
 * @param {number[]} grelha Larguras das colunas (twips).
 * @param {string} linhasXml
 * @param {{ largura?: number, centrada?: boolean }} [opcoes]
 * @returns {string} XML da tabela.
 */
function tabela(grelha, linhasXml, opcoes) {
  const o = opcoes || {};
  const largura = o.largura || grelha.reduce((total, c) => total + c, 0);
  const recuo = o.recuo === undefined ? RECUO_PADRAO : o.recuo;
  const alinhamento = o.centrada
    ? '<w:jc w:val="center"/>'
    : `<w:tblInd w:w="${recuo}" w:type="dxa"/>`;

  return (
    '<w:tbl><w:tblPr>' +
    '<w:tblStyle w:val="TableGrid"/>' +
    `<w:tblW w:w="${largura}" w:type="dxa"/>` +
    alinhamento +
    '<w:tblLayout w:type="fixed"/>' +
    '<w:tblLook w:val="04A0"/>' +
    '</w:tblPr><w:tblGrid>' +
    grelha.map((c) => `<w:gridCol w:w="${c}"/>`).join('') +
    '</w:tblGrid>' +
    linhasXml +
    '</w:tbl>'
  );
}

/** Parágrafo vazio usado para separar tabelas consecutivas. */
function espacador() {
  return '<w:p><w:pPr><w:spacing w:after="0"/><w:rPr><w:sz w:val="12"/></w:rPr></w:pPr></w:p>';
}

/**
 * Linha de "rótulo | valor" nas tabelas de bloco.
 * @param {string} rotulo
 * @param {string} valor
 * @returns {string}
 */
function linhaRotuloValor(rotulo, valor, grelha) {
  const [larguraRotulo, larguraValor] = grelha;

  return linha(
    celula(paragrafo(rotulo, { negrito: true, tamanho: 20 }), {
      largura: larguraRotulo,
      fundo: FUNDO_CABECALHO,
    }) + celula(paragrafo(valor, { tamanho: 20 }), { largura: larguraValor })
  );
}

/**
 * Faixa de título que ocupa a largura toda da tabela.
 *
 * O gridSpan é obrigatório: uma linha com menos células do que as colunas da
 * grelha faz o Word ignorar as larguras declaradas e redistribuir as colunas de
 * toda a tabela — era o que desalinhava os rótulos do perfil profissional.
 *
 * O keepNext impede que a faixa fique órfã no fim de uma página, com o conteúdo
 * a começar só na página seguinte.
 *
 * @param {string} texto
 * @param {{ grelha: number[], largura: number }} tabelaAlvo
 * @returns {string}
 */
function faixaTitulo(texto, tabelaAlvo) {
  return linha(
    celula(
      paragrafo(texto, {
        negrito: true,
        tamanho: 20,
        alinhamento: 'center',
        manterComProxima: true,
      }),
      {
        largura: tabelaAlvo.largura,
        colunas: tabelaAlvo.grelha.length,
        fundo: FUNDO_CABECALHO,
      }
    )
  );
}

/**
 * Bloco de identificação (tabela 1 do formulário).
 *
 * São três linhas, não quatro: no formulário original o Docente/Instrutor e a
 * Carga Horária partilham a última linha, e as duas primeiras linhas têm o
 * valor a atravessar as três colunas restantes.
 *
 * @param {object} identificacao
 * @returns {string}
 */
function tabelaIdentificacao(identificacao) {
  const i = identificacao || {};
  const { grelha, largura } = TABELA_IDENTIFICACAO;
  const [colRotulo, colDocente, colRotuloCarga, colCarga] = grelha;
  const larguraValorLargo = largura - colRotulo;

  const linhaLarga = (rotulo, valor) =>
    linha(
      celula(paragrafo(rotulo, { negrito: true, tamanho: 20 }), {
        largura: colRotulo,
        fundo: FUNDO_CABECALHO,
      }) +
        celula(paragrafo(valor, { tamanho: 20 }), {
          largura: larguraValorLargo,
          colunas: 3,
        })
    );

  return tabela(
    grelha,
    linhaLarga('Curso:', i.curso) +
      linhaLarga('Unidade Curricular:', i.unidadeCurricular) +
      linha(
        celula(paragrafo('Docente/Instrutor:', { negrito: true, tamanho: 20 }), {
          largura: colRotulo,
          fundo: FUNDO_CABECALHO,
        }) +
          celula(paragrafo(i.docente, { tamanho: 20 }), { largura: colDocente }) +
          celula(
            paragrafo('Carga Horária da Unidade Curricular:', {
              negrito: true,
              tamanho: 20,
            }),
            { largura: colRotuloCarga, fundo: FUNDO_CABECALHO }
          ) +
          celula(paragrafo(i.cargaHoraria, { tamanho: 20 }), { largura: colCarga })
      ),
    { largura }
  );
}

/**
 * Bloco do perfil profissional (tabela 2 do formulário).
 * @param {object} perfil
 * @returns {string}
 */
function tabelaPerfil(perfil) {
  const p = perfil || {};
  const { grelha, largura } = TABELA_PERFIL;

  return tabela(
    grelha,
    faixaTitulo('PERFIL PROFISSIONAL', TABELA_PERFIL) +
      linhaRotuloValor('Função:', p.funcao, grelha) +
      linhaRotuloValor('Subfunção:', p.subfuncao, grelha) +
      linhaRotuloValor('Objetivo Geral da Unidade Curricular:', p.objetivoGeral, grelha),
    { largura }
  );
}

/**
 * Bloco das estratégias desafiadoras (tabela 3), com "X" na escolhida.
 * @param {string} estrategiaId Identificador da estratégia selecionada.
 * @returns {string}
 */
function tabelaEstrategias(estrategiaId) {
  const { grelha, largura } = TABELA_ESTRATEGIAS;

  const opcoes = ESTRATEGIAS_FO178.map((estrategia, indice) =>
    celula(
      paragrafo(
        `( ${estrategia.id === estrategiaId ? 'X' : '  '} ) ${estrategia.rotulo}`,
        { tamanho: 20, alinhamento: 'center' }
      ),
      { largura: grelha[indice] }
    )
  ).join('');

  return tabela(
    grelha,
    faixaTitulo('ESTRATÉGIAS DE APRENDIZAGEM DESAFIADORAS', TABELA_ESTRATEGIAS) +
      linha(opcoes),
    { largura }
  );
}

/**
 * Bloco de descrição da estratégia desafiadora (tabela 4).
 *
 * O formulário traz, sob cada rótulo, uma linha de "Orientação:" que explica ao
 * docente o que escrever. Essas orientações são mantidas, em itálico, porque
 * fazem parte do formulário controlado e não do conteúdo preenchido.
 *
 * @param {object} situacao
 * @returns {string}
 */
function tabelaDescricao(situacao) {
  const s = situacao || {};
  const [larguraRotulo, larguraTexto] = TABELA_DESCRICAO.grelha;

  const secoes = [
    {
      rotulo: 'CONTEXTUALIZAÇÃO:',
      orientacao:
        'Orientação: apresentar o contexto, situando o aluno quanto ao cenário (como, por que, ' +
        'para que, tempo, entre outros) e explicitar também todos os dados e informações que o ' +
        'aluno deve saber para iniciar a reflexão que levará às possíveis soluções para o desafio proposto.',
      valor: s.contextualizacao,
    },
    {
      rotulo: 'DESAFIO:',
      orientacao:
        'Orientação: redigir o desafio, enunciando o problema e especificando, se necessário, as ' +
        'diferentes atividades que o aluno deverá realizar para chegar às possíveis soluções.',
      valor: s.desafio,
    },
    {
      rotulo: 'RESULTADOS ESPERADOS:',
      orientacao:
        'Orientação: especificar os resultados/entregas esperados que sejam mais adequados à ' +
        'contextualização e desafio proposto, a exemplo: relatório, trabalho escrito, projeto, ' +
        'protótipo, produto (bem ou serviço), maquete, descrição de experiências em laboratórios, ' +
        'elaboração de esquemas, apresentação técnica do trabalho, softwares, vídeos, manuais, ' +
        'pareceres, leiaute, entre outros.',
      // Chega como lista de entregas em services/situacaoGenerator.js.
      valor: emLinhas(s.resultadosEsperados),
    },
  ];

  const corpo = secoes
    .map((secao) => {
      // O rótulo ocupa as duas linhas da secção por mesclagem vertical, tal
      // como no formulário: fica centrado ao lado da orientação e do texto.
      const cabecalhoSecao = linha(
        celula(paragrafo(secao.rotulo, { negrito: true, tamanho: 18 }), {
          largura: larguraRotulo,
          fundo: FUNDO_CABECALHO,
          vMerge: 'inicio',
        }) +
          celula(paragrafo(secao.orientacao, { italico: true, tamanho: 16 }), {
            largura: larguraTexto,
          }),
        // A orientação é texto fixo e curto do formulário. Sem isto parte-se
        // entre páginas e deixa um fragmento solto no topo da seguinte. A
        // linha do valor fica por partir: o texto elaborado pode ser longo, e
        // mantê-lo inteiro abriria um vazio no fim da página anterior.
        { naoPartir: true }
      );

      const conteudoSecao = linha(
        celula('', {
          largura: larguraRotulo,
          fundo: FUNDO_CABECALHO,
          vMerge: 'continua',
        }) +
          celula(paragrafo(secao.valor, { tamanho: 18 }), { largura: larguraTexto })
      );

      return cabecalhoSecao + conteudoSecao;
    })
    .join('');

  return tabela(
    TABELA_DESCRICAO.grelha,
    faixaTitulo(
      'DESCRIÇÃO DA ESTRATÉGIA DE APRENDIZAGEM DESAFIADORA',
      TABELA_DESCRICAO
    ) + corpo,
    { largura: TABELA_DESCRICAO.largura }
  );
}

/**
 * Formata a lista de capacidades de uma linha do plano, agrupada por tipo.
 *
 * O formulário pede "Capacidades: Básicas, Técnicas e Socioemocional" numa
 * única célula, pelo que a classificação é indicada por um prefixo.
 *
 * @param {Array<{ tipo?: string, descricao?: string }>|string[]} capacidades
 * @returns {string} Texto com uma capacidade por linha.
 */
function formatarCapacidades(capacidades) {
  if (!Array.isArray(capacidades)) return String(capacidades || '');

  return capacidades
    .map((capacidade) => {
      if (typeof capacidade === 'string') return capacidade;
      const tipo = capacidade.tipo ? `[${capacidade.tipo}] ` : '';
      return `${tipo}${capacidade.descricao || ''}`.trim();
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Junta uma lista de valores numa string com um item por linha.
 * @param {string[]|string} valor
 * @returns {string}
 */
function emLinhas(valor) {
  if (Array.isArray(valor)) return valor.filter(Boolean).join('\n');
  return String(valor === undefined || valor === null ? '' : valor);
}

/**
 * Tabela principal de aulas (tabela 5 do formulário).
 *
 * O corpo usa 8 pt: um plano gerado traz bem mais texto do que um formulário
 * preenchido à mão, e a 10 pt do original uma UC inteira não caberia nas
 * colunas estreitas de capacidades e conhecimentos.
 *
 * @param {object[]} linhasPlano
 * @returns {string}
 */
function tabelaAulas(linhasPlano) {
  const titulos = [
    'Aula nº',
    'CH',
    'Capacidades: Básicas, Técnicas e Socioemocional\n(Informação que deve constar no Diário de classe)',
    'Conhecimentos',
    'Estratégias de Ensino',
    'Critérios de Avaliação',
    'Instrumentos de Avaliação',
    'Recursos Didáticos, Ambientes Pedagógicos e Acessibilidade',
  ];

  const { grelha, largura } = TABELA_AULAS;

  const cabecalho = linha(
    titulos
      .map((titulo, indice) =>
        celula(
          paragrafo(titulo, { negrito: true, tamanho: 16, alinhamento: 'center' }),
          { largura: grelha[indice], fundo: FUNDO_CABECALHO }
        )
      )
      .join(''),
    // Repete-se no topo de cada página: ao contrário do formulário em branco,
    // um plano real ocupa várias páginas.
    { cabecalho: true }
  );

  const corpo = (linhasPlano || [])
    .map((item) => {
      const valores = [
        { texto: item.aulas, alinhamento: 'center' },
        { texto: item.ch, alinhamento: 'center' },
        { texto: formatarCapacidades(item.capacidades) },
        { texto: emLinhas(item.conhecimentos) },
        { texto: emLinhas(item.estrategiasEnsino) },
        { texto: emLinhas(item.criterios) },
        { texto: emLinhas(item.instrumentos) },
        { texto: emLinhas(item.recursos) },
      ];

      return linha(
        valores
          .map((valor, indice) =>
            celula(
              paragrafo(valor.texto, { tamanho: 16, alinhamento: valor.alinhamento }),
              { largura: grelha[indice] }
            )
          )
          .join(''),
        // Cada linha é um conhecimento e lê-se como um todo; parti-la a meio
        // entre duas páginas torna-a difícil de acompanhar. Quando uma linha
        // não couber numa página inteira, o Word parte-a à mesma.
        { naoPartir: true }
      );
    })
    .join('');

  return tabela(grelha, cabecalho + corpo, { largura, centrada: true });
}

/**
 * Tabela de uma só célula com título em faixa e conteúdo por baixo.
 * @param {string} titulo
 * @param {string} conteudo
 * @returns {string}
 */
function blocoSimples(titulo, conteudo) {
  const { grelha, largura, recuo } = TABELA_BLOCO;

  return tabela(
    grelha,
    faixaTitulo(titulo, TABELA_BLOCO) +
      linha(celula(paragrafo(conteudo, { tamanho: 18 }), { largura })),
    { largura, recuo }
  );
}

/**
 * Nota de rodapé fixa do formulário (tabela 6).
 * @returns {string}
 */
function tabelaNota() {
  const { grelha, largura, recuo } = TABELA_BLOCO;

  return tabela(
    grelha,
    linha(
      celula(
        paragrafo(
          'Nota: Para enriquecimento da prática Docente, consultar a Metodologia SENAI de Educação Profissional.',
          { negrito: true, italico: true, tamanho: 18 }
        ),
        { largura, fundo: FUNDO_CABECALHO }
      )
    ),
    { largura, recuo }
  );
}

/**
 * Monta o conteúdo de word/document.xml para um Plano de Ensino.
 * @param {object} plano Estrutura já validada por montarDocumento.
 * @returns {string} XML do corpo (sem o elemento raiz nem o sectPr).
 */
function montarCorpo(plano) {
  const situacoes = Array.isArray(plano.situacoes) ? plano.situacoes : [];
  const varias = situacoes.length > 1;

  const blocosSituacao = situacoes
    .map((situacao, indice) => {
      const numero = String(indice + 1).padStart(2, '0');
      const titulo = varias
        ? paragrafo(
            `SITUAÇÃO DE APRENDIZAGEM ${numero}${situacao.titulo ? ` — ${situacao.titulo}` : ''}`,
            { negrito: true, tamanho: 20 }
          )
        : '';

      return (
        titulo +
        tabelaEstrategias(situacao.estrategiaId) +
        espacador() +
        tabelaDescricao(situacao) +
        espacador()
      );
    })
    .join('');

  return (
    tabelaIdentificacao(plano.identificacao) +
    espacador() +
    tabelaPerfil(plano.perfil) +
    espacador() +
    blocosSituacao +
    tabelaAulas(plano.linhas) +
    espacador() +
    tabelaNota() +
    espacador() +
    blocoSimples('AVALIAÇÃO (COMPOSIÇÃO DA MÉDIA)', plano.composicaoMedia) +
    espacador() +
    blocoSimples('REFERÊNCIAS BIBLIOGRÁFICAS', plano.referencias) +
    espacador() +
    blocoSimples('PARECER DA ÁREA EDUCACIONAL', plano.parecer)
  );
}

/**
 * Lê o template e devolve as peças reaproveitadas do document.xml original.
 * @param {Array<{ nome: string, dados: Buffer }>} partes
 * @returns {{ prefixo: string, sufixo: string }}
 * @throws {Error} TEMPLATE_INVALIDO se o document.xml não tiver a forma esperada.
 */
function extrairMolde(partes) {
  const documento = partes.find((parte) => parte.nome === 'word/document.xml');
  if (!documento) throw new Error('TEMPLATE_INVALIDO');

  const xml = documento.dados.toString('utf8');

  const inicioCorpo = xml.indexOf('<w:body>');
  const inicioSecao = xml.lastIndexOf('<w:sectPr');

  if (inicioCorpo === -1 || inicioSecao === -1) throw new Error('TEMPLATE_INVALIDO');

  return {
    // Declaração XML, elemento <w:document> com todos os espaços de nomes e a
    // abertura de <w:body>.
    prefixo: xml.slice(0, inicioCorpo + '<w:body>'.length),
    // <w:sectPr> (A4 paisagem, margens, cabeçalho e rodapé) e o fecho do corpo.
    sufixo: xml.slice(inicioSecao),
  };
}

/**
 * Gera o ficheiro .docx do Plano de Ensino no formulário FO-178.
 *
 * @param {object} plano Dados do plano de ensino:
 *   - identificacao: { curso, unidadeCurricular, docente, cargaHoraria }
 *   - perfil: { funcao, subfuncao, objetivoGeral }
 *   - situacoes: [{ titulo, estrategiaId, contextualizacao, desafio, resultadosEsperados }]
 *   - linhas: [{ aulas, ch, capacidades, conhecimentos, estrategiasEnsino,
 *                criterios, instrumentos, recursos }]
 *   - composicaoMedia, referencias, parecer
 * @returns {Buffer} Conteúdo do ficheiro .docx.
 * @throws {Error} TEMPLATE_AUSENTE quando assets/templates/FO-178.docx não existe.
 */
function gerarDocx(plano) {
  if (!fs.existsSync(CAMINHO_TEMPLATE)) throw new Error('TEMPLATE_AUSENTE');

  const partes = lerPacote(fs.readFileSync(CAMINHO_TEMPLATE));
  const molde = extrairMolde(partes);

  const documento = molde.prefixo + montarCorpo(plano || {}) + molde.sufixo;

  return escreverPacote(substituirParte(partes, 'word/document.xml', documento));
}

module.exports = {
  gerarDocx,
  ESTRATEGIAS_FO178,
  // Exportados para teste
  montarCorpo,
  extrairMolde,
  CAMINHO_TEMPLATE,
};
