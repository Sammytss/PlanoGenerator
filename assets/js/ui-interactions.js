// Espera que todo o conteúdo da página seja carregado antes de executar o código
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('courseForm');
    if (!form) return; // Se não encontrar o formulário, não faz nada

    // --- LÓGICA DO CARD DE AJUDA ---
    const helpCard = document.getElementById('helpCard');
    const helpIcon = document.querySelector('.help-icon');
    const closeBtn = document.querySelector('.help-card .close-btn');

    function toggleHelpCard() {
        helpCard.classList.toggle('hidden');
    }

    if (helpIcon) helpIcon.addEventListener('click', toggleHelpCard);
    if (closeBtn) closeBtn.addEventListener('click', toggleHelpCard);

    // Fecha o card ao clicar fora dele
    document.addEventListener('click', function (event) {
        if (!helpCard.classList.contains('hidden') &&
            !helpCard.contains(event.target) &&
            !helpIcon.contains(event.target)) {
            helpCard.classList.add('hidden');
        }
    });

    // --- LÓGICA DA BARRA DE PROGRESSO E SCROLL ---
    const inputs = form.querySelectorAll('input[required]');
    const headerProgress = document.getElementById('headerProgress');
    const originalProgress = document.querySelector('.progress-indicator');
    
    if (!originalProgress || !headerProgress) return;

    const originalProgressSteps = originalProgress.querySelectorAll('.progress-step');
    const headerProgressSteps = headerProgress.querySelectorAll('.progress-step');

    function updateProgress() {
        const filledInputs = Array.from(inputs).filter(input => input.value.trim() !== '');
        const progress = Math.min(Math.floor((filledInputs.length / inputs.length) * 6), 6);

        originalProgressSteps.forEach((step, index) => {
            step.classList.toggle('active', index < progress);
        });

        headerProgressSteps.forEach((step, index) => {
            step.classList.toggle('active', index < progress);
        });
    }

    inputs.forEach(input => {
        input.addEventListener('input', updateProgress);
        input.addEventListener('change', updateProgress);
    });

    function handleScroll() {
        const originalProgressRect = originalProgress.getBoundingClientRect();
        const headerHeight = document.querySelector('.institutional-header').offsetHeight;

        if (originalProgressRect.bottom < headerHeight) {
            headerProgress.classList.add('visible');
        } else {
            headerProgress.classList.remove('visible');
        }
    }

    window.addEventListener('scroll', handleScroll);
    updateProgress(); // Estado inicial
    handleScroll();   // Estado inicial
});