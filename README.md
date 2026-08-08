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
- [🩺 Solução de Problemas](#-solução-de-problemas)
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
- **Seleção de Unidade Escolar:** Escolha em cascata (Estado → Município → Unidade) com base na lista de unidades SENAI do [Portal da Indústria](https://www.portaldaindustria.com.br/senai/canais/transparencia/unidades-nos-estados/).
- **Modalidade do Curso:** Dropdown com categorias (Doutorado, Mestrado, Pós Graduação, Graduação, Habilitação técnica, Aprendizagem, Qualificação, Aperfeiçoamento, Cursos Livres). Para Aprendizagem, Qualificação, Aperfeiçoamento e Cursos Livres, a coluna SAEP é omitida na planilha.
- **Agendamento Flexível:** Um sistema de cálculo de datas híbrido que permite:
  - Selecionar datas de aula específicas e não sequenciais através de um calendário.
  - Definir um padrão de aulas recorrentes (ex: todas as segundas e quartas).
  - Suporte a cargas horárias diárias de **1, 2, 3, 4 ou 8 horas**.
  - Considerar feriados e períodos de férias para um cronograma preciso.
- **Central de Ajuda Integrada:** Um modal de ajuda que oferece duas formas de aprendizado:
  - **Guia Interativo:** Um tutorial passo a passo que guia o utilizador por cada campo do formulário.
  - **Tutorial em Vídeo:** Um modal que carrega e reproduz um vídeo explicativo diretamente.
- **Geração de Planilha Automatizada:** A aplicação comunica-se com um script do Google (Apps Script) para criar uma planilha Google Sheets profissional, formatada e pronta para uso.

### 📝 Ficha de Observação (`/ficha-observacao`)

Gera o instrumento de avaliação para qualquer item do planejamento, com os critérios elaborados pela IA segundo a MSEP (mensuração, objetividade, granularidade e transparência).

- **Dois métodos de descrição dos critérios**, conforme a MSEP (p.131-133):
  - **Dicotómico** (Escala de Cotejo): arguições respondidas com Sim/Não.
  - **Gradual**: quatro rubricas cumulativas por critério — método recomendado pela MSEP para capacidades socioemocionais.
- **Ficha interativa:** o docente marca o desempenho de cada aluno nas colunas *Autoavaliação* e *Avaliação*; o aproveitamento e o **conceito (A/B/C/D)** são calculados automaticamente pela escala da MSEP (p.155).
- **Filtro inteligente:** os itens cujo instrumento previsto é uma ficha de observação aparecem destacados e pré-selecionados.

### 🎯 Situação de Aprendizagem (`/situacao-aprendizagem`)

Elabora o documento completo da situação de aprendizagem seguindo a Etapa 2 da MSEP (p.137-143).

- **Uma situação por bloco de ~60 horas:** pela MSEP, uma situação de aprendizagem agrupa várias capacidades e não corresponde a um conhecimento isolado. Cada aba da planilha (limite de 60h) dá origem a uma situação.
- **Estratégias de aprendizagem desafiadoras:** Situação-Problema, Estudo de Caso, Projeto ou Pesquisa Aplicada — as quatro previstas na MSEP (p.114).
- **Conteúdo gerado:** contextualização, desafio, resultados esperados, estratégias de ensino, recursos e ambientes, critérios e instrumentos de avaliação, e o detalhamento em etapas de plano de aula.
- Na planilha, a coluna *Situação de Aprendizagem* passa a ser **mesclada por aba inteira**, com a referência à situação correspondente.

### 🔀 Navegação sem recarregar

As três páginas trocam entre si sem recarregar o navegador, para que **nada do que já foi preenchido se perca**.

A vista de cada página é guardada em memória como um **nó destacado do documento**, e não regenerada a partir do HTML. Essa distinção é o ponto central: um `<input type="file">` não pode ter o seu valor reposto por JavaScript, por segurança do navegador. Se o DOM fosse destruído e recriado, o PDF da Unidade Curricular e a Matriz SAEP já escolhidos seriam perdidos. Como o nó continua vivo, preservam-se campos de texto, datas, ficheiros selecionados, fichas já geradas e a posição de deslocamento.

Cada página continua a ser um ficheiro HTML servido pelo Express, pelo que **ligações diretas, atualização da página e os botões de avançar e retroceder do navegador continuam a funcionar**.

### 📤 Reaproveitamento e exportação

- **Importação de planilha:** as duas páginas aceitam o `.xlsx` de um planejamento já gerado, permitindo usá-las sem ter criado o plano na mesma sessão.
- **Sessão do navegador:** o plano gerado fica em `sessionStorage`. Nada é persistido em disco no servidor.
- **Exportação:** *Imprimir / Salvar em PDF* (nativo do navegador) e **Google Docs**, que devolve links para editar numa cópia da conta Google do docente, baixar em **DOCX** ou em **PDF**.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Node.js, Express.js
- **Servidor:** Apache2 (como Proxy Reverso), PM2 (Gestor de Processos)
- **IA Generativa:** Google Gemini via Vertex AI (`gemini-3.6-flash`, região `global`; configurável em `GEMINI_MODEL`)
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
    - Crie um ficheiro `.env` na **raiz do projeto**:
      ```
      VERTEX_PROJECT_ID=seu-projeto-gcp
      VERTEX_LOCATION=global
      GOOGLE_APPLICATION_CREDENTIALS=caminho/para/service-account.json
      ```
    - ⚠️ **`VERTEX_LOCATION` deve ser `global`.** Os modelos Gemini 3.x não são servidos em regiões concretas — ver [Solução de Problemas](#-solução-de-problemas).
    - (Opcional) `GEMINI_MODEL` sobrescreve o modelo, que por omissão é `gemini-3.6-flash`. Atualizar de versão é só mudar esta variável.
    - (Opcional) `APPS_SCRIPT_URL`, `LOGOTIPO_URL`, `PORT` e `CORS_ORIGINS` também podem ser definidos no `.env`.

4. **Configure o Google Apps Script:**
    - Crie um novo projeto em [script.google.com](https://script.google.com).
    - Cole o conteúdo do ficheiro `apps-script/doPost.js` no editor.
    - Em **⚙️ Configurações do projeto**, ative *"Mostrar o arquivo de manifesto appsscript.json no editor"* e substitua o manifesto pelo conteúdo de `apps-script/appsscript.json`.
    - No editor, selecione a função **`autorizarPermissoes`** e clique em **Executar**. Aceite as permissões solicitadas. ⚠️ **Este passo é obrigatório** — ver a nota abaixo.
    - Clique em **Implantar > Nova implantação** (Tipo: "App da Web", Executar como: "Eu", Acesso: "Qualquer pessoa").
    - Copie a **URL do app da Web** gerada.
    - Adicione ao `.env`: `APPS_SCRIPT_URL=https://script.google.com/.../exec` (ou edite `src/config/index.js` se preferir).

> ### ⚠️ Autorização OAuth ao atualizar o Apps Script
>
> O Apps Script deduz os escopos OAuth necessários a partir do código, mas **uma implantação já existente continua a correr com os escopos que foram autorizados anteriormente**. Publicar uma nova versão *não* desencadeia nova autorização.
>
> Por isso, sempre que o script passar a usar um serviço novo do Google, é preciso **executar uma função manualmente no editor** e aceitar as permissões. Sintoma de quem salta esta etapa:
>
> ```
> Exception: Você não tem permissão para chamar DocumentApp.create.
> Permissões necessárias: https://www.googleapis.com/auth/documents
> ```
>
> **Correção:** no editor, execute a função `autorizarPermissoes`, aceite as permissões e depois publique uma **nova versão** da implantação (Implantar → Gerenciar implantações → ✏️ → Versão: *Nova versão*).
>
> #### Se o Google não voltar a pedir consentimento
>
> Declarar os escopos em `appsscript.json` informa o Google do que o script precisa, mas **não concede nada**. A concessão OAuth pertence à conta Google, não ao projeto nem à versão — por isso não é implantada nem versionada.
>
> Quando já existe uma concessão para o projeto, o Google pode não reexibir o diálogo de consentimento mesmo com escopos novos no manifesto. Nesse caso:
>
> 1. Recarregue o editor (F5) e execute `autorizarPermissoes` de novo — a análise de escopos fica em cache na sessão.
> 2. Se persistir, **revogue o acesso** em [myaccount.google.com/permissions](https://myaccount.google.com/permissions), localizando o projeto do Apps Script. Volte ao editor e execute a função: o consentimento é pedido do zero, com o conjunto completo de escopos. *(Foi este passo que resolveu na prática.)*
> 3. Se ainda falhar apenas `script.external_request`, verifique se o administrador do Google Workspace bloqueia requisições externas a partir de scripts — restrição comum em contas institucionais.

5. **Execute o Servidor:**
    A partir da pasta raiz do projeto:
    ```bash
    npm start
    ```
    Ou: `node server.js`
    O servidor estará a rodar em `http://localhost:3000`.

6. **Acesse a Aplicação:**
    Abra o navegador em `http://localhost:3000`.


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

 **1. Navegue para a raiz do projeto**
 ```bash
cd /var/www/PlanoGenerator
```

**2. Crie o ficheiro .env para as suas chaves secretas**
```bash
nano .env
```

**3. Adicione sua Chave de API do Google AI ao ficheiro:**
```bash
GEMINI_API_KEY=SUA_CHAVE_DE_API_AQUI
APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

**4. (IMPORTANTE) Configure o Apps Script:**
   - Cole o conteúdo de `apps-script/doPost.js` no Google Apps Script e o de `apps-script/appsscript.json` no manifesto.
   - Execute a função `autorizarPermissoes` no editor e aceite as permissões (ver a nota sobre autorização OAuth acima).
   - Publique uma **nova versão** da implantação.
   - Certifique-se de que `APPS_SCRIPT_URL` no `.env` contém o URL de implantação do seu App da Web.

**5. Corrija a propriedade e instale as dependências:**
```bash
sudo chown -R $(whoami) .
rm -rf node_modules
rm -f package-lock.json
npm install
```
### 5. Executando o Servidor com PM2

Inicie o servidor com PM2:

**1. A partir da raiz do projeto (/var/www/PlanoGenerator)**
   **Inicie o servidor com PM2 (sem sudo!)**
```bash
pm2 start server.js --name PlanoGenerator
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
    
    # Redireciona TODO o tráfego para a aplicação Node.js segura
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

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

## 🩺 Solução de Problemas

### `Unexpected end of JSON input` / `Unterminated string in JSON`

O `gemini-2.5-flash` é um modelo de raciocínio: os tokens de *thinking* são **descontados do `maxOutputTokens`**. Se o orçamento for apertado, o modelo gasta parte dele a pensar e devolve o JSON cortado a meio, com `finishReason: MAX_TOKENS`.

Medição que originou os valores em `src/config/ai.js` (extração de 40 conhecimentos):

| Config | finishReason | thinking | saída | tempo |
|---|---|---|---|---|
| 8192, thinking automático | `MAX_TOKENS` | 1.666 | 6.512 | 48s |
| 8192, thinking desligado | `STOP` | — | 2.690 | 16s |
| 32768, thinking automático | `STOP` | 8.722 | 9.823 | 105s |

Por isso o projeto fixa um `thinkingBudget` explícito e baixo, com `maxOutputTokens` bastante acima dele — assim o espaço de saída deixa de depender de quanto o modelo decide pensar.

**Ao diagnosticar respostas incompletas, inspecione sempre `candidates[0].finishReason` e `usageMetadata.thoughtsTokenCount`.** A mensagem do `JSON.parse` sozinha não revela a causa.

### `404 NOT_FOUND` ao usar um modelo Gemini 3.x

Os modelos **Gemini 3.x só são servidos na região `global`**. Em regiões concretas, como `us-central1`, a chamada devolve `404 NOT_FOUND`.

A armadilha é que `models.list()` **lista** `gemini-3.5-flash` e `gemini-3.6-flash` mesmo quando configurado para `us-central1` — o catálogo de modelos do publisher é global, a disponibilidade de invocação não é. Não confie na listagem para concluir que um modelo está acessível: teste uma chamada real.

```bash
# .env
VERTEX_LOCATION=global
GEMINI_MODEL=gemini-3.6-flash
```

O arranque avisa quando esta combinação está errada, em vez de deixar falhar só na primeira geração.

### `429 RESOURCE_EXHAUSTED`

Quota do Vertex AI esgotada. A elaboração faz uma chamada por conhecimento, portanto uma UC com muitos tópicos consome quota rapidamente — especialmente com tentativas repetidas.

`src/services/aiRunner.js` repete automaticamente com espera exponencial (4s, 8s, 16s) antes de desistir, e informa o progresso ao utilizador. Se o erro for frequente, aumente a quota do projeto no Vertex AI.

### Ausência do logotipo nos Google Docs

Falta o escopo `script.external_request` na autorização do Apps Script. Ver a nota sobre [autorização OAuth](#️-autorização-oauth-ao-atualizar-o-apps-script).

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
├── apps-script/
│   ├── appsscript.json         # Manifesto: escopos OAuth e configuração do App da Web
│   └── doPost.js               # Apps Script: planilha + Google Docs (ficha e situação)
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── documentos.css      # Ficha, situação e estilos de impressão (A4)
│   ├── data/
│   │   └── unidades-senai.json # Unidades SENAI por estado/município
│   ├── Images/
│   │   └── (imagens .png, .svg)
│   └── js/
│       ├── calendar-init.js
│       ├── ficha-observacao.js      # Página da Ficha de Observação
│       ├── icons.js                 # Sprite de ícones SVG + helper Icons.html()
│       ├── plano-store.js           # Plano em sessionStorage + exportação
│       ├── script.js
│       ├── situacao-aprendizagem.js # Página da Situação de Aprendizagem
│       ├── spa.js                   # Navegação sem recarregar (cache de DOM destacado)
│       └── ui-interactions.js
├── src/
│   ├── config/
│   │   ├── ai.js               # Configuração Vertex AI
│   │   ├── index.js            # Variáveis de ambiente, CORS, URLs
│   │   └── upload.js           # Configuração Multer (PDF, matriz e planilha)
│   └── services/
│       ├── aiRunner.js         # Repetição em 429, validação de finishReason e JSON
│       ├── docExporter.js      # Criação de Google Docs (links DOCX/PDF)
│       ├── fichaGenerator.js   # Critérios dicotómicos e graduais (MSEP)
│       ├── instrumentos.js     # Normalização dos instrumentos de avaliação
│       ├── planGenerator.js    # Lógica de geração do plano
│       ├── planParser.js       # Importação de uma planilha .xlsx já gerada
│       └── situacaoGenerator.js # Agrupamento por 60h e conteúdo da situação
├── .env                        # Chaves (VERTEX_PROJECT_ID, APPS_SCRIPT_URL)
├── .gitignore
├── ficha-observacao.html
├── index.html
├── package.json
├── package-lock.json
├── README.md
├── server.js                   # Entrypoint Express (servidor + rotas)
└── situacao-aprendizagem.html
```

### Rotas HTTP

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Formulário de planejamento docente |
| `GET` | `/ficha-observacao` | Página da Ficha de Observação |
| `GET` | `/situacao-aprendizagem` | Página da Situação de Aprendizagem |
| `POST` | `/gerar-plano` | Gera a planilha (resposta em streaming) |
| `POST` | `/api/importar-plano` | Importa um `.xlsx` já gerado |
| `POST` | `/api/ficha-observacao` | Elabora os critérios da ficha |
| `GET` | `/api/estrategias-desafiadoras` | Lista as 4 estratégias da MSEP |
| `POST` | `/api/situacoes/agrupar` | Agrupa os conhecimentos em blocos de 60h |
| `POST` | `/api/situacao-aprendizagem` | Elabora a situação de aprendizagem |
| `POST` | `/api/exportar-documento` | Cria o Google Docs e devolve os links |
---

## 👤 Criador

Este projeto foi idealizado e desenvolvido por **Samuel Teles**.

LinkedIn: [linkedin.com/in/samuel-teles-dos-santos-662003237](https://linkedin.com/in/samuel-teles-dos-santos-662003237)



