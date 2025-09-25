// =========================================================================
// ✨ ✨ ✨ UI-INTERACTIONS.JS (VERSÃO FINAL COM SETA CORRIGIDA) ✨ ✨ ✨
// =========================================================================

document.addEventListener('DOMContentLoaded', function () {

    // --- LÓGICA DO CARD DE AJUDA ---
    const helpCard = document.getElementById('helpCard');
    const helpIcon = document.querySelector('.help-icon');
    const closeBtn = document.querySelector('.help-card .close-btn');

    if (helpCard && helpIcon && closeBtn) {
        function toggleHelpCard() {
            helpCard.classList.toggle('hidden');
        }

        helpIcon.addEventListener('click', toggleHelpCard);
        closeBtn.addEventListener('click', toggleHelpCard);

        document.addEventListener('click', function (event) {
            if (!helpCard.classList.contains('hidden') && !helpCard.contains(event.target) && !helpIcon.contains(event.target)) {
                helpCard.classList.add('hidden');
            }
        });
    }

    // --- LÓGICA DA BARRA DE PROGRESSO E SCROLL ---
    const form = document.getElementById('courseForm');
    if (form) {
        const inputs = form.querySelectorAll('input[required]');
        const headerProgress = document.getElementById('headerProgress');
        const originalProgress = document.querySelector('.progress-indicator');

        if (originalProgress && headerProgress) {
            const originalProgressSteps = originalProgress.querySelectorAll('.progress-step');
            const headerProgressSteps = headerProgress.querySelectorAll('.progress-step');

            function updateProgress() {
                const filledInputs = Array.from(inputs).filter(input => input.value.trim() !== '');
                const progress = Math.min(Math.floor((filledInputs.length / inputs.length) * 6), 6);

                originalProgressSteps.forEach((step, index) => step.classList.toggle('active', index < progress));
                headerProgressSteps.forEach((step, index) => step.classList.toggle('active', index < progress));
            }

            inputs.forEach(input => {
                input.addEventListener('input', updateProgress);
                input.addEventListener('change', updateProgress);
            });

            function handleScroll() {
                const originalProgressRect = originalProgress.getBoundingClientRect();
                const headerHeight = document.querySelector('.institutional-header').offsetHeight;
                headerProgress.classList.toggle('visible', originalProgressRect.bottom < headerHeight);
            }

            window.addEventListener('scroll', handleScroll);
            updateProgress();
            handleScroll();
        }
    }

    // --- LÓGICA DO GUIA INTERATIVO ---
    const guideContainer = document.getElementById('interactiveGuide');
    if (guideContainer) {
        const guideSteps = [
            { 
                field: 'courseName', 
                title: 'Nome do Curso', 
                description: 'Digite o nome completo do curso técnico ou superior. Este nome aparecerá no cabeçalho do seu plano de ensino. Exemplo: "Técnico em Informática".' 
            },
            { 
                field: 'ucName', 
                title: 'Unidade Curricular (UC)', 
                description: 'Informe o nome exato da disciplina ou unidade curricular. Esta informação é crucial para que a IA encontre o conteúdo correto no PDF. Exemplo: "Desenvolvimento Web".' 
            },
            { 
                field: 'instructorName', 
                title: 'Nome do Instrutor', 
                description: 'Digite o nome completo do instrutor responsável por esta unidade curricular. Esta informação aparecerá no plano de ensino como responsável pela disciplina.' 
            },
            { 
                field: 'classCode', 
                title: 'Código da Turma', 
                description: 'Informe o código oficial da turma, usado para identificação no sistema acadêmico. Exemplo: "TEC.2024.2.247".' 
            },
            { 
                field: 'modality', 
                title: 'Modalidade do Curso', 
                description: 'Especifique a modalidade do curso oferecido. Exemplo: "HABILITAÇÃO TÉCNICA", "CURSO SUPERIOR", etc.' 
            },
            { 
                field: 'startDate', 
                title: 'Data de Início', 
                description: 'Selecione a data em que as aulas desta UC começarão. O sistema usará esta informação para calcular o cronograma completo das aulas.' 
            },
            { 
                field: 'endDate', 
                title: 'Data de Término', 
                description: 'Defina quando as aulas desta UC terminarão. Junto com a data de início, isso determinará a duração total do curso e a distribuição das aulas.' 
            },
            { 
                field: 'totalHours', 
                title: 'Carga Horária Total', 
                description: 'Informe a carga horária total da UC em horas. Exemplo: "120". Esta informação será usada para distribuir o conteúdo ao longo do período.' 
            },
            { 
                field: 'shift', 
                title: 'Turno das Aulas', 
                description: 'Selecione o turno em que as aulas acontecerão. Manhã/Tarde considera 4 horas de aula por dia, enquanto Noite considera 3 horas. Isso afeta o cálculo do cronograma.' 
            },
            { 
                field: 'weekdays', 
                title: 'Dias da Semana', 
                description: 'Para cursos com padrão fixo, marque os dias da semana em que haverá aula. Se nenhum dia for selecionado, o sistema considerará todos os dias úteis (Segunda a Sexta-feira).' 
            },
            {
                field: 'classDates',
                title: 'Datas Específicas',
                description: 'Para cursos com cronograma irregular, use este calendário para selecionar manualmente todas as datas em que haverá aula. Esta opção tem prioridade sobre os "Dias da Semana".'
            },
            {
                field: 'holidays',
                title: 'Feriados',
                description: 'Selecione no calendário todos os feriados que ocorrem durante o período do curso. O sistema irá removê-los automaticamente do cronograma de aulas.'
            },
            {
                field: 'vacationStart',
                title: 'Período de Férias',
                description: 'Se houver um recesso ou férias durante a UC, defina aqui a data de início e de fim desse período. Estes dias também serão ignorados no cálculo.'
            },
            { 
                field: 'pdfFile', 
                title: 'Arquivo PDF da UC', 
                description: 'Faça o upload do documento PDF que contém as informações oficiais da Unidade Curricular. O sistema analisará este arquivo para gerar o plano automaticamente. Este campo é obrigatório.' 
            },
            { 
                field: 'matrixFile', 
                title: 'Matriz de Referência (Opcional)', 
                description: 'Anexe aqui a Matriz SAEP em formato Excel (.xls ou .xlsx). Este campo é opcional, mas ajuda a enriquecer o plano de ensino com dados de referência.' 
            },
            { 
                field: 'observacoes', 
                title: 'Observações para a IA (Opcional)', 
                description: 'Use este campo poderoso para "conversar" com a IA. Dê instruções em linguagem natural para personalizar o conteúdo, a metodologia ou a avaliação. Ex: "A avaliação final deve ser um projeto prático".' 
            }
        ];

        let currentGuideStep = 0;
        let guideActive = false;

        const welcomeModal = document.getElementById('guideWelcome');
        const tooltip = document.getElementById('guideTooltip');

        function showGuide() {
            form.setAttribute('novalidate', true);
            guideContainer.classList.remove('hidden');
            welcomeModal.classList.remove('hidden');
            tooltip.classList.add('hidden');
            guideActive = true;
        }

        function skipGuide() {
            form.removeAttribute('novalidate');
            const dontShowAgain = document.getElementById('dontShowAgain');
            if (dontShowAgain && dontShowAgain.checked) {
                localStorage.setItem('hideInteractiveGuide', 'true');
            }
            guideContainer.classList.add('hidden');
            clearFieldHighlight();
            guideActive = false;
        }

        function startFieldGuide() {
            const dontShowAgain = document.getElementById('dontShowAgain');
            if (dontShowAgain && dontShowAgain.checked) {
                localStorage.setItem('hideInteractiveGuide', 'true');
            }
            welcomeModal.classList.add('hidden');
            currentGuideStep = 0;
            showGuideStep();
        }

        function nextGuideStep() {
            currentGuideStep++;
            if (currentGuideStep >= guideSteps.length) {
                skipGuide();
                return;
            }
            showGuideStep();
        }

        function showGuideStep() {
            const step = guideSteps[currentGuideStep];
            const field = document.getElementById(step.field);
            if (!field) {
                console.error(`Campo do guia não encontrado: #${step.field}`);
                nextGuideStep();
                return;
            }

            clearFieldHighlight();

            const fieldContainer = field.closest('.form-group, .form-group-row, .weekdays-selector') || field;
            fieldContainer.classList.add('field-highlight');

            // Move o tooltip para dentro do container do campo
            fieldContainer.appendChild(tooltip);
            tooltip.classList.remove('hidden');

            document.getElementById('guideStepNumber').textContent = currentGuideStep + 1;
            document.getElementById('guideTitle').textContent = step.title;
            document.getElementById('guideDescription').textContent = step.description;
            document.getElementById('guideProgressText').textContent = `Passo ${currentGuideStep + 1} de ${guideSteps.length}`;

            const progressPercent = ((currentGuideStep + 1) / guideSteps.length) * 100;
            document.getElementById('guideProgressFill').style.width = `${progressPercent}%`;

            const nextBtn = document.getElementById('guideNextBtn');
            nextBtn.textContent = currentGuideStep === guideSteps.length - 1 ? 'Finalizar' : 'Próximo';

            // ✨ Chama a nova função de posicionamento para a seta ✨
            positionTooltipArrow(field, tooltip);

            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            field.focus({ preventScroll: true });
        }

        // ✨ FUNÇÃO PARA POSICIONAR A SETA (apenas classes de direção) ✨
        function positionTooltipArrow(field, tooltip) {
            // Limpa classes de posicionamento anteriores
            tooltip.classList.remove('top', 'bottom', 'left', 'right');

            const fieldRect = field.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const margin = 15; // Margem entre o campo e o tooltip
            // Adiciona a classe de posicionamento ao tooltip
            tooltip.classList.add('bottom');
        }

        function clearFieldHighlight() {
            const highlighted = document.querySelectorAll('.field-highlight');
            highlighted.forEach(el => el.classList.remove('field-highlight'));
            if (tooltip.parentNode !== guideContainer) {
                guideContainer.appendChild(tooltip);
            }
        }

        // LIGA OS BOTÕES USANDO DELEGAÇÃO DE EVENTOS
        document.addEventListener('click', function (event) {
            const welcomeSkipBtn = event.target.closest('#guideWelcome .guide-btn-secondary');
            const welcomeStartBtn = event.target.closest('#guideWelcome .guide-btn-primary');
            const tooltipSkipBtn = event.target.closest('#guideTooltip .guide-btn-secondary');
            const tooltipNextBtn = event.target.closest('#guideNextBtn');

            if (welcomeSkipBtn || tooltipSkipBtn) {
                skipGuide();
            } else if (welcomeStartBtn) {
                startFieldGuide();
            } else if (tooltipNextBtn) {
                nextGuideStep();
            }
        });

        // INICIA O GUIA
        const hideGuide = localStorage.getItem('hideInteractiveGuide');
        if (!hideGuide) {
            setTimeout(showGuide, 1000);
        }

        // Reposicionar a seta em caso de redimensionamento da janela
        window.addEventListener('resize', () => {
            if (guideActive && currentGuideStep < guideSteps.length) {
                const step = guideSteps[currentGuideStep];
                const field = document.getElementById(step.field);
                if (field) {
                    positionTooltipArrow(field, tooltip); // Recalcula apenas a direção da seta
                }
            }
        });
    }
});