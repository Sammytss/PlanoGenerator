# 🎓 Plano Generator

![Logo](PG.png)

**Plano Generator** é uma aplicação web projetada para automatizar a criação de Planos de Ensino Docente, seguindo a Metodologia SENAI. A solução integra uma interface de usuário web, um backend inteligente que utiliza a IA Generativa do Google (Gemini 1.5) e a plataforma Google Workspace para transformar a documentação de uma Unidade Curricular (UC) numa planilha Google Sheets completa, formatada e pronta para uso em minutos.

---

## 📋 Tabela de Conteúdos

- [Sobre o Projeto](#sobre-o-projeto)
- [✨ Funcionalidades Principais](#-funcionalidades-principais)
- [🛠️ Tecnologias Utilizadas](#️-tecnologias-utilizadas)
- [🚀 Começando](#-começando)
  - [Pré-requisitos](#pré-requisitos)
  - [Configuração do Backend](#configuração-do-backend)
  - [Configuração do Google Apps Script](#configuração-do-google-apps-script)
- [💻 Como Usar](#-como-usar)
- [📁 Estrutura do Projeto](#-estrutura-do-projeto)
- [👤 Criador](#-criador)

---

## Sobre o Projeto

O objetivo do **Plano Generator** é otimizar o tempo e o esforço de instrutores na elaboração de planejamentos docentes. A aplicação automatiza tarefas repetitivas e complexas, como a extração de conhecimentos, a associação com capacidades técnicas e o cálculo de cronogramas, garantindo consistência, qualidade e aderência à Metodologia SENAI.

---

## ✨ Funcionalidades Principais

- **Interface Web Intuitiva:** Um formulário simples para inserir todas as informações do curso e da Unidade Curricular.
- **Extração Inteligente de PDF:** A IA analisa o PDF do Plano de Curso e extrai a lista de Conhecimentos, respeitando a hierarquia de tópicos e subtópicos e focando apenas na Unidade Curricular correta.
- **Elaboração Pedagógica:** Para cada Conhecimento, a IA gera um plano detalhado, associando as Capacidades Técnicas corretas e sugerindo estratégias de ensino, instrumentos de avaliação e recursos.
- **Agendamento Flexível:** Um sistema de cálculo de datas híbrido que permite:
  - Selecionar datas de aula específicas e não sequenciais através de um calendário.
  - Definir um padrão de aulas recorrentes (ex: todas as segundas e quartas).
  - Considerar feriados e períodos de férias para um cronograma preciso.
- **Geração de Planilha Automatizada:** A aplicação comunica-se com um script do Google para criar uma planilha Google Sheets profissional, formatada e pronta para uso.
- **Segurança:** As chaves de API são armazenadas de forma segura, separada do código-fonte.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Node.js, Express.js
- **IA Generativa:** Google Gemini 1.5
- **Geração de Planilhas:** Google Apps Script
- **Dependências Principais:** `axios`, `cors`, `dotenv`, `multer`, `xlsx`, `@google/generative-ai`

---

## 🚀 Começando

Para executar este projeto localmente, siga os passos abaixo.

### Pré-requisitos

- **Node.js:** Certifique-se de que tem o Node.js instalado. Pode descarregá-lo em [nodejs.org](https://nodejs.org/).

### Configuração do Backend

1.  **Clone ou Descarregue o Projeto:**
    Tenha todos os ficheiros do projeto na sua pasta principal (ex: `PlanoGenerator`).

2.  **Instale as Dependências:**
    Abra o terminal na pasta raiz do projeto (`PlanoGenerator`) e execute o seguinte comando:
    ```bash
    npm install
    ```

3.  **Crie o Ficheiro de Ambiente:**
    - Na pasta `assets/backend-planilhas`, crie um ficheiro chamado `.env`.
    - Dentro do `.env`, adicione a sua chave da API do Google Gemini:
      ```
      GEMINI_API_KEY=SUA_CHAVE_DE_API_AQUI
      ```

### Configuração do Google Apps Script

1.  **Crie um Novo Script:**
    - Vá a [script.google.com](https://script.google.com) e crie um novo projeto.
    - Cole o conteúdo do seu ficheiro Apps Script (a função `doPost`) no editor.

2.  **Implante o Script:**
    - Clique em **Implantar > Nova implantação**.
    - Selecione o tipo **"App da Web"**.
    - Em **"Quem pode acessar"**, selecione **"Qualquer pessoa"**.
    - Clique em **Implantar** e autorize o acesso.
    - Copie a **URL do app da Web** gerada.

3.  **Atualize o `server.js`:**
    - No seu ficheiro `server.js`, cole a URL do app da Web na constante `APPS_SCRIPT_URL`.

---

## 💻 Como Usar

1.  **Inicie o Servidor Backend:**
    No terminal, a partir da pasta raiz do projeto (`PlanoGenerator`), execute:
    ```bash
    node .\assets\backend-planilhas\server.js
    ```

2.  **Abra a Aplicação:**
    Abra o seu ficheiro `index.html` num navegador web.

3.  **Preencha e Gere:**
    - Preencha todos os campos do formulário.
    - Use o calendário ou as caixas de seleção para definir o cronograma.
    - Anexe o PDF da Unidade Curricular.
    - Clique em "🚀 Gerar Plano de Curso" e aguarde a magia acontecer!

---

## 📁 Estrutura do Projeto

```
PlanoGenerator/
├── assets/
│   ├── backend-planilhas/
│   │   ├── .env
│   │   └── server.js
│   ├── js/
│   │   ├── calendar-init.js
│   │   └── ui-interactions.js
│   ├── Images/
│   └── style.css
├── node_modules/
├── index.html
├── package-lock.json
├── package.json
└── README.md
```

---

## 👤 Criador

Este projeto foi idealizado e desenvolvido por **Samuel Teles dos Santos**.

- **LinkedIn:** [linkedin.com/in/samuel-teles-dos-santos-662003237](https://linkedin.com/in/samuel-teles-dos-santos-662003237)

