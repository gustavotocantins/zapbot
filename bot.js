const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  // Para manipulação de arquivos

let clientsInProgress = {};  // Armazena o estado de cada cliente

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
        console.log(message.body);

        if (!clientsInProgress[message.from]) {
            // Marca o cliente como em atendimento e envia a mensagem de boas-vindas
            clientsInProgress[message.from] = { stage: 1 }; // Inicia no estágio 1
            client
                .sendMessage(message.from, 'Olá! Bem-vindo ao nosso atendimento. Como posso ajudar?\n\n1 - Ver Menu\n2 - Falar com Atendente\n3 - Sair')
                .then(() => console.log('Mensagem de boas-vindas enviada com sucesso!'))
                .catch((error) => console.error('Erro ao enviar mensagem:', error));
        } else {
            // Verifica o estado do cliente e responde de acordo
            handleClientResponse(client, message);
        }
    }
});

// Função para gerenciar a resposta do cliente
function handleClientResponse(client, message) {
    const clientState = clientsInProgress[message.from];

    switch (message.body.toLowerCase()) {
        case '1': // Opção 1 - Enviar Menu
            if (clientState.stage === 1) {
                client
                    .sendMessage(message.from, 'Aqui está o nosso menu:\n\n🍕 Pizza - R$20\n🍔 Hambúrguer - R$15\n🥤 Refrigerante - R$5\n\nDigite o nome do item para fazer o pedido ou "Voltar" para ver as opções novamente.')
                    .then(() => console.log('Menu enviado com sucesso!'))
                    .catch((error) => console.error('Erro ao enviar o menu:', error));
                clientState.stage = 2; // Avança para o próximo estágio de pedido
            }
            break;
        case '2': // Opção 2 - Falar com Atendente
            if (clientState.stage === 1) {
                client
                    .sendMessage(message.from, 'Um atendente estará com você em breve.')
                    .then(() => console.log('Mensagem de atendimento enviada com sucesso!'))
                    .catch((error) => console.error('Erro ao enviar mensagem de atendimento:', error));
            }
            break;
        case '3': // Opção 3 - Sair
            client
                .sendMessage(message.from, 'Obrigado por entrar em contato. Até logo!')
                .then(() => {
                    console.log('Mensagem de despedida enviada com sucesso!');
                    // Remove o cliente do estado para permitir novo atendimento no futuro
                    delete clientsInProgress[message.from];
                })
                .catch((error) => console.error('Erro ao enviar mensagem de despedida:', error));
            break;
        case 'voltar': // Retorna ao menu inicial
            if (clientState.stage === 2) {
                client
                    .sendMessage(message.from, 'Voltando ao menu principal. Como posso ajudar?\n\n1 - Ver Menu\n2 - Falar com Atendente\n3 - Sair')
                    .then(() => console.log('Mensagem de volta ao menu principal enviada com sucesso!'))
                    .catch((error) => console.error('Erro ao enviar mensagem de volta ao menu principal:', error));
                clientState.stage = 1; // Volta ao estágio inicial para permitir nova escolha
            }
            break;
        default:
            // Se o cliente responder com um pedido
            if (clientState.stage === 2 && (message.body.toLowerCase() === 'pizza' || message.body.toLowerCase() === 'hambúrguer' || message.body.toLowerCase() === 'refrigerante')) {
                client
                    .sendMessage(message.from, `Pedido recebido: ${message.body}. Estamos preparando!`)
                    .then(() => console.log('Confirmação de pedido enviada com sucesso!'))
                    .catch((error) => console.error('Erro ao confirmar o pedido:', error));
                clientState.stage = 1; // Volta ao estágio inicial após o pedido
            } else {
                // Resposta padrão se a entrada não for reconhecida
                client
                    .sendMessage(message.from, 'Desculpe, não entendi. Por favor, escolha uma das opções:\n\n1 - Ver Menu\n2 - Falar com Atendente\n3 - Sair')
                    .then(() => console.log('Mensagem de opções reenviada com sucesso!'))
                    .catch((error) => console.error('Erro ao reenviar opções:', error));
            }
    }
}

// Iniciar o cliente
client.initialize();
