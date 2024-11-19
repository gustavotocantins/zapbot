const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Cria uma nova instância do cliente
const client = new Client({
    authStrategy: new LocalAuth(), // Autenticação local, mantém você logado
});

// Gera o QR code para login no WhatsApp Web
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escaneie o QR Code para autenticar no WhatsApp');
});

// Quando o cliente estiver pronto para enviar e receber mensagens
client.on('ready', () => {
    console.log('O bot está pronto para enviar e receber mensagens!');
});

// Quando uma nova mensagem for recebida
client.on('message', (message) => {
    // Verifica se a mensagem foi enviada em um chat privado
    if (!message.isGroupMsg) {
        // Verifica se a mensagem recebida é "Papai noel é legal"
        if (message.body.toLowerCase() === 'papai noel é legal') {
            client
                .sendMessage(message.from, '(BOT) Testando aplicação...')
                .then(() => console.log('Mensagem de teste enviada com sucesso!'))
                .catch((error) => console.error('Erro ao enviar mensagem:', error));
        }
    }
});

// Iniciar o cliente
client.initialize();
