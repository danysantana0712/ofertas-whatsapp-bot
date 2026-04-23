const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { MongoClient } = require('mongodb');
const https = require('https');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ==================== CONFIGURAÇÕES VIA VARIÁVEIS DE AMBIENTE ====================
const GRUPO_ID = process.env.GRUPO_ID || 'SEU_GRUPO_ID_AQUI';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'shopee_bot_db';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'produtos';
const MIN_INTERVALO = (parseInt(process.env.MIN_INTERVALO) || 2) * 60 * 1000;
const MAX_INTERVALO = (parseInt(process.env.MAX_INTERVALO) || 5) * 60 * 1000;
const PORT = process.env.PORT || 3000;
// ================================================================================

// Variáveis globais
let db = null;
let produtosCollection = null;
let client = null;
let isBotReady = false;

// Criar servidor HTTP para healthcheck (Railway precisa)
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            botReady: isBotReady,
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            message: 'Shopee WhatsApp Bot',
            status: isBotReady ? 'online' : 'starting'
        }));
    }
});

server.listen(PORT, () => {
    console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});

// Conectar ao MongoDB
async function conectarMongoDB() {
    try {
        const mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        produtosCollection = db.collection(COLLECTION_NAME);
        console.log('✅ Conectado ao MongoDB!');
        console.log(`📁 Banco: ${DB_NAME} | Coleção: ${COLLECTION_NAME}`);
        return true;
    } catch (err) {
        console.error('❌ Erro ao conectar no MongoDB:', err.message);
        return false;
    }
}

// Baixar imagem da URL
function baixarImagem(url, caminhoDestino) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(caminhoDestino);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Status: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(caminhoDestino);
            });
        }).on('error', (err) => {
            fs.unlink(caminhoDestino, () => {});
            reject(err);
        });
    });
}

// Buscar produto novo (não enviado) ou aleatório se não houver novo
async function buscarProduto() {
    try {
        // 1. Primeiro tenta buscar um produto NUNCA enviado
        const produtoNovo = await produtosCollection.findOne({
            status: 'concluido',
            $or: [
                { enviado: { $exists: false } },
                { enviado: false }
            ]
        });

        if (produtoNovo) {
            console.log(`🆕 Produto NOVO encontrado: ${produtoNovo.nome}`);
            return { produto: produtoNovo, isNovo: true };
        }

        // 2. Se não houver novo, busca um aleatório já enviado
        const produtoAntigo = await produtosCollection.aggregate([
            { $match: { status: 'concluido', enviado: true } },
            { $sample: { size: 1 } }
        ]).toArray();

        if (produtoAntigo.length > 0) {
            console.log(`♻️  Produto antigo (repetido): ${produtoAntigo[0].nome}`);
            return { produto: produtoAntigo[0], isNovo: false };
        }

        return { produto: null, isNovo: false };
    } catch (err) {
        console.error('❌ Erro ao buscar produto:', err);
        return { produto: null, isNovo: false };
    }
}

// Marcar produto como enviado
async function marcarComoEnviado(produtoId) {
    try {
        await produtosCollection.updateOne(
            { _id: produtoId },
            { 
                $set: { 
                    enviado: true,
                    data_envio: new Date()
                }
            }
        );
        console.log('✅ Produto marcado como enviado no banco');
    } catch (err) {
        console.error('❌ Erro ao marcar como enviado:', err);
    }
}

// Formatar mensagem do produto
function formatarMensagem(produto) {
    let mensagem = `🔥 *OFERTA SHOPEE* 🔥\n\n`;
    mensagem += `📦 *${produto.nome}*\n\n`;
    
    // Calcular desconto
    let descontoTexto = '';
    if (produto.preco_de && produto.preco) {
        const precoDeNum = parseFloat(produto.preco_de.replace(/[^0-9,]/g, '').replace(',', '.'));
        const precoPorNum = parseFloat(produto.preco.replace(/[^0-9,]/g, '').replace(',', '.'));
        
        if (!isNaN(precoDeNum) && !isNaN(precoPorNum) && precoDeNum > precoPorNum) {
            const percentual = Math.round(((precoDeNum - precoPorNum) / precoDeNum) * 100);
            descontoTexto = ` 🎯 *-${percentual}% OFF*`;
        }
    }
    
    if (produto.preco_de) {
        mensagem += `❌ ~~De: ${produto.preco_de}~~\n`;
    }
    
    mensagem += `✅ *Por: ${produto.preco}*${descontoTexto}\n\n`;
    mensagem += `🛒 *Comprar agora:*\n${produto.link}\n\n`;
    mensagem += `⚡ Aproveite antes que acabe!\n\n`;
    mensagem += `ℹ️ *Os preços podem sofrer alterações sem aviso prévio.*`;
    
    return mensagem;
}

// Enviar produto para o grupo
async function enviarProduto() {
    if (!isBotReady) {
        console.log('⏳ Bot ainda não está pronto...');
        return;
    }

    if (GRUPO_ID === 'SEU_GRUPO_ID_AQUI') {
        console.log('⚠️  ATENÇÃO: Configure o GRUPO_ID no código!');
        return;
    }

    try {
        console.log('\n📦 Buscando produto...');
        const { produto, isNovo } = await buscarProduto();
        
        if (!produto) {
            console.log('⚠️  Nenhum produto encontrado no banco.');
            return;
        }

        // Baixar imagem temporariamente
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        const imagemPath = path.join(tempDir, `produto_${Date.now()}.jpg`);
        
        try {
            await baixarImagem(produto.imagem, imagemPath);
            console.log('📸 Imagem baixada com sucesso');

            // Enviar mensagem com imagem
            const media = MessageMedia.fromFilePath(imagemPath);
            const mensagem = formatarMensagem(produto);
            
            await client.sendMessage(GRUPO_ID, media, { caption: mensagem });
            console.log(`✅ Produto ${isNovo ? 'NOVO' : 'ANTIGO'} enviado com sucesso!`);

            // Limpar arquivo temporário
            fs.unlinkSync(imagemPath);

            // Marcar como enviado se for novo
            if (isNovo) {
                await marcarComoEnviado(produto._id);
            }

        } catch (imgErr) {
            console.log('⚠️  Erro ao baixar imagem, enviando apenas texto...');
            const mensagem = formatarMensagem(produto);
            await client.sendMessage(GRUPO_ID, mensagem);
            console.log(`✅ Produto ${isNovo ? 'NOVO' : 'ANTIGO'} enviado (apenas texto)`);

            if (isNovo) {
                await marcarComoEnviado(produto._id);
            }
        }

    } catch (err) {
        console.error('❌ Erro ao enviar produto:', err);
    }
}

// Agendar próximo envio
function agendarProximoEnvio() {
    const intervalo = Math.floor(Math.random() * (MAX_INTERVALO - MIN_INTERVALO + 1)) + MIN_INTERVALO;
    const minutos = Math.floor(intervalo / 60000);
    
    console.log(`\n⏰ Próximo produto será enviado em ~${minutos} minutos`);
    
    setTimeout(async () => {
        await enviarProduto();
        agendarProximoEnvio();
    }, intervalo);
}

// Inicializar WhatsApp Client
function inicializarWhatsApp() {
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: '/app/.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
        }
    });

    // QR Code
    client.on('qr', (qr) => {
        console.log('\n--- ESCANEIE O QR CODE ABAIXO ---');
        qrcode.generate(qr, { small: true });
        console.log('\n⚠️  QR Code gerado! Escaneie com seu WhatsApp.');
    });

    // Bot pronto
    client.on('ready', async () => {
        console.log('\n✅ BOT ONLINE!');
        isBotReady = true;

        console.log(`📢 Grupo configurado: ${GRUPO_ID}`);
        console.log('🚀 Iniciando envio automático de produtos...\n');
        
        // Envia primeiro produto imediatamente
        await enviarProduto();
        // Agenda próximos
        agendarProximoEnvio();
    });

    // Comando !id (apenas para obter ID do grupo)
    client.on('message_create', async (msg) => {
        if (msg.body === '!id') {
            const chat = await msg.getChat();
            msg.reply(`O ID deste grupo é:\n\`${msg.from}\``);
            console.log(`\n📝 ID do grupo: ${msg.from}`);
            console.log('   Copie este ID e configure na variável GRUPO_ID!\n');
        }
        
        if (msg.body === '!grupos') {
            const chats = await client.getChats();
            const grupos = chats.filter(chat => chat.isGroup);
            
            let resposta = '*Grupos encontrados:*\n\n';
            grupos.forEach((grupo, index) => {
                resposta += `${index + 1}. *${grupo.name}*\nID: \`${grupo.id._serialized}\`\n\n`;
            });
            
            msg.reply(resposta);
            console.log('\n📋 Lista de grupos enviada');
        }
    });

    // Tratamento de erros
    client.on('auth_failure', msg => console.error('❌ Falha na autenticação:', msg));
    client.on('disconnected', () => {
        console.log('⚠️  Bot desconectado');
        isBotReady = false;
        // Tenta reconectar após 5 segundos
        setTimeout(() => {
            console.log('🔄 Tentando reconectar...');
            client.initialize();
        }, 5000);
    });

    client.initialize();
}

// Iniciar tudo
async function iniciar() {
    console.log('🚀 Iniciando Bot de Ofertas Shopee...\n');
    
    // Conectar ao MongoDB primeiro
    const mongoConectado = await conectarMongoDB();
    if (!mongoConectado) {
        console.log('⚠️  Continuando sem MongoDB...');
    }
    
    // Inicializar WhatsApp
    inicializarWhatsApp();
}

// Tratamento de erros globais
process.on('unhandledRejection', (err) => {
    console.error('❌ Erro não tratado:', err);
});

process.on('SIGINT', () => {
    console.log('\n👋 Encerrando bot...');
    server.close();
    process.exit(0);
});

// Iniciar
iniciar();
