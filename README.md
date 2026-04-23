# 🤖 Bot de Ofertas Shopee - WhatsApp

Bot automatizado para enviar ofertas da Shopee para grupos do WhatsApp, com integração ao MongoDB.

## ✨ Funcionalidades

- 🔄 Envio automático de produtos a cada 2-5 minutos
- 🆕 Prioridade para produtos novos (não enviados)
- ♻️ Repete produtos antigos quando não há novos
- 📸 Download e envio de imagens dos produtos
- 💰 Cálculo automático de desconto em %
- 🌐 Servidor HTTP para healthcheck (Railway)

## 📁 Estrutura de Arquivos

```
.
├── Dockerfile          # Configuração do container
├── healthcheck.js      # Healthcheck para Railway
├── index.js           # Código principal do bot
├── package.json       # Dependências
├── .env.example       # Exemplo de variáveis de ambiente
├── .gitignore         # Arquivos ignorados pelo Git
└── README.md          # Este arquivo
```

## 🚀 Deploy no Railway

### Passo 1: Preparar o Código

1. **Crie uma pasta separada** para o bot do WhatsApp (não misture com o bot do Telegram)

2. **Copie todos os arquivos** deste projeto para a pasta

3. **Crie um arquivo `.gitignore`**:
```gitignore
node_modules/
.env
temp/
.wwebjs_auth/
*.log
```

### Passo 2: Criar Repositório Git

```bash
# Na pasta do projeto
git init
git add .
git commit -m "Initial commit"

# Crie um repositório no GitHub e execute:
git remote add origin https://github.com/seu-usuario/shopee-whatsapp-bot.git
git push -u origin main
```

### Passo 3: Configurar no Railway

1. **Acesse** [railway.app](https://railway.app) e faça login

2. **Clique em "New Project"** → "Deploy from GitHub repo"

3. **Selecione** o repositório do bot do WhatsApp

4. **Clique em "Add Variables"** e configure:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `GRUPO_ID` | `120363426142514889@g.us` | ID do grupo do WhatsApp |
| `MONGO_URI` | `mongodb+srv://...` | String de conexão do MongoDB |
| `DB_NAME` | `shopee_bot_db` | Nome do banco de dados |
| `COLLECTION_NAME` | `produtos` | Nome da coleção |
| `MIN_INTERVALO` | `2` | Intervalo mínimo (minutos) |
| `MAX_INTERVALO` | `5` | Intervalo máximo (minutos) |

5. **Clique em "Deploy"**

### Passo 4: Configurar WhatsApp (Primeira Vez)

1. **Abra os logs** do serviço no Railway (aba "Logs")

2. **Aguarde o QR Code** aparecer nos logs

3. **Escaneie o QR Code** com o WhatsApp do seu celular:
   - Abra WhatsApp → Configurações → Dispositivos vinculados
   - Clique em "Vincular dispositivo"
   - Escaneie o QR Code dos logs

4. **Aguarde** o bot ficar "ONLINE"

### Passo 5: Verificar Funcionamento

- O bot começará a enviar produtos automaticamente
- Verifique os logs para acompanhar o envio
- O healthcheck fica disponível em: `https://seu-app.up.railway.app/health`

## 🔧 Comandos Disponíveis

No grupo do WhatsApp, envie:

- `!id` - Obtém o ID do grupo
- `!grupos` - Lista todos os grupos (para debug)

## 📊 Monitoramento

### Logs no Railway
- Acesse a aba "Logs" no dashboard do Railway
- Acompanhe o envio de produtos e possíveis erros

### Healthcheck
```bash
curl https://seu-app.up.railway.app/health
```

Retorna:
```json
{
  "status": "ok",
  "botReady": true,
  "timestamp": "2025-04-22T10:30:00.000Z"
}
```

## 🔄 Atualizando o Bot

Para atualizar o código:

```bash
git add .
git commit -m "Atualização"
git push
```

O Railway faz deploy automático!

## ⚠️ Importante

### Persistência de Sessão
- A sessão do WhatsApp é salva em `/app/.wwebjs_auth`
- O Railway persiste este diretório entre reinicializações
- Se precisar reconectar, delete o volume e escaneie o QR novamente

### Limitações do Plano Gratuito
- O plano gratuito do Railway "dorme" após inatividade
- Para manter sempre online, use o plano pago ($5/mês) ou configure um ping externo

### Não Misture com o Bot do Telegram
- Use repositórios separados
- Variáveis de ambiente separadas
- Serviços separados no Railway

## 🛠️ Troubleshooting

### Bot não conecta
- Verifique se o `GRUPO_ID` está correto
- Verifique a string do MongoDB
- Veja os logs para erros específicos

### Sessão expirada
- Delete o volume `.wwebjs_auth` no Railway
- Reinicie o serviço
- Escaneie o QR Code novamente

### Imagens não carregam
- Verifique se a URL da imagem está acessível
- O bot tenta enviar só o texto se a imagem falhar

## 📄 Licença

ISC
