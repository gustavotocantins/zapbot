const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const axios = require('axios');

// Definir diretório de sessão
const sessionPath = path.join(__dirname, 'session');

// Variáveis para armazenar as informações do pedido
let pedido = {
    tipoAgua: '',
    quantidade: 0,
    nome: '',
    telefone: '',
    endereco: '',
    pagamento: '',
    taxa:0,
    troco: '',
    estado: ''  // Para controlar o estado do pedido
};

// Definir os tipos de água e seus preços
const aguas = [
    { nome: 'Nossa Água', preco: 10 },
    { nome: 'Água Cristal', preco: 12 },
    { nome: 'Indaiá', preco: 15 }
];

const client = new Client({
    puppeteer: {
        executablePath: '/usr/bin/chromium-browser', // Caminho do navegador
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
    authStrategy: new LocalAuth({
        clientId: 'bot',
        dataPath: sessionPath // Especifica o diretório da sessão
    })
});

// Evento para exibir o QR Code no terminal
client.on('qr', (qr) => {
    const qrcode = require('qrcode-terminal');
    qrcode.generate(qr, { small: true });
    console.log('QR Code gerado, escaneie com o WhatsApp!');
});

// Evento que sinaliza que o cliente está pronto
client.on('ready', () => {
    console.log('Cliente está pronto!');
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

const TermosConfirmo = [
    'sim', 'quero', 'claro', 'pode ser', 'pode abrir', 'ok', 'beleza', 
    'simmm', 'siiim', 'isso mesmo', 'com certeza', 'afirmativo', 
    'quero sim', 'isso', 'tô dentro', 'manda aí', 'vamo nessa', 
    'bora', 'pode mandar', 'confirma', 'topo', 'tranquilo', 
    'pode fazer', 'fechado', 'positivo', 'vamos lá', 'vamos sim', 
    'vamos nessa', 'estou precisando', 'preciso sim', 'anota aí', 
    'favor abrir', 'faça o pedido', 'ok pode ser', 'manda sim', 
    'sim por favor', 'pode sim', 'claro que sim', 'certo', 
    'já quero', 'aceito', 'certo pode abrir', 'pode colocar','agua','água','galão','gostaria',
];
const Confirmo = new RegExp(`\\b(${TermosConfirmo.join('|')})\\b`, 'i');

const numerosPorExtenso = {
    'um': 1,
    'uma': 1,
    'dois': 2,
    'duas': 2,
    'três': 3,
    'tres': 3
};

// Evento para capturar mensagens recebidas
client.on('message', async (message) => {
    console.log(`Mensagem recebida: ${message.body}`);

    // Quando o cliente enviar "Oi", "Olá" ou qualquer saudação
    if (pedido.estado === "") {
        message.reply('Seja Bem-vindo! Me chamo Bernardo, sou da *Água Bom Jesus* e vou te ajudar com o seu atendimento.')
        .then(() => client.sendMessage(message.from,'Trabalhamos com água de 20 litros. Você gostaria de abrir o pedido?'));
        pedido.estado = 'iniciar'; // Inicia o pedido
    }

    // Se o cliente responder "Sim" ou "Não"
    else if (pedido.estado === 'iniciar' && Confirmo.test(message.body.toLowerCase())) {
        let options = aguas.map((agua, index) => `${index + 1}. ${agua.nome} - Valor: R$ ${agua.preco}`).join('\n');
        message.reply('Ótimo! Vamos começar. Escolha o *tipo de água* que deseja:')
        .then(() => client.sendMessage(message.from,options));
        pedido.estado = 'escolherMarca'; // Definir estado para escolha da marca
    }

    else if (message.body.toLowerCase() === 'não' && pedido.estado === 'iniciar') {
        message.reply('Poxa, que pena que não vai precisar de água. Mas qualquer coisa, estamos aqui. Desde já, agradecemos o contato!');
        pedido.estado = ''; // Resetar o estado
    }

    // Se o cliente escolheu a marca da água
    else if (pedido.estado === 'escolherMarca') {
        let escolha = message.body.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, '').trim();
    
    // Tentar converter escolha para número (exemplo: "um", "uma", "dois")
        let escolhaNumero = numerosPorExtenso[escolha] || parseInt(escolha);

        if (escolhaNumero >= 1 && escolhaNumero <= aguas.length) {
        pedido.tipoAgua = aguas[escolhaNumero - 1].nome;
        pedido.preco = aguas[escolhaNumero - 1].preco;
        message.reply(`Você escolheu ${pedido.tipoAgua}. Quantos garrafões de 20 litros você gostaria de pedir?`);
        pedido.estado = 'quantidade'; // Passar para o próximo passo
     }  else {
        const aguaEscolhida = aguas.find(agua =>
            agua.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, '') === escolha
        );

        if (aguaEscolhida) {
            pedido.tipoAgua = aguaEscolhida.nome;
            pedido.preco = aguaEscolhida.preco;
            message.reply(`Você escolheu ${pedido.tipoAgua}. Quantos garrafões de 20 litros você gostaria de pedir?`);
            pedido.estado = 'quantidade'; // Passar para o próximo passo
        } else {
            message.reply('Escolha inválida. Por favor, escolha um número de 1 a 3 ou digite o nome do tipo de água.');
        }
    }
}

    // Se o cliente informa a quantidade
    else if (pedido.estado === 'quantidade') {
        let entrada = message.body.toLowerCase().trim();
        entrada = entrada.normalize("NFD").replace(/[\u0300-\u036f]/g, ''); // Remover acentos
    
        // Tentar converter entrada para número
        let quantidade = numerosPorExtenso[entrada] || parseInt(entrada);
    
        if (isNaN(quantidade) || quantidade <= 0) {
            message.reply('Por favor, forneça uma quantidade válida de garrafões.');
        } else {
            pedido.quantidade = quantidade;
            message.reply(`Você pediu ${pedido.quantidade} garrafões de 20 litros. Agora, por favor, me passe seu nome.`);
            pedido.estado = 'nome'; // Passar para o próximo passo
        }
    }

    // Receber o nome
    else if (pedido.estado === 'nome') {
        pedido.nome = message.body;
        message.reply(`Olá, *${pedido.nome}!* Por favor, me informe seu *telefone* para contato.`);
        pedido.estado = 'telefone'; // Passar para o próximo passo
    }

    // Receber o telefone
    else if (pedido.estado === 'telefone') {
        pedido.telefone = message.body;
        message.reply('Agora, por favor, me informe o *seu endereço* para *entrega.*');
        pedido.estado = 'endereco'; // Passar para o próximo passo
    }

    // Receber o endereço
    else if (pedido.estado === 'endereco') {
        pedido.endereco = message.body;
        message.reply(`Você informou o seguinte endereço: ${pedido.endereco}.`)
        .then(() => client.sendMessage(message.from,'Vamos verificar a taxa de entrega. Mande a sua *localização fixa:*\n*Android:* clique no clip 📎, selecione localização e escolha a opção “localização atual”.\n*iPhone:* clique no ➕, selecione localização e escolha a opção “localização atual”.'));
        pedido.estado = 'taxa'; // Passar para o próximo passo
    }
    else if(message.location && pedido.estado === 'taxa'){
        const { latitude, longitude } = message.location;
        const bairro = await getBairro(latitude, longitude);
            if (bairro === "Campina" || bairro === "Cidade Velha"){
                client.sendMessage(message.from, `A entrega para o bairro Campina é *gratuita!*`)
                .then(() => client.sendMessage(message.from,`Qual será a forma de pagamento? Responda *"Dinheiro"* ou *"Pix"*.`));
                pedido.taxa = 0;
            } else if(bairro == "Umarizal"){
                client.sendMessage(message.from, `A taxa de entrega para o bairro *${bairro}* é de R$ 15,00`)
                .then(() => client.sendMessage(message.from,`Qual será a forma de pagamento? Responda *"Dinheiro"* ou *"Pix"*.`));
                pedido.taxa = 15;
            } else if(bairro == 'Jurunas'){
                client.sendMessage(message.from, `A taxa de entrega para o bairro *${bairro}* é de R$ 14,80`)
                .then(() => client.sendMessage(message.from,`Qual será a forma de pagamento? Responda *"Dinheiro"* ou *"Pix"*.`));
                pedido.taxa = 14.8;
            }else if(bairro == 'Nazaré'){
                client.sendMessage(message.from, `A taxa de entrega para o bairro *${bairro}* é de R$ 16,50`)
                .then(() => client.sendMessage(message.from,`Qual será a forma de pagamento? Responda *"Dinheiro"* ou *"Pix"*.`));
                pedido.taxa = 16.5;
            }else if(bairro == 'Reduto'){
                client.sendMessage(message.from, `A taxa de entrega para o bairro *${bairro}* é de R$ 8,50`)
                .then(() => client.sendMessage(message.from,`Qual será a forma de pagamento? Responda *"Dinheiro"* ou *"Pix"*.`));
                pedido.taxa = 8.5;
            } else{
                client.sendMessage(message.from, `Poxa, sentimos muito! Ainda não estamos atendendo o bairro *${bairro},* mas esperamos chegar aí em breve!`);
                pedido = {
                    tipoAgua: '',
                    quantidade: 0,
                    nome: '',
                    telefone: '',
                    endereco: '',
                    pagamento: '',
                    taxa:0,
                    troco: '',
                    estado: ''  // Para controlar o estado do pedido
                };
                return
            }
        pedido.estado = 'pagamento';
    }
    // Receber a forma de pagamento
    else if (pedido.estado === 'pagamento') {
        if (message.body.toLowerCase() === 'dinheiro') {
            pedido.pagamento = 'Dinheiro';
            message.reply('Você escolheu pagamento em dinheiro. Precisa de troco?');
            pedido.estado = 'troco'; // Passar para o próximo passo
        } else if (message.body.toLowerCase() === 'pix') {
            pedido.pagamento = 'Pix';
            message.reply('Você escolheu pagamento via Pix.\n Nossa *chave pix* é 04588776374')
            .then(() => client.sendMessage(message.from,'Agora vou passar o resumo do seu pedido. OK?'));
            pedido.troco = 0;
            pedido.estado = 'resumo'; // Passar para o próximo passo
        } else {
            message.reply('Desculpe, não entendi. Responda "Dinheiro" ou "Pix".');
        }
    }

    // Perguntar se precisa de troco
    else if (pedido.estado === 'troco') {
        if (Confirmo.test(message.body.toLowerCase())) {
            message.reply('Qual valor será *pago para o entregador?*')
            .then(() => client.sendMessage(message.from,'Ex: 30,40,50.'));;
            pedido.estado = 'ValorTroco';
            return;

        } else if (message.body.toLowerCase() === 'não') {
            pedido.troco = false;
            message.reply('Você não vai precisar de troco! Agora, vou passar o resumo do seu pedido. OK?');
            pedido.troco = 0;
        } else {
            message.reply('Desculpe, não entendi. Responda "Sim" ou "Não".');
            return;
        }
        pedido.estado = 'resumo'; // Passar para o próximo passo
    }
    else if (pedido.estado === "ValorTroco"){
        pedido.troco = message.body;
        message.reply(`O valor que você vai entregar vai ser: ${message.body}.`)
        .then(() => client.sendMessage(message.from,'Agora, vou repassar o resumo do seu pedido, OK?'));
        pedido.estado = 'resumo';
    }
    // Passar o resumo do pedido
    else if (pedido.estado === 'resumo') {
        let total = pedido.quantidade * pedido.preco+pedido.taxa;
        let mensagemResumo = `*📄RESUMO DO PEDIDO:*\n`;
        mensagemResumo += `Tipo de água: _${pedido.tipoAgua}_\n`;
        mensagemResumo += `Quantidade: _${pedido.quantidade} garrafões de 20L_\n`;
        mensagemResumo += `Preço unitário: _R$ ${pedido.preco}_\n`;
        if (pedido.taxa === 0) {
            mensagemResumo += `Taxa de entrega: _*Grátis*_\n`;
        } else{
            mensagemResumo += `Taxa de entrega: _R$ ${pedido.taxa}_\n`
        }
        mensagemResumo += `*Total: _R$ ${total}_*\n`;
        mensagemResumo += `*🚘 DADOS DE ENTREGA*\n`;
        mensagemResumo += `Nome: _${pedido.nome}_\n`;
        mensagemResumo += `Telefone: _${pedido.telefone}_\n`;
        mensagemResumo += `Endereço: _${pedido.endereco}_\n`;
        mensagemResumo += `Forma de pagamento: _${pedido.pagamento}_\n`;

        if (pedido.troco === 0){
            mensagemResumo += `Necessita de Troco: Não\n`
            
        } else{
            mensagemResumo += `Necessita de Troco: Sim, para ${pedido.troco}\n`;
        }
        message.reply(mensagemResumo)
        .then(() => client.sendMessage(message.from,'Seu pedido *foi concluído!✅* Entraremos em contato em breve para a entrega. Obrigado!'));

        // Enviar Pedido para o contato pessoal do dono
        client.sendMessage('559192431116@c.us', `Novo Pedido✅ ${mensagemResumo}`);
        pedido = {
            tipoAgua: '',
            quantidade: 0,
            nome: '',
            telefone: '',
            endereco: '',
            pagamento: '',
            taxa:0,
            troco: '',
            estado: ''  // Para controlar o estado do pedido
        }; // Resetar o pedido para iniciar um novo atendimento
    }
});

// Inicializar o cliente
client.initialize();