const zlib = require('zlib');

// ---------------------------------------------------------------------------
// Leitura e escrita de pacotes OOXML (.docx) sem dependências externas
// ---------------------------------------------------------------------------
// Um .docx é um ficheiro ZIP com várias partes XML. Para exportar o FO-178
// preservando a identidade do formulário (cabeçalho de documento controlado,
// logotipo, fontes e estilos), partimos do .docx original e substituímos apenas
// "word/document.xml". Todas as outras partes são reescritas byte a byte.
//
// Só é preciso suportar os dois métodos que o Word usa: 0 (armazenado) e
// 8 (deflate). Escrevemos sempre em deflate, que o Word lê sem particularidades.
// ---------------------------------------------------------------------------

const ASSINATURA_FIM_CENTRAL = 0x06054b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_LOCAL = 0x04034b50;

/** Tabela de CRC-32 (polinómio 0xEDB88320), calculada uma única vez. */
const TABELA_CRC = (() => {
  const tabela = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let bit = 0; bit < 8; bit += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabela[i] = c;
  }
  return tabela;
})();

/**
 * Calcula o CRC-32 de um buffer, como exigido pelo formato ZIP.
 * @param {Buffer} buffer
 * @returns {number} CRC-32 sem sinal.
 */
function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    c = TABELA_CRC[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

/**
 * Localiza o registo "End of Central Directory" no fim do ficheiro.
 * @param {Buffer} buffer
 * @returns {number} Posição do registo.
 * @throws {Error} ZIP_INVALIDO quando o registo não existe.
 */
function localizarFimDoDiretorio(buffer) {
  // O registo tem 22 bytes e pode ser seguido de um comentário de até 64 KiB.
  const minimo = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= minimo; i -= 1) {
    if (buffer.readUInt32LE(i) === ASSINATURA_FIM_CENTRAL) return i;
  }
  throw new Error('ZIP_INVALIDO');
}

/**
 * Lê um pacote .docx e devolve as suas partes pela ordem original.
 *
 * A ordem importa pouco para o Word, mas mantê-la torna o ficheiro gerado
 * comparável ao modelo, o que ajuda no diagnóstico.
 *
 * @param {Buffer} buffer Conteúdo do ficheiro .docx.
 * @returns {Array<{ nome: string, dados: Buffer }>} Partes do pacote.
 * @throws {Error} ZIP_INVALIDO se o ficheiro não for um ZIP legível.
 */
function lerPacote(buffer) {
  const fimDiretorio = localizarFimDoDiretorio(buffer);
  const total = buffer.readUInt16LE(fimDiretorio + 10);
  let posicao = buffer.readUInt32LE(fimDiretorio + 16);

  const partes = [];

  for (let i = 0; i < total; i += 1) {
    if (buffer.readUInt32LE(posicao) !== ASSINATURA_CENTRAL) {
      throw new Error('ZIP_INVALIDO');
    }

    const metodo = buffer.readUInt16LE(posicao + 10);
    const tamanhoComprimido = buffer.readUInt32LE(posicao + 20);
    const tamanhoNome = buffer.readUInt16LE(posicao + 28);
    const tamanhoExtra = buffer.readUInt16LE(posicao + 30);
    const tamanhoComentario = buffer.readUInt16LE(posicao + 32);
    const inicioLocal = buffer.readUInt32LE(posicao + 42);
    const nome = buffer.toString('utf8', posicao + 46, posicao + 46 + tamanhoNome);

    if (buffer.readUInt32LE(inicioLocal) !== ASSINATURA_LOCAL) {
      throw new Error('ZIP_INVALIDO');
    }

    // O cabeçalho local tem os seus próprios tamanhos de nome e extra, que
    // podem diferir dos do diretório central.
    const nomeLocal = buffer.readUInt16LE(inicioLocal + 26);
    const extraLocal = buffer.readUInt16LE(inicioLocal + 28);
    const inicioDados = inicioLocal + 30 + nomeLocal + extraLocal;
    const bruto = buffer.slice(inicioDados, inicioDados + tamanhoComprimido);

    partes.push({
      nome,
      dados: metodo === 0 ? Buffer.from(bruto) : zlib.inflateRawSync(bruto),
    });

    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }

  return partes;
}

/**
 * Escreve um pacote ZIP a partir das suas partes.
 *
 * Todas as entradas são gravadas com deflate e com data fixa. Uma data fixa
 * torna a exportação determinística: o mesmo plano gera sempre os mesmos bytes.
 *
 * @param {Array<{ nome: string, dados: Buffer }>} partes
 * @returns {Buffer} Ficheiro .docx completo.
 */
function escreverPacote(partes) {
  // 1980-01-01 00:00:00 em formato MS-DOS (o mínimo representável).
  const HORA_DOS = 0;
  const DATA_DOS = 0x0021;

  const blocosLocais = [];
  const blocosCentrais = [];
  let deslocamento = 0;

  partes.forEach((parte) => {
    const nome = Buffer.from(parte.nome, 'utf8');
    const dados = Buffer.isBuffer(parte.dados)
      ? parte.dados
      : Buffer.from(String(parte.dados), 'utf8');
    const comprimido = zlib.deflateRawSync(dados, { level: 9 });
    const crc = crc32(dados);

    const cabecalhoLocal = Buffer.alloc(30);
    cabecalhoLocal.writeUInt32LE(ASSINATURA_LOCAL, 0);
    cabecalhoLocal.writeUInt16LE(20, 4); // versão mínima
    cabecalhoLocal.writeUInt16LE(0, 6); // flags
    cabecalhoLocal.writeUInt16LE(8, 8); // método: deflate
    cabecalhoLocal.writeUInt16LE(HORA_DOS, 10);
    cabecalhoLocal.writeUInt16LE(DATA_DOS, 12);
    cabecalhoLocal.writeUInt32LE(crc, 14);
    cabecalhoLocal.writeUInt32LE(comprimido.length, 18);
    cabecalhoLocal.writeUInt32LE(dados.length, 22);
    cabecalhoLocal.writeUInt16LE(nome.length, 26);
    cabecalhoLocal.writeUInt16LE(0, 28); // sem campo extra

    blocosLocais.push(cabecalhoLocal, nome, comprimido);

    const cabecalhoCentral = Buffer.alloc(46);
    cabecalhoCentral.writeUInt32LE(ASSINATURA_CENTRAL, 0);
    cabecalhoCentral.writeUInt16LE(20, 4); // versão de criação
    cabecalhoCentral.writeUInt16LE(20, 6); // versão mínima
    cabecalhoCentral.writeUInt16LE(0, 8);
    cabecalhoCentral.writeUInt16LE(8, 10);
    cabecalhoCentral.writeUInt16LE(HORA_DOS, 12);
    cabecalhoCentral.writeUInt16LE(DATA_DOS, 14);
    cabecalhoCentral.writeUInt32LE(crc, 16);
    cabecalhoCentral.writeUInt32LE(comprimido.length, 20);
    cabecalhoCentral.writeUInt32LE(dados.length, 24);
    cabecalhoCentral.writeUInt16LE(nome.length, 28);
    cabecalhoCentral.writeUInt16LE(0, 30); // extra
    cabecalhoCentral.writeUInt16LE(0, 32); // comentário
    cabecalhoCentral.writeUInt16LE(0, 34); // disco
    cabecalhoCentral.writeUInt16LE(0, 36); // atributos internos
    cabecalhoCentral.writeUInt32LE(0, 38); // atributos externos
    cabecalhoCentral.writeUInt32LE(deslocamento, 42);

    blocosCentrais.push(cabecalhoCentral, nome);

    deslocamento += cabecalhoLocal.length + nome.length + comprimido.length;
  });

  const diretorio = Buffer.concat(blocosCentrais);

  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(ASSINATURA_FIM_CENTRAL, 0);
  fim.writeUInt16LE(0, 4); // disco
  fim.writeUInt16LE(0, 6); // disco do diretório
  fim.writeUInt16LE(partes.length, 8);
  fim.writeUInt16LE(partes.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  fim.writeUInt16LE(0, 20); // sem comentário

  return Buffer.concat([...blocosLocais, diretorio, fim]);
}

/**
 * Substitui o conteúdo de uma parte do pacote, mantendo as restantes.
 * @param {Array<{ nome: string, dados: Buffer }>} partes
 * @param {string} nome Caminho da parte (ex.: "word/document.xml").
 * @param {string|Buffer} conteudo Novo conteúdo.
 * @returns {Array<{ nome: string, dados: Buffer }>} Novas partes.
 * @throws {Error} PARTE_INEXISTENTE se a parte não existir no pacote.
 */
function substituirParte(partes, nome, conteudo) {
  let encontrada = false;

  const novas = partes.map((parte) => {
    if (parte.nome !== nome) return parte;
    encontrada = true;
    return {
      nome,
      dados: Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, 'utf8'),
    };
  });

  if (!encontrada) throw new Error('PARTE_INEXISTENTE');
  return novas;
}

module.exports = {
  crc32,
  lerPacote,
  escreverPacote,
  substituirParte,
};
