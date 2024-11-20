const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
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
    }, 
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
    .then(() => {
        console.log('Mensagem de boas-vindas enviada com sucesso!');
        // Envia a segunda mensagem logo após a primeira com um pequeno atraso
        return new Promise((resolve) => setTimeout(resolve, 1000));
    })
    .then(() => {
        return client.sendMessage(
            message.from,
            '_Dicas: Cardápios, Taxa de entrega, Localização, Horários, Redes Sociais e etc.._'
        );
    })
    .then(() => console.log('Segunda mensagem enviada com sucesso!'))
    .catch((error) => console.error('Erro ao enviar mensagem:', error));

            });
            // Inicia o temporizador de 5 minutos
            startInactivityTimer(message.from);
        } else {
            // Verifica o estado do cliente e responde de acordo
            handleClientResponse(client, message);
        }
    }
});
const produtos = ['x-bacon', 'bacon especial', 'refrigerante'];
const numerosPorExtenso = {
    1: ['um', 'uma','1'],
    2: ['dois', 'duas','2'],
    3: ['três','3'],
    4: ['quatro','4'],
    5: ['cinco','5'],
    6: ['seis','6'],
    7: ['sete','7'],
    8: ['oito','8'],
    9: ['nove','9'],
    10: ['dez','10']
};
// Função para gerenciar a resposta do cliente
async function handleClientResponse(client, message) {
    const clientState = clientsInProgress[message.from];

    // Reinicia o temporizador sempre que o cliente interage
    resetInactivityTimer(message.from);

    switch (true) {
        case message.location && clientState.stage === 10: 
            console.log('Lozalização capturada');
            const { latitude, longitude } = message.location;
            
            // Obtém o bairro a partir das coordenadas
            const bairro = await getBairro(latitude, longitude);
            if (bairro === "Guamá"){
                client.sendMessage(message.from, `A entrega para o *${bairro}* é *gratuita!*`)
                .then(() => client.sendMessage(message.from,`Quer ver nosso cardápio? Aproveita que a taxa de entrega é de *graça!😋*`));
                clientState.stage = 5;
            } else if(bairro == "Jurunas"){
                client.sendMessage(message.from, `A taxa de entrega para o bairro *${bairro}* é somente R$ 4,50`)
                .then(() => client.sendMessage(message.from,`Quer ver nosso cardápio? Aproveita que a taxa de entrega é baratinha!😋*`));
                clientState.stage =  5;
            } else if(bairro == 'São Brás'){
                client.sendMessage(message.from, `A taxa de entrega para o bairro *${bairro}* é somente R$ 8,50`)
                .then(() => client.sendMessage(message.from,`Quer ver nosso cardápio? Aproveita que a taxa de entrega é baratinha!😋*`));
                clientState.stage = 5;
            } else{
                client.sendMessage(message.from, `Poxa, sentimos muito! Ainda não estamos atendendo o bairro *${bairro},* mas esperamos chegar aí em breve!`);
                delete clientsInProgress[message.from];
            }
            break;
        case clientState.stage == 10:
            if (['sair','voltar','não'].some(term => message.body.toLowerCase().includes(term))){
                client.sendMessage(message.from, `Me diga o que você precisa? 😋`);    
                clientState.stage = 1;
            } else{
                client.sendMessage(message.from, `Ops! Você não enviou sua localização da forma correta!`).then(() => client.sendMessage(message.from, 'Me mande a sua localização para verificar o valor da taxa de entrega.\n*Android:* clique no clip 📎, selecione localização e escolha a opção “localização atual”.\n*iPhone:* clique no ➕, selecione localização e escolha a opção “localização atual”.'))
            }break;
           
            
        case ['pratos', 'cardápio', 'cardapio', 'menu','o que tem hoje', 'oque tem hoje','prato'].some(term => message.body.toLowerCase().includes(term)):
            if (clientState.stage === 1) {
                console.log('SIM DA PARTE DE CIMA ESTÁ ATIVANDO');
                const imagePath = './menu.png';  // Caminho do arquivo de imagem
                const media = MessageMedia.fromFilePath(imagePath);  // Cria a mídia a partir do caminho do arquivo

                // Envia a imagem para o WhatsApp
                await client.sendMessage(message.from, media, { caption: 'Confira o nosso cardápio!' });

                clientState.stage = 2; // Avança para o próximo estágio de pedido
            }
            break;
            
        case ['taxa de entrega', 'frete', 'taxa', 'entrega'].some(term => message.body.toLowerCase().includes(term)): // Opção 2 - Falar com Atendente
            if (clientState.stage === 1) {
                client.sendMessage(message.from,'Me mande a sua localização para verificar o valor da taxa de entrega.\n*Android:* clique no clip 📎, selecione localização e escolha a opção “localização atual”.\n*iPhone:* clique no ➕, selecione localização e escolha a opção “localização atual”.')
                clientState.stage = 10;
            }
            break;
        case ['endereço','endereco', 'local', 'localizacao', 'localização'].some(term => message.body.toLowerCase().includes(term)): 
                if (clientState.stage === 1){
                    client.sendMessage(message.from, "Estamos esperando por você! 😀");
                    setTimeout(() => {
                        client
                            .sendMessage(message.from, "https://maps.app.goo.gl/5ZjM3K9SUeP41JV27")
                            .then(() => client.sendMessage(message.from, "Você gostaria de ver nosso cardápio? 😋"))
                            .catch((error) => console.error('Erro ao enviar mensagem:', error))
                    }, 1000);

                }clientState.stage =5;break;
            case ['horário','horario', 'dias da semana', 'horarios', 'horários','horas'].some(term => message.body.toLowerCase().includes(term)): 
                if (clientState.stage === 1){
                    client.sendMessage(message.from, "*Horário da Pizzaria Reis 🍕✨*\n\n*📅 Segunda a Sexta:* 18h às 23h\n*📅 Sábados e Domingos:* 17h às 00h\n\nEstamos prontos para tornar seu momento mais saboroso! 😄");                    
                }clientState.stage = 1;break;
                case ['carrinho', 'ver carrinho', 'meus pedidos'].some(term => message.body.toLowerCase().includes(term)):
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
                
                case ['finalizar', 'concluir pedido'].some(term => message.body.toLowerCase().includes(term)):
                    if (clientState.cart.length > 0) {
                        const precos = {
                            'x-bacon': 20,
                            'bacon especial': 25,
                            'refrigerante': 8,
                        };
                        const total = clientState.cart.reduce((sum, item) => sum + item.quantidade * precos[item.produto], 0);// Exemplo de cálculo (R$20 por item)
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
                    } else {
                        client
                            .sendMessage(message.from, 'Seu carrinho está vazio. Não há itens para finalizar o pedido.')
                            .then(() => console.log('Mensagem de carrinho vazio enviada ao finalizar.'))
                            .catch((error) => console.error('Erro ao enviar mensagem de carrinho vazio ao finalizar:', error));
                    }
                    break;            
    case clientState.stage === 2:
    // Identifica todos os produtos mencionados na mensagem
    const produtosEncontrados = produtos.filter(produto => message.body.toLowerCase().includes(produto));
    
    if (produtosEncontrados.length > 0) {
        clientState.currentItems = produtosEncontrados; // Armazena os itens encontrados
        clientState.stage = 3; // Avança para perguntar as quantidades
        clientState.currentIndex = 0; // Inicializa o índice para o primeiro produto
        
        // Pergunta a quantidade para o primeiro produto encontrado
        setTimeout(() => {
            client
                .sendMessage(message.from, `Quantas unidades de "${produtosEncontrados[0]}" você deseja adicionar ao carrinho?`)
                .then(() => console.log(`Perguntando quantidade de "${produtosEncontrados[0]}"`))
                .catch((error) => console.error('Erro ao perguntar quantidade:', error));
        }, 500);
    } else {
        client
            .sendMessage(message.from, 'Desculpe, não entendi o seu pedido. Por favor, escolha entre os seguintes produtos: X-Bacon, Bacon Especial ou Refrigerante.')
            .then(() => console.log('Mensagem de erro enviada.'))
            .catch((error) => console.error('Erro ao enviar mensagem de erro:', error));
    }
    break;

case clientState.stage === 3:
    const mensagemQuantidade = message.body.toLowerCase().trim();
    // Função para encontrar o número correspondente
function obterNumeroPorExtenso(palavra) {
    for (const numero in numerosPorExtenso) {
        if (numerosPorExtenso[numero].includes(palavra)) {
            return parseInt(numero);
        }
    }
    return null; // Retorna null se a palavra não for encontrada
}

// Processar a mensagem para obter a quantidade
const quantidade = 
    !isNaN(parseInt(mensagemQuantidade)) 
        ? parseInt(mensagemQuantidade) 
        : obterNumeroPorExtenso(mensagemQuantidade);
    if (quantidade && quantidade > 0) {
        // Adiciona o produto e quantidade ao carrinho
        const produtoAtual = clientState.currentItems[clientState.currentIndex];
        clientState.cart.push({ produto: produtoAtual, quantidade });
        console.log(`${quantidade} unidade(s) de "${produtoAtual}" adicionada(s) ao carrinho.`);
        
        // Avança para o próximo produto ou finaliza a etapa de seleção
        clientState.currentIndex++;
        
        if (clientState.currentIndex < clientState.currentItems.length) {
            const proximoProduto = clientState.currentItems[clientState.currentIndex];
            client
                .sendMessage(message.from, `Quantas unidades de "${proximoProduto}" você deseja adicionar ao carrinho?`)
                .then(() => console.log(`Perguntando quantidade de "${proximoProduto}"`))
                .catch((error) => console.error('Erro ao perguntar quantidade:', error));
        } else {
            clientState.currentItems = null; // Limpa os itens atuais
            clientState.currentIndex = null;
            clientState.stage = 2; // Volta para o estágio de escolha de produtos
            client
                .sendMessage(message.from, 'Todos os produtos foram adicionados ao carrinho. Digite outro item ou "Finalizar" para concluir o pedido.')
                .then(() => console.log('Mensagem de finalização enviada.'))
                .catch((error) => console.error('Erro ao enviar mensagem de finalização:', error));
        }
    } else {
        client
            .sendMessage(message.from, 'Por favor, insira uma quantidade válida em número ou por extenso (ex: "um", "dois", "três").')
            .then(() => console.log('Mensagem de erro enviada para quantidade inválida.'))
            .catch((error) => console.error('Erro ao enviar mensagem de erro para quantidade inválida:', error));
    }
    break;
    
        case ['deixa', 'não quero', 'cancelar','sair'].some(term => message.body.toLowerCase().includes(term)):
            client
                .sendMessage(message.from, 'Obrigado por entrar em contato. Até logo!')
                .then(() => {
                    console.log('Mensagem de despedida enviada com sucesso!');
                    // Remove o cliente do estado para permitir novo atendimento no futuro
                    delete clientsInProgress[message.from];
                })
                .catch((error) => console.error('Erro ao enviar mensagem de despedida:', error));
            break;
        case ['embora', 'não quero', 'cancelar', 'voltar','sair'].some(term => message.body.toLowerCase().includes(term)): // Retorna ao menu inicial
            if (clientState.stage === 2) {
                client
                    .sendMessage(message.from, 'Você saiu do cardápio! O que você deseja fazer?')
                    .then(() => console.log('Mensagem de volta ao menu principal enviada com sucesso!'))
                    .catch((error) => console.error('Erro ao enviar mensagem de volta ao menu principal:', error));
                    setTimeout(() => {
                        client.sendMessage(message.from,'_Dicas: Cardápios, Taxa de entrega, Localização, Horários, Redes Sociais e etc.._')
                    }, 1000);
                clientState.stage = 1; // Volta ao estágio inicial para permitir nova escolha
            }
            break;
            
        default:
            
            if (clientState.stage === 2){
                    client.sendMessage(message.from, 'Não entendi o seu pedido! Escolha um dos itens do nosso cardápio ou digite "Finalizar" para encerrar o seu pedido:\n').then(() => console.log('Pedido não identificado'))
                }
            if (clientState.stage === 5){
                
                    if (['quero', 'sim', 'mostre', 'ver','exibir','aham','si'].some(term => message.body.toLowerCase().includes(term))){
                        console.log('SIM DA PARTE DE BAIXO ESTÁ ATIVANDO');
                        const imagePath = './menu.png';  // Caminho do arquivo de imagem
                const media = MessageMedia.fromFilePath(imagePath);  // Cria a mídia a partir do caminho do arquivo

                // Envia a imagem para o WhatsApp
                await client.sendMessage(message.from, media, { caption: 'Aqui está nosso cardápio!' });
                        clientState.stage = 2;
                    } else{
                        client.sendMessage(message.from, 'O que você deseja? 😀')
                        clientState.stage = 1;
                    }
                    
                }
                if (clientState.stage === 1){
                client
                    .sendMessage(message.from, '😅Desculpe, não entendi. Você pode explicar melhor?')
                    .then(() => console.log('Mensagem de opções reenviada com sucesso!'))
                    .catch((error) => console.error('Erro ao reenviar opções:', error));}
                    console.log(clientState.state);
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

