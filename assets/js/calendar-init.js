// Espera que todo o conteúdo da página seja carregado
document.addEventListener('DOMContentLoaded', function () {
    
    // Ativa o calendário no campo de feriados
    flatpickr("#holidays", {
        mode: "multiple",       // Permite selecionar múltiplas datas
        dateFormat: "d/m/Y",    // Formata a data como DD/MM/AAAA
        locale: "pt"            // Usa a tradução para português
    });

    // Ativa o calendário para as datas das aulas
    flatpickr("#classDates", {
        mode: "multiple",
        dateFormat: "d/m/Y",
        locale: "pt"
    });

});