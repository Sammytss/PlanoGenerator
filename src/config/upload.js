const multer = require('multer');

// Configuração de upload (PDF da UC + Matriz SAEP)
// - Usa memória (mantendo o comportamento atual)
// - Limita tamanho e faz filtro básico de tipo

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    // Limite razoável para cada ficheiro (15 MB)
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const field = file.fieldname;
    const name = (file.originalname || '').toLowerCase();

    if (field === 'pdfFile') {
      if (file.mimetype === 'application/pdf' || name.endsWith('.pdf')) {
        return cb(null, true);
      }
      // Rejeita silenciosamente tipos incorretos; a lógica acima tratará ausência do PDF
      return cb(null, false);
    }

    if (field === 'matrixFile') {
      const allowedMimes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      const allowedExt = ['.xls', '.xlsx'];

      if (
        allowedMimes.includes(file.mimetype) ||
        allowedExt.some((ext) => name.endsWith(ext))
      ) {
        return cb(null, true);
      }

      // Matriz é opcional; se o tipo não for reconhecido, apenas ignora
      return cb(null, false);
    }

    // Ignora quaisquer outros campos de ficheiro inesperados
    return cb(null, false);
  },
}).fields([
  { name: 'pdfFile', maxCount: 1 },
  { name: 'matrixFile', maxCount: 1 },
]);

// Upload da planilha de planejamento já gerada (.xlsx), usada pelas páginas de
// Ficha de Observação e Situação de Aprendizagem para reaproveitar um plano que
// não foi gerado na sessão atual do navegador.
const uploadPlanilha = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const allowedExt = ['.xls', '.xlsx'];

    if (allowedMimes.includes(file.mimetype) || allowedExt.some((ext) => name.endsWith(ext))) {
      return cb(null, true);
    }
    return cb(null, false);
  },
}).single('planilhaFile');

module.exports = {
  upload,
  uploadPlanilha,
};

