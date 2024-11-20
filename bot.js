const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  // Para manipulação de arquivos
const axios = require('axios');


let clientsInProgress = {};  // Armazena o estado de cada cliente
let clientTimers = {};  // Armazena os temporizadores para cada cliente

// Cria uma nova instância do cliente
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }, // Autenticação local, mantém você logado
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

async function getBairro(latitude, longitude) {
    try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
            params: {
                lat: latitude,
                lon: longitude,
                format: 'json',
                addressdetails: 1,
            },
            headers: {
        'User-Agent': 'Bot/1.0 (your.email@example.com)'  // Adicione seu user-agent personalizado aqui
    }
        });

        // Verifica se o endereço contém o bairro
        const address = response.data.address;
        if (address && address.suburb) {
            return address.suburb; // Retorna o nome do bairro
        } else if (address && address.neighbourhood) {
            return address.neighbourhood; // Retorna o nome do bairro (caso o bairro esteja em "neighbourhood")
        } else {
            return 'Bairro não encontrado'; // Caso o bairro não seja encontrado
        }
    } catch (error) {
        console.error('Erro ao obter bairro:', error);
        return 'Erro ao obter o bairro';
    }
}

// Quando uma nova mensagem for recebida
client.on('message', (message) => {
    // Verifica se a mensagem foi enviada em um chat privado
    if (!message.isGroupMsg) {
        console.log(message.body);

        if (!clientsInProgress[message.from]) {
            // Marca o cliente como em atendimento e envia a mensagem de boas-vindas
            clientsInProgress[message.from] = { stage: 1, cart: []}; // Inicia no estágio 1
            client.getContactById(message.from).then(contact => {
                const name = contact.pushname || "Cliente";
                client
                    .sendMessage(message.from, `*Olá, ${name}! 👋*\n*Bem-vindo(a) à Pizzaria Reis! 🍕✨*\nEstamos super felizes em ter você aqui! 😄 Como podemos tornar sua experiência deliciosa hoje?`)
                    .then(() => console.log('Mensagem de boas-vindas enviada com sucesso!'))
                    .catch((error) => console.error('Erro ao enviar mensagem:', error));
            });
            setTimeout(() => {
                client.sendMessage(message.from,'_Dicas: Cardápios, Taxa de entrega, Localização, Horários, Redes Sociais e etc.._')
            }, 1000);

            // Inicia o temporizador de 5 minutos
            startInactivityTimer(message.from);
        } else {
            // Verifica o estado do cliente e responde de acordo
            handleClientResponse(client, message);
        }
    }
});

// Função para gerenciar a resposta do cliente
async function handleClientResponse(client, message) {
    const clientState = clientsInProgress[message.from];

    // Reinicia o temporizador sempre que o cliente interage
    resetInactivityTimer(message.from);

    switch (true) {
        case ['pratos', 'cardápio', 'cardapio', 'menu','1','o que tem hoje', 'oque tem hoje','prato'].some(term => message.body.toLowerCase().includes(term)):
            if (clientState.stage === 1) {
                client
                    .sendMessage(message.from, 'Aqui está o nosso menu:\n\n🍕 Pizza - R$20\n🍔 Hambúrguer - R$15\n🥤 Refrigerante - R$5\n\nDigite o nome do item para fazer o pedido ou "Voltar" para ver as opções novamente.')
                    .then(() => console.log('Menu enviado com sucesso!'))
                    .catch((error) => console.error('Erro ao enviar o menu:', error));
                
                clientState.stage = 2; // Avança para o próximo estágio de pedido
            }
            break;
            
        case ['taxa de entrega', 'frete', 'taxa', 'entrega','2'].some(term => message.body.toLowerCase().includes(term)): // Opção 2 - Falar com Atendente
            if (clientState.stage === 1) {
                client
                    .sendMessage(message.from, 'Me mande a sua localização que vou verificar o valor da taxa de entrega.\nAndroid: clique no clip 📎, selecione localização e escolha a opção “localização atual”.\niPhone: clique no ➕, selecione localização e escolha a opção “localização atual”.')
                    .then(() => console.log('Mensagem de atendimento enviada com sucesso!'))
                    .catch((error) => console.error('Erro ao enviar mensagem de atendimento:', error));
                    clientState.stage = 3;
            }
            break;
        case ['endereço','endereco', 'local', 'localizacao', 'localização','3'].some(term => message.body.toLowerCase().includes(term)): 
                if (clientState.stage === 1){
                    client.sendMessage(message.from, "Estamos esperando por você! 😀");
                    setTimeout(() => {
                        client
                            .sendMessage(message.from, "https://maps.app.goo.gl/5ZjM3K9SUeP41JV27")
                            .then(() => console.log('Localização enviada!'))
                            .catch((error) => console.error('Erro ao enviar mensagem:', error))
                    }, 1000);
                    setTimeout(() => {
                        client.sendMessage(message.from, "Você gostaria de ver nosso cardápio? 😋");
                    }, 5000);
                    
                }clientState.stage = 3;break;
            case ['horário','horario', 'dias da semana', 'horarios', 'horários',].some(term => message.body.toLowerCase().includes(term)): 
                if (clientState.stage === 1){
                    client.sendMessage(message.from, "*Horário da Pizzaria Reis 🍕✨*\n\n*📅 Segunda a Sexta:* 18h às 23h\n*📅 Sábados e Domingos:* 17h às 00h\n\nEstamos prontos para tornar seu momento mais saboroso! 😄");                    
                }clientState.stage = 1;break;

            case clientState.stage === 2 && ['pizza', 'hambúrguer', 'refrigerante'].includes(message.body.toLowerCase()):
                clientState.currentItem = message.body.toLowerCase(); // Armazena o item selecionado
                clientState.stage = 3; // Avança para a próxima etapa (escolher quantidade)
                client
                    .sendMessage(message.from, `Quantas unidades de "${message.body}" você deseja adicionar ao carrinho?`)
                    .then(() => console.log('Perguntando quantidade.'))
                    .catch((error) => console.error('Erro ao perguntar quantidade:', error));
                break;

            case clientState.stage === 3 && !isNaN(parseInt(message.body)): // Cliente responde com a quantidade
                const quantidade = parseInt(message.body);
                clientState.cart.push({ produto: clientState.currentItem, quantidade }); // Adiciona ao carrinho
                clientState.currentItem = null; // Limpa o item atual
                clientState.stage = 2; // Volta ao estágio de escolha de produtos
                client
                    .sendMessage(message.from, `${quantidade} unidade(s) de "${clientState.cart[clientState.cart.length - 1].produto}" adicionada(s) ao carrinho. Digite outro item ou "Finalizar" para concluir o pedido.`)
                    .then(() => console.log('Produto e quantidade adicionados ao carrinho.'))
                    .catch((error) => console.error('Erro ao adicionar item ao carrinho:', error));
                break;
    
            case message.body.toLowerCase() === 'ver carrinho':
                if (clientState.cart.length > 0) {
                    const cartItems = clientState.cart
                        .map((item, index) => `${index + 1}. ${item.produto} - ${item.quantidade} unidade(s)`)
                        .join('\n');
                    client
                        .sendMessage(message.from, `Seu carrinho:\n${cartItems}\n\nDigite "Finalizar" para concluir o pedido ou adicione mais itens.`)
                        .then(() => console.log('Carrinho enviado.'))
                        .catch((error) => console.error('Erro ao enviar carrinho:', error));
                } else {
                    client
                        .sendMessage(message.from, 'Seu carrinho está vazio. Adicione itens antes de ver o carrinho.')
                        .then(() => console.log('Mensagem de carrinho vazio enviada.'))
                        .catch((error) => console.error('Erro ao enviar mensagem de carrinho vazio:', error));
                }
                break;
    
            case message.body.toLowerCase() === 'finalizar':
                if (clientState.cart.length > 0) {
                    const total = clientState.cart.reduce((sum, item) => sum + item.quantidade * 20, 0); // Exemplo de cálculo (R$20 por item)
                    const cartItems = clientState.cart
                        .map((item) => `${item.produto} - ${item.quantidade} unidade(s)`)
                        .join('\n');
                    client
                        .sendMessage(message.from, `Pedido finalizado! Seus itens:\n${cartItems}\n\nTotal: R$${total}\nObrigado pela preferência!`)
                        .then(() => {
                            console.log('Pedido finalizado.');
                            delete clientsInProgress[message.from]; // Limpa o estado do cliente
                        })
                        .catch((error) => console.error('Erro ao finalizar pedido:', error));
                }break;
        case ['deixa', 'não quero', 'cancelar', '4','sair'].some(term => message.body.toLowerCase().includes(term)):
            client
                .sendMessage(message.from, 'Obrigado por entrar em contato. Até logo!')
                .then(() => {
                    console.log('Mensagem de despedida enviada com sucesso!');
                    // Remove o cliente do estado para permitir novo atendimento no futuro
                    delete clientsInProgress[message.from];
                })
                .catch((error) => console.error('Erro ao enviar mensagem de despedida:', error));
            break;
        case message.body === 'voltar': // Retorna ao menu inicial
            if (clientState.stage === 2) {
                client
                    .sendMessage(message.from, 'Voltando ao menu principal. Como posso ajudar?\n1️⃣ Ver Cardápio\n2️⃣ Taxas de Entrega\n3️⃣ Nossa Localização\n4️⃣ Redes Sociais\n5️⃣ Sair')
                    .then(() => console.log('Mensagem de volta ao menu principal enviada com sucesso!'))
                    .catch((error) => console.error('Erro ao enviar mensagem de volta ao menu principal:', error));
                clientState.stage = 1; // Volta ao estágio inicial para permitir nova escolha
            }
            break;
        case message.location && clientState.stage === 3:
            const { latitude, longitude } = message.location;

            // Obtém o bairro a partir das coordenadas
            const bairro = await getBairro(latitude, longitude);

            // Envia a resposta com o nome do bairro
            client.sendMessage(message.from, `A taxa de entrega para o bairro *${bairro}* é de R$ 12,30`);
            setTimeout(() => {
                client
                    .sendMessage(message.from, `Gostaria de ver nosso cardápio?`)
                    .then(() => console.log('Mensagem Menu enviada com sucesso!'))
                    .catch((error) => console.error('Erro ao enviar mensagem:', error))
            }, 500);
            clientState.stage = 3;
            break;
        default:
            // Se o cliente responder com um pedido
            if (clientState.stage === 2 && (message.body.toLowerCase() === 'pizza' || message.body.toLowerCase() === 'hambúrguer' || message.body.toLowerCase() === 'refrigerante')) {
                client
                    .sendMessage(message.from, `Pedido recebido: ${message.body}. Estamos preparando! Por favor, informe a sua localização para a entrega.`)
                    .then(() => console.log('Confirmação de pedido enviada com sucesso!'))
                    .catch((error) => console.error('Erro ao confirmar o pedido:', error));
                // Avança para o estágio de coleta da localização
            } else {
                // Resposta padrão se a entrada não for reconhecida
                if (clientState.stage === 2){
                    client.sendMessage(message.from, 'Não entendi o seu pedido! Escolha um dos itens do nosso cardápio ou digite "Finalizar" para encerrar o seu pedido:\n').then(() => console.log('Pedido não identificado'))
                }
                if (clientState.stage === 3){
                    if (message.body.toLowerCase() == "quero" || message.body.toLowerCase() == "sim" || message.body.toLowerCase() == "quero sim" || message.body.toLowerCase() == "quero ver"){
                        client
                    .sendMessage(message.from, 'Aqui está o nosso menu:\n\n🍕 Pizza - R$20\n🍔 Hambúrguer - R$15\n🥤 Refrigerante - R$5\n\nDigite o nome do item para fazer o pedido ou "Voltar" para ver as opções novamente.')
                    .then(() => console.log('Menu enviado com sucesso!'))
                    .catch((error) => console.error('Erro ao enviar o menu:', error));
                        clientState.stage = 2
                    }else{
                        client.sendMessage(message.from, 'Você não enviou sua localização de forma correta, siga os passos abaixo:').then(() => console.log('Localização Incorreta'))
                    setTimeout(() => {
                        client.sendMessage(message.from, 'Android: clique no clip 📎, selecione localização e escolha a opção “localização atual”.\niPhone: clique no ➕, selecione localização e escolha a opção “localização atual”').then(() => console.log('Mensagem de explicação sobre localização'))
                    }, 500);
                    }
                    
                    
                }
                if (clientState.stage === 1){
                client
                    .sendMessage(message.from, 'Desculpe, não entendi. Por favor, escolha uma das opções:\n1️⃣ Ver Cardápio\n2️⃣ Taxas de Entrega\n3️⃣ Nossa Localização\n4️⃣ Redes Sociais\n5️⃣ Sair')
                    .then(() => console.log('Mensagem de opções reenviada com sucesso!'))
                    .catch((error) => console.error('Erro ao reenviar opções:', error));}
                    console.log(clientState.state);
            }
            break;
    }
}

// Função para iniciar o temporizador de inatividade (5 minutos)
function startInactivityTimer(clientId) {
    clientTimers[clientId] = setTimeout(() => {
        // Se não houver interação por 5 minutos, reinicia o atendimento
        console.log(`Cliente ${clientId} inativo por 5 minutos. Reiniciando atendimento...`);
        resetClientState(clientId);
    }, 10 * 60 * 1000); // 5 minutos
}

// Função para resetar o temporizador de inatividade (sempre que o cliente interagir)
function resetInactivityTimer(clientId) {
    if (clientTimers[clientId]) {
        clearTimeout(clientTimers[clientId]);  // Limpa o temporizador anterior
        startInactivityTimer(clientId);  // Inicia um novo temporizador
    }
}

// Função para reiniciar o estado do cliente
function resetClientState(clientId) {
    if (clientsInProgress[clientId]) {
        client
            .sendMessage(clientId, 'Seu atendimento ultrapassou os 10min, estamos finalizando por aqui! Aguardamos seu retorno!')
            .then(() => console.log('Atendimento reiniciado devido à inatividade'))
            .catch((error) => console.error('Erro ao enviar mensagem de reinício de atendimento:', error));

        delete clientsInProgress[clientId];  // Reinicia o estado do cliente
    }
}

// Iniciar o cliente
client.initialize();

