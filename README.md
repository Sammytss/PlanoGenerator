# 🎓 Plano Generator
![Versão](https://img.shields.io/badge/versão-2.0.0-blue)
![Status](https://img.shields.io/badge/status-Funcional-success)
![Logo](assets/Images/PG.png)

**Plano Generator** é uma aplicação web projetada para automatizar a criação de Planos de Ensino Docente, seguindo a Metodologia SENAI. A solução integra uma interface de utilizador web, um backend inteligente que utiliza a IA Generativa do Google (Gemini) e a plataforma Google Workspace para transformar a documentação de uma Unidade Curricular (UC) numa planilha Google Sheets completa, formatada e pronta para uso em minutos.

---

## 📋 Tabela de Conteúdos

- [Sobre o Projeto](#sobre-o-projeto)
- [✨ Funcionalidades Principais](#-funcionalidades-principais)
- [🛠️ Tecnologias Utilizadas](#️-tecnologias-utilizadas)
- [🚀 Instalação para Desenvolvimento Local](#-instalação-para-desenvolvimento-local)
- [💻 Instalação em Servidor de Produção (Ubuntu)](#-instalação-em-servidor-de-produção-ubuntu)
- [⚡ Workflow de Atualização](#-workflow-de-atualização)
- [📁 Estrutura do Projeto](#-estrutura-do-projeto)
- [👤 Criador](#-criador)

---

## Sobre o Projeto

O objetivo do **Plano Generator** é otimizar o tempo e o esforço de instrutores na elaboração de planejamentos docentes. A aplicação automatiza tarefas repetitivas e complexas, como a extração de conhecimentos, a associação com capacidades técnicas e o cálculo de cronogramas, garantindo consistência, qualidade e aderência à Metodologia SENAI.

---

## ✨ Funcionalidades Principais

- **Interface Web Intuitiva:** Um formulário simples para inserir todas as informações do curso e da Unidade Curricular.
- **Extração Inteligente de PDF:** A IA analisa o PDF do Plano de Curso e extrai a lista de Conhecimentos, lidando com formatos complexos (listas hierárquicas com subtópicos) e formatos simples (listas de texto separadas por vírgula).
- **Elaboração Pedagógica:** Para cada Conhecimento, a IA gera um plano detalhado, associando as Capacidades Técnicas corretas e sugerindo estratégias de ensino, instrumentos de avaliação e formatação de recursos didáticos (com ponto e vírgula e novas linhas).
- **Agendamento Flexível:** Um sistema de cálculo de datas híbrido que permite:
  - Selecionar datas de aula específicas e não sequenciais através de um calendário.
  - Definir um padrão de aulas recorrentes (ex: todas as segundas e quartas).
  - Suporte a cargas horárias diárias de **1, 2, 3 ou 4 horas**.
  - Considerar feriados e períodos de férias para um cronograma preciso.
- **Central de Ajuda Integrada:** Um modal de ajuda que oferece duas formas de aprendizado:
  - **Guia Interativo:** Um tutorial passo a passo que guia o utilizador por cada campo do formulário.
  - **Tutorial em Vídeo:** Um modal que carrega e reproduz um vídeo explicativo diretamente.
- **Geração de Planilha Automatizada:** A aplicação comunica-se com um script do Google (Apps Script) para criar uma planilha Google Sheets profissional, formatada e pronta para uso.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Node.js, Express.js
- **Servidor:** Apache2 (como Proxy Reverso), PM2 (Gestor de Processos)
- **IA Generativa:** Google Gemini Pro
- **Geração de Planilhas:** Google Apps Script
- **Dependências Principais:** `axios`, `cors`, `dotenv`, `multer`, `xlsx`, `@google/generative-ai`

---

## 🚀 Instalação para Desenvolvimento Local

Siga estes passos para executar a aplicação na sua máquina local para testes e desenvolvimento.

### Pré-requisitos

- **Node.js:** Versão LTS (v18 ou v20+). Pode descarregá-lo em [nodejs.org](https://nodejs.org/).
- **Chave de API do Google:** Uma chave de API válida do Google AI Studio.

### Passos

1. **Clone o Projeto:**
    ```bash
    git clone [https://github.com/Sammytss/PlanoGenerator.git](https://github.com/Sammytss/PlanoGenerator.git)
    cd PlanoGenerator
    ```

2. **Instale as Dependências:**
    (O `package.json` está na raiz do projeto)
    ```bash
    npm install
    ```

3. **Configure o Backend:**
    - Navegue até `assets/backend-planilhas/`.
    - Crie um ficheiro chamado `.env`.
    - Adicione a sua chave de API:
      ```
      GEMINI_API_KEY=SUA_CHAVE_DE_API_AQUI
      ```

4. **Configure o Google Apps Script:**
    - Crie um novo projeto em [script.google.com](https://script.google.com).
    - Cole o conteúdo do seu ficheiro Apps Script (ex: `assets/AppScript/doPost_v52_16-09-25.js`) no editor.
    - Clique em **Implantar > Nova implantação** (Tipo: "App da Web", Acesso: "Qualquer pessoa").
    - Copie a **URL do app da Web** gerada.
    - Cole esta URL na constante `APPS_SCRIPT_URL` dentro do ficheiro `assets/backend-planilhas/server.js`.

5. **Execute o Servidor Backend:**
    A partir da pasta raiz do projeto:
    ```bash
    node assets/backend-planilhas/server.js
    ```
    O backend estará a rodar em `http://localhost:3000`.

6. **Execute o Frontend:**
    Basta abrir o ficheiro `index.html` diretamente no seu navegador.

---

## 💻 Instalação em Servidor de Produção (Ubuntu)

Este guia detalha como configurar o Plano Generator num servidor Ubuntu usando **Apache2** e **PM2**.

### 1. Preparação do Servidor (Apache & Git)

Conecte-se ao seu servidor via SSH:

```bash
# 1. Atualize os pacotes do sistema
sudo apt update && sudo apt upgrade -y

# 2. Instale o Apache, Git e Curl
sudo apt install apache2 git curl -y
````

### 2. Instalação do Node.js e PM2

A aplicação precisa do Node.js v18 ou mais recente. Verifique a sua versão:

```bash
node -v
```
Caso não tenha o Node.js instalado. Instale-o com o seguinte comando:

```bash
sudo apt install nodejs
sudo apt install npm
```
Se for v18+ (ex: v20.x), instale o PM2:
**Execute isto para conceder as permissões globais do Node.js**
```bash
sudo chown -R $(whoami) /usr/local/lib
sudo chown -R $(whoami) /usr/local/bin
```
**Agora podemos instalar o PM2 (sem sudo)**
```bash
npm install pm2 -g
```

### 3. Clonagem e Permissões do Projeto

Clone o repositório diretamente para a pasta `/var/www/`:

```bash
cd /var/www/
sudo git clone https://github.com/Sammytss/PlanoGenerator.git
sudo usermod -aG www-data $(whoami)
exit
```

Após reconectar, defina as permissões corretas:

```bash
cd /var/www/PlanoGenerator
sudo chown -R $(whoami):www-data .
sudo chmod -R 755 .
```

### 4. Configuração do Backend

 **1. Navegue para a pasta do backend**
 ```bash
cd assets/backend-planilhas/
```

**2. Crie o ficheiro .env para as suas chaves secretas**
```bash
nano .env
```

**3. Adicione sua Chave de API do Google AI ao ficheiro:**
```bash
    GEMINI_API_KEY=SUA_CHAVE_DE_API_AQUI
```

**4. (IMPORTANTE) Configure o Apps Script:**
   ***Certifique-se de que a constante APPS_SCRIPT_URL em server.js***
    **contém o URL de implantação do seu Google Apps Script.**

**5. Volte para a raiz do projeto e instale as dependências**
```bash
cd /var/www/PlanoGenerator
npm install
```
### 5. Executando o Backend com PM2

Inicie o servidor backend com PM2:

**1. A partir da raiz do projeto (/var/www/PlanoGenerator)**
   **Inicie o servidor com PM2 (sem sudo!)**
```bash
pm2 start assets/backend-planilhas/server.js --name PlanoGenerator
```
**2. Verifique se o processo está online**
```bash
pm2 list
```
**3. Salve a lista de processos (para reiniciar automaticamente com o servidor)**
```bash
pm2 save
```
**4. Gere e execute o comando de inicialização do PM2 com o sistema**
**(Copie e execute o comando que o PM2 irá mostrar)**
```bash
pm2 startup
```

### 6. Configurando o Apache como Proxy Reverso

 **1. Habilite os módulos necessários do Apache**
```bash
sudo a2enmod proxy proxy_http rewrite
```

**2. Edite a configuração do site padrão do Apache**
```bash
sudo nano /etc/apache2/sites-available/000-default.conf
```

**3. SUBSTITUA o conteúdo deste ficheiro pelo seguinte**
```bash
<VirtualHost *:80>
    
    # APONTA O APACHE PARA A PASTA DO SEU PROJETO
    DocumentRoot /var/www/PlanoGenerator
    
    # Configura o diretório do projeto para permitir o acesso
    <Directory /var/www/PlanoGenerator>
        Options Indexes FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>

    # Configura o Proxy Reverso para a API Node.js
    ProxyPreserveHost On
    ProxyPass /gerar-plano http://localhost:3000/gerar-plano
    ProxyPassReverse /gerar-plano http://localhost:3000/gerar-plano

    # Configuração de logs (padrão)
    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

**4. Salve e feche o editor (Ctrl+X, depois Y, depois Enter)**

**5. Teste a configuração do Apache**
```bash
sudo apache2ctl configtest
```
**6. Se a sintaxe estiver OK, reinicie o Apache**
```bash
sudo systemctl restart apache2
```

---

## ⚡ Workflow de Atualização

Para atualizar a aplicação no servidor após um git push:

```bash
cd /var/www/PlanoGenerator
git pull
npm install
pm2 restart PlanoGenerator
```

---

## 📁 Estrutura do Projeto
```
PlanoGenerator/
├── assets/
│   ├── AppScript/
│   │   └── doPost_v52_16-09-25.js
│   ├── backend-planilhas/
│   │   ├── .env
│   │   └── server.js
│   ├── css/
│   │   └── style.css
│   ├── Images/
│   │   └── (várias imagens .png, .svg)
│   └── js/
│       ├── calendar-init.js
│       ├── script.js
│       └── ui-interactions.js
├── node_modules/
├── .gitignore
├── index.html
├── package-lock.json
├── package.json
└── README.md
```
---

## 👤 Criador

Este projeto foi idealizado e desenvolvido por **Samuel Teles**.

LinkedIn: [linkedin.com/in/samuel-teles-dos-santos-662003237](https://linkedin.com/in/samuel-teles-dos-santos-662003237)


