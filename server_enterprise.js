const { Client, LocalAuth } = require('whatsapp-web.js');

/**
 * INICIALIZAÇÃO OTIMIZADA DO CLIENTE
 * Focada em contornar bugs crônicos (Detached Frame, Zumbis, OOM Killer) 
 * reportados no GitHub para servidores ultra-restritos (ex: 1 vCPU, 1GB RAM).
 */

const client = new Client({
    // Preserva a sessão localmente para evitar a necessidade de ler o QR Code a cada restart
    authStrategy: new LocalAuth(),
    
    puppeteer: {
        headless: true,
        args: [
            // FLAGS EXTREMAS DE OTIMIZAÇÃO (Obrigatórias em VMs de baixo custo)
            // Previnem o OOM (Out of Memory) e erros de sandbox no Linux
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Mitiga crashs em containers Docker mapeando memória de forma eficiente
            '--disable-accelerated-2d-canvas',
            '--single-process', // Consolida as threads do Chromium em um único processo, reduzindo gargalos de CPU
            '--disable-gpu' // Sem interface gráfica instalada no server, o GPU é inútil
        ]
    }
});

// ==========================================
// 1. BLOQUEIO DE RECURSOS VISUAIS
// Previne: Atraso colossal no evento "ready" e lentidão na sincronização de contatos.
// ==========================================
client.on('ready', async () => {
    console.log('[SISTEMA] Cliente do WhatsApp carregado e pronto!');

    const page = client.pupPage;

    try {
        await page.setRequestInterception(true);
        
        page.on('request', (req) => {
            const blockedResourceTypes = ['image', 'stylesheet', 'font', 'media'];
            
            // Ao rodar em modo Headless, o bot não "vê" imagens nem precisa de fontes e CSS.
            // Abortar essas requisições libera uma enxurrada de processamento de rede e CPU.
            // Solução comprovada no GitHub para o problema da API travar eternamente
            // ao tentar sincronizar avatares (fotos de perfil) de listas densas de contatos.
            if (blockedResourceTypes.includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log('[OTIMIZAÇÃO] Interceptador de recursos (Resource Blocker) ativado com sucesso.');

        // ==========================================
        // 2. PURGA AUTOMÁTICA DE MEMÓRIA (ANTI-VAZAMENTO)
        // Previne: Queda agressiva pelo OOM Killer do Linux ao fim de alguns dias.
        // ==========================================
        await page.evaluate(() => {
            // A cada 15 minutos, limpamos a lixeira da memória RAM nativa do Chromium
            setInterval(() => {
                try {
                    if (window.require) {
                        const WAWebCollections = window.require('WAWebCollections');
                        // A propriedade Store.Msg / WAWebCollections.Msg acumula todas as mensagens recebidas e 
                        // enviadas (inclusive base-64 media). Com o tempo, a aba do navegador morre por falta de RAM.
                        if (WAWebCollections && WAWebCollections.Msg) {
                            const Msg = WAWebCollections.Msg;
                            const MAX_MESSAGES = 100;
                            
                            if (Msg.models.length > MAX_MESSAGES) {
                                const excess = Msg.models.length - MAX_MESSAGES;
                                const messagesToRemove = Msg.models.slice(0, excess);
                                
                                // Poda cirurgicamente o cache interno, garantindo imortalidade ao container
                                Msg.remove(messagesToRemove);
                                console.log(`[GARBAGE COLLECTOR] ${excess} mensagens obsoletas purgadas da memória RAM.`);
                            }
                        }
                    }
                } catch (e) {
                    // Ignoramos silenciosamente para não interromper a Thread do V8
                }
            }, 15 * 60 * 1000); 
        });

        console.log('[OTIMIZAÇÃO] Purga de RAM na coleção Msg (Store) inserida com sucesso.');

    } catch (error) {
        console.error('[ERRO] Falha ao injetar melhorias de memória na página:', error);
    }
});

// ==========================================
// 3. RECUPERAÇÃO DE CRASH SILENCIOSO (AUTO-HEALING)
// Previne: Erros do tipo "Detached Frame" e Processos Bot Zumbis.
// ==========================================
// Rotina severa: se algum serviço vital cair, matamos a aplicação Node por completo para o PM2 reerguê-la "zerada"
const restartByPM2 = (reason, customBlockDetail = '') => {
    console.error(`\n[FALHA ESTRUTURAL] ${reason} | Motivo: ${customBlockDetail}`);
    console.error('[AUTO-HEALING] Matando o processo agressivamente via process.exit(1) para ativar reinicialização pelo PM2 do Linux...');
    process.exit(1); 
};

// Monitoramos as anomalias o mais cedo possível, pareando a Promise do .initialize()
client.initialize().then(() => {
    
    // a) Queda súbita de soquetes ou travamento silencioso do Chromium
    if (client.pupBrowser) {
        client.pupBrowser.on('disconnected', () => {
            restartByPM2('O Navegador base sofreu Desconexão Súbita (Caiu/Fechado)');
        });
        
        // TargetDestroyed geralmente prevê a fúria do OOM Killer do Linux assassinando a aba primária 
        client.pupBrowser.on('targetdestroyed', (target) => {
            if (target.type() === 'page') {
                restartByPM2('Alvo de renderização Destruído', 'Provável pane paralela na VM. A aba principal do bot foi aniquilada.');
            }
        });
    }

    // b) O infame erro "Execution context was destroyed, most likely because of a navigation." ou "Detached Frame"
    if (client.pupPage) {
        client.pupPage.on('error', (err) => {
            restartByPM2('Fatal Error interno da Aba isolada do WhatsApp', err.message);
        });
    }
    
}).catch(err => {
    console.error('\n[FATAL] O Client base de dados não conseguiu sequer iniciar. O Puppeteer emitiu pane na largada:', err);
    process.exit(1);
});

// c) Segurança extra de protocolo nativo da biblioteca sobre re-autenticação mal sucedida
client.on('disconnected', (reason) => {
    // Isso captura tanto o desconectar de sessão no Painel da Web, quanto banimentos temporários do WWebJS
    restartByPM2('Sessão Descartada/Desconectada pelo backend Nativo', reason);
});

// ==========================================
// SETUP PADRÃO
// ==========================================
const qrcode = require('qrcode-terminal');

client.on('qr', (qr) => {
    console.log('Leia o QRCode para autenticar sua sessão:');
    qrcode.generate(qr, { small: true });
});

client.on('message', async (msg) => {
    if (msg.body === '!status') {
        const mem = process.memoryUsage();
        await msg.reply(`*VM NODE.JS ONLINE*\nMemória Resident Set Size (RSS): ~${Math.round(mem.rss / 1024 / 1024)} MB`);
    }
});
