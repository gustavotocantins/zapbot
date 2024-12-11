const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  // Para manipulação de arquivos
const axios = require('axios');
const express = require('express');
const path = require('path');
const { Payment, MercadoPagoConfig } = require("mercadopago");
const clientPIX = new MercadoPagoConfig({ accessToken: 'APP_USR-7005128537550780-120100-27ba39bde39862bd3558b846cd618f5d-696187036', options: { timeout: 5000, idempotencyKey: 'abc' } });
const bodyParser = require('body-parser');
const https = require('https'); //COMANDO NOVO SSH

// Configurando o bot para enviar mensagem
const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/serveraquagas.shop/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/serveraquagas.shop/fullchain.pem'),
};

// Configura o servidor Express
const app = express();
app.use(bodyParser.json()); // Para trabalhar com requisições JSON

// Endpoint genérico para enviar mensagens
app.post('/enviar-mensagem', async (req, res) => {
    const { numero, mensagem } = req.body;

    // Verificação de parâmetros obrigatórios
    if (!numero || !mensagem) {
        console.warn('Requisição inválida: Parâmetros "numero" e/ou "mensagem" ausentes.');
        return res.status(400).json({ 
            error: 'Parâmetros "numero" e "mensagem" são obrigatórios!' 
        });
    }

    try {
        // Formata o número para o padrão correto
        const numeroFormatado = `${numero.replace(/\D/g, '')}@c.us`;

        // Envia a mensagem para o número especificado
        await client.sendMessage(numeroFormatado, mensagem);

        console.log(`Mensagem enviada com sucesso para o número: ${numeroFormatado}`);
        return res.status(200).json({ 
            message: 'Mensagem enviada com sucesso!' 
        });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error.message || error);

        // Envia uma resposta clara sobre o erro
        return res.status(500).json({ 
            error: 'Ocorreu um erro ao enviar a mensagem. Por favor, tente novamente mais tarde.' 
        });
    }
});

// Endpoint para verificar se o servidor está ativo
app.get('/', (req, res) => {
    res.send('Servidor está ativo e rodando!');
});

// Inicializa o servidor na porta 3000
const PORT = 3010;
https.createServer(options, app).listen(PORT, () => {
    console.log(`Servidor HTTPS rodando na porta ${PORT}`);
});

// Step 3: Initialize the API object
const payment = new Payment(clientPIX);
async function criarPedido({ valor, informa, idCompra}) {
    // Criar o corpo da requisição
    const email = 'gustavotocantins@gmail.com';
    const body = {
        transaction_amount:valor,
        description:informa,
        payment_method_id: 'pix', // Mantém fixo como PIX
        payer: {
            email,
        },
    };

    // Opções da requisição (opcional)
    const requestOptions = {
        idempotencyKey: `${idCompra}`, // Gera uma chave única baseada no timestamp
    };
    
    try {
        // Fazendo a requisição para criar o pedido
        const pedido = await payment.create({ body, requestOptions });

        
        // Acessando e exibindo o QR Code
        const qrCode = pedido?.point_of_interaction?.transaction_data?.qr_code;
		

        if (!qrCode) {
            console.error("QR Code não encontrado no objeto retornado.");
        } else {
            console.log("QR Code:", qrCode);
			console.log("Status:", pedido.status);
			return {chave:qrCode,status:pedido.status}
        }
    } catch (error) {
        // Tratamento de erros
        console.error("Erro ao criar o pedido ou acessar propriedades:", error.message);
    }
}

let clientsInProgress = {};  // Armazena o estado de cada cliente
let clientTimers = {};  // Armazena os temporizadores para cada cliente

// Cria uma nova instância do cliente
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/usr/bin/chromium-browser',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 60000,
    }, 
});
setInterval(() => {
    client.pupPage.evaluate(() => {
        console.log('Mantendo a sessão ativa');
    });
}, 5 * 60 * 1000); // A cada 5 minutos

client.on('disconnected', (reason) => {
    console.error('Cliente desconectado:', reason);
    client.initialize();  // Tente inicializar novamente
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

function isWithinWorkingHours() {
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= 8 && currentHour < 18;  // Horário entre 8h e 18h
}

// Quando uma nova mensagem for recebida
client.on('message', async (message) => {
    // Verifica se a mensagem foi enviada em um chat privado
    if (!message.isGroupMsg) {
        console.log(message.body);

        if (!clientsInProgress[message.from]) {
            if (false) {
                message.reply('Desculpe, nosso horário de atendimento é das 8h às 18h. Por favor, entre em contato novamente mais tarde.');
                delete clientsInProgress[message.from];
                return;//!isWithinWorkingHours()
            }
            // Marca o cliente como em atendimento e envia a mensagem de boas-vindas
            clientsInProgress[message.from] = {tipoAgua: '',
                quantidade: 0,
                nome: '',
                telefone: '',
                endereco: '',
                pagamento: '',
                taxa:0,
                troco: '',
                estado: 'iniciar' }; // Inicia no estágio 1
		async function consultarCliente(whatsapp) {
                    try {
                        const response = await fetch(`https://serveraquagas.shop:3001/cliente/${whatsapp}`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        });
                
                        if (response.ok) {
                            const data = await response.json();
                            const clienteTest = data.cliente;
                            console.log(clienteTest);
                            clientsInProgress[message.from].nome = clienteTest.nome;
                            clientsInProgress[message.from].endereco = clienteTest.endereco;
                            clientsInProgress[message.from].bairro = clienteTest.bairro;
                            clientsInProgress[message.from].novo = true;
                            return true
                        } else {
                            return false
                        }
                    } catch (error) {
                       return false
                    }
                }
            const info = await consultarCliente(message.from.split('@')[0]);
            if (info){
                message.reply(`Olá, *${clientsInProgress[message.from].nome}!* que bom ter você de volta! Vou te ajudar com o seu atendimento.`)
                .then(() => client.sendMessage(message.from,'Você gostaria de fazer um pedido?\nResponda: *Sim* ou *Não*'));
            }else{
                message.reply('Seja Bem-vindo! Me chamo Bernardo, sou da *Água Bom Jesus* e vou te ajudar com o seu atendimento.')
                .then(() => client.sendMessage(message.from,'Trabalhamos com água de 20 litros. Você gostaria de abrir o pedido?\nResponda: *Sim* ou *Não*'));
            }
            startInactivityTimer(message.from);
        } else {
            // Verifica o estado do cliente e responde de acordo
            handleClientResponse(client, message);
        }
    }
});
const aguas = [
    { nome: 'Nossa Água', preco: 10 },
    { nome: 'Água Cristal', preco: 12 },
    { nome: 'Indaiá', preco: 15 }
];
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
    'um': 1,'seis':6,'4':4,
    'uma': 1,'sete':7,'5':5,
    'dois': 2,'oito':8,'6':6,
    'duas': 2,'nove':9,'7':7,
    'três': 3,'dez':10,'8':8,
    'tres': 3,'1':1,'9':9,
    'quatro':4,'2':2,'10':10,
    'cinco':5,'3':3,'11':11,
};
const numeroTipo = {
    'um': 1,
    'dois': 2,
    'três': 3,
    'tres': 3,
    '1':1,
    '2':2,
    '3':3,
    '10':1,
    '12':2,
    '15':3,
    'nossa agua':1,
    'agua cristal':2,
    'indaia':3,
    'dez':1,
    'doze':2,
    'quinze':3,

  };
async function identificarGenero(nomeCompleto) {
  try {
    // Extrai o primeiro nome
    const primeiroNome = nomeCompleto.split(' ')[0];
    
    // Faz a chamada para a API Genderize.io
    const response = await axios.get(`https://api.genderize.io/?name=${primeiroNome}`);
    const { gender } = response.data;

    // Retorna "Masculino", "Feminino" ou "Não identificado" com base no gênero
    if (gender === 'male') return 'Masculino';
    if (gender === 'female') return 'Feminino';
    return 'Não identificado';
  } catch (error) {
    console.error('Erro ao identificar o gênero:', error.message);
    throw new Error('Não foi possível identificar o gênero');
  }
}
async function adicionarCliente(nome, whatsapp, endereco, bairro) {
    const genero = await identificarGenero(nome);
	console.log("AAAAAAAAAAAAAAAAA ACIMAAAA");
    const clienteData = {
        nome,
        whatsapp,
        endereco,
        bairro,
	genero
    };

    try {
        const response = await fetch('https://serveraquagas.shop:3001/cliente', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(clienteData),
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Cliente adicionado');
        } else {
            const errorData = await response.json();
            console.log('Cliente não adicionado');
        }
    } catch (error) {
        console.error('Erro ao cadastrar cliente:', error.message);
    }
};
// Função para gerenciar a resposta do cliente
async function handleClientResponse(client, message) {
    const pedido = clientsInProgress[message.from];
    const produtoIDs = {
        'Nossa Água': 1,
        'Água Cristal': 2,
        'Indaiá': 3
    };
    
    function GerarIDpagamento() {
        // Gera um número entre 10000000 e 99999999 (8 dígitos)
        return Math.floor(10000000 + Math.random() * 90000000);
    }
    // Reinicia o temporizador sempre que o cliente interage
    resetInactivityTimer(message.from);
    // Quando o cliente enviar "Oi", "Olá" ou qualquer saudação

    // Se o cliente responder "Sim" ou "Não"
    if (pedido.estado === 'iniciar' && Confirmo.test(message.body.toLowerCase())) {
        let options = aguas.map((agua, index) => `${index + 1}️⃣ ${agua.nome} (R$ ${agua.preco})`).join('\n');
        message.reply('Ótimo! Vamos começar. Escolha o *tipo de água* que deseja:')
        .then(() => client.sendMessage(message.from,options));
        pedido.estado = 'escolherMarca'; // Definir estado para escolha da marca
    }

    else if (message.body.toLowerCase() === 'não' && pedido.estado === 'iniciar') {
        message.reply('Poxa, que pena que não vai precisar de água. Mas qualquer coisa, estamos aqui. Desde já, agradecemos o contato!');
        delete clientsInProgress[message.from]; // Resetar o estado
    }

    // Se o cliente escolheu a marca da água
    else if (pedido.estado === 'escolherMarca') {
        let escolha = message.body.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, '').trim();
        console.log('escolha');
        const palavrasChave = Object.keys(numeroTipo);
        const regex = new RegExp(`\\b(${palavrasChave.join('|')})\\b`, 'gi');
        const encontrados = escolha.match(regex);
        console.log('Encontrados');
        let escolhaNumero
        try{
            escolhaNumero = parseInt(numeroTipo[encontrados[0]]);
        }catch{
            escolhaNumero = NaN;
        }
    // Tentar converter escolha para número (exemplo: "um", "uma", "dois")
       
        if (escolhaNumero >= 1 && escolhaNumero <= aguas.length) {
        pedido.tipoAgua = aguas[escolhaNumero - 1].nome;
        pedido.preco = aguas[escolhaNumero - 1].preco;
        message.reply(`Quantas unidades de 20 litros você gostaria de pedir?`);
        pedido.estado = 'quantidade'; // Passar para o próximo passo
     }  else {
        const aguaEscolhida = aguas.find(agua =>
            agua.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, '') === escolha
        );

        if (aguaEscolhida) {
            pedido.tipoAgua = aguaEscolhida.nome;
            pedido.preco = aguaEscolhida.preco;
            message.reply(`Quantas *unidades* de 20 litros você gostaria de pedir?`);
            pedido.estado = 'quantidade'; // Passar para o próximo passo
        } else {
            message.reply('Opa! Para prosseguir você pode escolher um número de 1 a 3 ou digitar o nome do tipo de água.');
        }
    }
}

    // Se o cliente informa a quantidade
    else if (pedido.estado === 'quantidade') {
        let entrada = message.body.toLowerCase().trim();
        entrada = entrada.normalize("NFD").replace(/[\u0300-\u036f]/g, ''); // Remover acentos
        const palavrasChave = Object.keys(numerosPorExtenso);
        const regex = new RegExp(`\\b(${palavrasChave.join('|')})\\b`, 'gi');
        const encontrados = entrada.match(regex);
        let quantidade
        // Tentar converter entrada para número
        try{
            quantidade = parseInt(numerosPorExtenso[encontrados[0]]);
        }catch{
            quantidade = NaN
        }
        
        if (isNaN(quantidade) || quantidade <= 0) {
            message.reply('Por favor, forneça uma quantidade válida de garrafões.');
        } else {
           pedido.quantidade = quantidade;
            if(pedido.novo){
                message.reply(`Perfeito! você possui um *endereço salvo:*\n_Endereço: ${pedido.endereco}_\n_Bairro: ${pedido.bairro}_\n*Deseja fazer a entrega nesse endereço?*`);
            pedido.estado = 'ConfirmarDados'; // Passar para o próximo passo
            }else{
                message.reply(`Você pediu ${pedido.quantidade} garrafões de 20 litros. Agora, por favor, me passe seu nome.`);
            pedido.estado = 'nome'; // Passar para o próximo passo
            }
        }
    }

    // Receber o nome
    else if (pedido.estado === 'nome') {
        pedido.nome = message.body;
        message.reply(`Olá, *${pedido.nome}!* Por favor, me informe seu *endereço* para entrega.`);
        pedido.estado = 'endereco'; // Passar para o próximo passo
    }else if (pedido.estado === 'ConfirmarDados') {
        
        if (Confirmo.test(message.body.toLowerCase())) {
            bairro = pedido.bairro;
            pedido.estado = 'pagamento'
            client.sendMessage(message.from,`Qual será a forma de pagamento? Responda *"Dinheiro"* ou *"Pix"*.`);
            if (bairro === "Campina" || bairro === "Cidade Velha"){
                pedido.bairro = "Campina"
                pedido.taxa = 0;
            } else if(bairro == "Umarizal"){
                pedido.taxa = 15;
                pedido.bairro = "Umarizal"
            } else if(bairro == 'Jurunas'){
                pedido.taxa = 14.8;
                pedido.bairro = "Jurunas"
            }else if(bairro == 'Nazaré'){
                pedido.taxa = 16.5;
                pedido.bairro = "Nazaré"
            }else if(bairro == 'Reduto'){
                pedido.taxa = 8.5;
                pedido.bairro = "Reduto"
            } else{
                pedido.estado = 'nome'
                client.sendMessage(message.from,`Por favor, me diga *seu nome:*`);
            }
        }else{
            pedido.estado = 'endereco';
		pedido.novo = false;
            client.sendMessage(message.from,`*${pedido.nome}!* Por favor, me informe seu *endereço* para entrega.`);
        }
    }

    // Receber o endereço
    else if (pedido.estado === 'endereco') {
        pedido.endereco = message.body;
        message.reply(`Você informou o seguinte endereço: ${pedido.endereco}.`)
        .then(() => client.sendMessage(message.from,'Vamos verificar a taxa de entrega. Mande a sua *localização fixa ou nome do seu bairro:*\n*Android:* clique no clip 📎, selecione localização e escolha a opção “localização atual”.\n*iPhone:* clique no ➕, selecione localização e escolha a opção “localização atual”.'));
        pedido.estado = 'taxa'; // Passar para o próximo passo
    }
    else if(message.location || pedido.estado === 'taxa'){
        let bairro = null;

    try {
        // Se a localização está disponível, tenta extrair o bairro
        if (message.location) {
            const { latitude, longitude } = message.location;
            bairro = await getBairro(latitude, longitude); // Função para identificar bairro via API
        }
    } catch (error) {
        console.error("Erro ao obter bairro pela localização:", error);
    }

    if (!bairro) {
        // Tenta identificar o bairro a partir do texto da mensagem
        const descobrirBairro = message.body.toLowerCase();
        const bairrosConhecidos = ['campina', 'umarizal', 'jurunas', 'nazaré', 'reduto', 'cidade velha'];
        const bairroEncontrado = bairrosConhecidos.find(b => descobrirBairro.includes(b));

        // Define o bairro encontrado ou "Sem Bairro" se nenhum foi identificado
        bairro = bairroEncontrado ? bairroEncontrado.charAt(0).toUpperCase() + bairroEncontrado.slice(1) : 'Sem Bairro';
        console.log("Bairro identificado pela mensagem:", bairro);
    }
            if (bairro === "Campina" || bairro === "Cidade Velha"){
                client.sendMessage(message.from, `A entrega para o bairro Campina é *gratuita!*`)
                .then(() => client.sendMessage(message.from,`Qual será a forma de pagamento? Responda *"Dinheiro"* ou *"Pix"*.`));
                pedido.bairro = "Campina"
                pedido.taxa = 0;
            } else if(bairro == "Umarizal"){
                client.sendMessage(message.from, `A taxa de entrega para o bairro *${bairro}* é de R$ 15,00`)
                .then(() => client.sendMessage(message.from,`Qual será a forma de pagamento? Responda *"Dinheiro"* ou *"Pix"*.`));
                pedido.taxa = 15;
                pedido.bairro = "Umarizal"
            } else if(bairro == 'Jurunas'){
                client.sendMessage(message.from, `A taxa de entrega para o bairro *${bairro}* é de R$ 14,80`)
                .then(() => client.sendMessage(message.from,`Qual será a forma de pagamento? Responda *"Dinheiro"* ou *"Pix"*.`));
                pedido.taxa = 14.8;
                pedido.bairro = "Jurunas"
            }else if(bairro == 'Nazaré'){
                client.sendMessage(message.from, `A taxa de entrega para o bairro *${bairro}* é de R$ 16,50`)
                .then(() => client.sendMessage(message.from,`Qual será a forma de pagamento? Responda *"Dinheiro"* ou *"Pix"*.`));
                pedido.taxa = 16.5;
                pedido.bairro = "Nazaré"
            }else if(bairro == 'Reduto'){
                client.sendMessage(message.from, `A taxa de entrega para o bairro *${bairro}* é de R$ 8,50`)
                .then(() => client.sendMessage(message.from,`Qual será a forma de pagamento? Responda *"Dinheiro"* ou *"Pix"*.`));
                pedido.taxa = 8.5;
                pedido.bairro = "Reduto"
            }else if(bairro == 'Sem Bairro'){
                client.sendMessage(message.from, `Poxa, sentimos muito! Ainda não estamos atendendo no seu bairro, mas esperamos chegar aí em breve!`)
                delete clientsInProgress[message.from];
            } else{
                client.sendMessage(message.from, `Poxa, sentimos muito! Ainda não estamos atendendo o bairro *${bairro},* mas esperamos chegar aí em breve!`);
                delete clientsInProgress[message.from];
                return
            }
        pedido.estado = 'pagamento';
}
    // Receber a forma de pagamento
    else if (pedido.estado === 'pagamento') {
        var_dinheiro = ['dinheiro','real','grana','fisico'];
        pix_val = ['pix'];
        const dinheiro = new RegExp(`\\b(${var_dinheiro.join('|')})\\b`, 'i');
        const pix = new RegExp(`\\b(${pix_val.join('|')})\\b`, 'i');
        
        if (dinheiro.test(message.body.toLowerCase())) {
            pedido.pagamento = 'Dinheiro';
            message.reply('Você escolheu pagamento em dinheiro. Precisa de troco?');
            pedido.estado = 'troco'; // Passar para o próximo passo
        } else if (pix.test(message.body.toLowerCase())) {
            pedido.pagamento = 'Pix';
            pedido.IdPix =  GerarIDpagamento();
            (async () => {
                try {
                  
                    const ComandoPix = await criarPedido({
                        valor: 0.5, //pedido.quantidade * pedido.preco + pedido.taxa
                        description: `Tipo de água: _${pedido.tipoAgua}_\nQuantidade: _${pedido.quantidade} garrafões de 20L_\nPreço unitário: _R$ ${pedido.preco}_\n`, // Descrição do produto
                        idCompra: pedido.IdPix, // E-mail ou ID do pagador
                    });
            
                    // Mensagem de resposta ao usuário
                    await message.reply(`Você escolheu pagamento via *Pix.*\n_Copie a *chave-pix* e pague no seu banco ⤵️_`);

                    // Enviando o status do Pix
                    await client.sendMessage(message.from, `${ComandoPix.chave}`);
                } catch (error) {
                    console.error("Erro ao criar o Pix:", error);
                    await client.sendMessage(message.from, "Ocorreu um erro ao processar seu pedido. Tente novamente mais tarde.");
                    delete pedido.IdPix;
                }
            })();

            const interval = await setInterval(async () => {
                const EstadoPagamento = await criarPedido({
                    valor: 0.5, //pedido.quantidade * pedido.preco + pedido.taxa
                    description: `Tipo de água: _${pedido.tipoAgua}_\nQuantidade: _${pedido.quantidade} garrafões de 20L_\nPreço unitário: _R$ ${pedido.preco}_\n`, // Descrição do produto
                    idCompra: pedido.IdPix, // E-mail do pagador
                });

                if (EstadoPagamento.status === 'approved') {
                    clearInterval(interval); // Parar verificações
                    clearTimeout(timeout); // Cancelar o timeout final
                    client.sendMessage(message.from,'Pagamento aprovado✅!\nDigite *"OK"* para finalizar!');
                    delete pedido.IdPix;
                    pedido.estado = 'resumo';
                } else {
                    console.log("Aguardando pagamento...");
                }
            }, 6000); // Verifica a cada 4 segundos
            // Timeout para cancelar após 1 minuto
            const timeout = setTimeout(() => {
                clearInterval(interval); // Parar verificações
                if (pedido.estado !== 'Pago') {
                    client.sendMessage(message.from,'Seu tempo para pagar, acabou! Deseja pagar no dinheiro ou no pix?');
                    delete pedido.IdPix;
                    pedido.estado = 'pagamento';
                }
            }, 120000); // 1 minuto (60000 ms)
           
            pedido.troco = 0;
            
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
        mensagemResumo += `Telefone: _${message.from.split('@')[0]}_\n`;
        mensagemResumo += `Endereço: _${pedido.endereco}_\n`;
        mensagemResumo += `Forma de pagamento: _${pedido.pagamento}_\n`;
	troco = "";
        if (pedido.troco === 0){
            mensagemResumo += `Necessita de Troco: Não\n`;
	    troco = "Troco: Não precisa";
            
        } else{
            mensagemResumo += `Necessita de Troco: Sim, para ${pedido.troco}\n`;
		troco = `Troco: Sim, para ${pedido.troco}`;
        }
        message.reply(mensagemResumo)
        .then(() => client.sendMessage(message.from,'Seu pedido *foi concluído!✅* Entraremos em contato em breve para a entrega. Obrigado!'));
        const dadosPedido = {
            itens: `[${pedido.tipoAgua}]`,
            local: `${pedido.bairro}`,
            valor: total,
            pagamento: pedido.pagamento,
            descricao: `${pedido.quantidade}x ${pedido.tipoAgua}\nForma de pagamento: ${pedido.pagamento}\n${troco}\nBairro: ${pedido.bairro}\nEndereço: ${pedido.endereco}\nValor Total: R$ ${total}`,
            cliente: pedido.nome,
            whatsapp: message.from.split('@')[0]
          };
          if(pedido.novo){
            console.log("Cliente existente");
        }else{
            adicionarCliente(pedido.nome,message.from.split('@')[0],pedido.endereco,pedido.bairro);
            console.log("Cliente cadastrado");
        }
          axios.post('https://serveraquagas.shop:3001/pedido', dadosPedido)
        .then(response => {
            console.log('Pedido adicionado com sucesso:', response.data);

            // Reduzir quantidade no estoque
            const produtoID = produtoIDs[pedido.tipoAgua];
            if (produtoID) {
                axios.get(`https://serveraquagas.shop:3001/estoque/${produtoID}`)
                    .then(({ data }) => {
                        const novaQuantidade = data.produto.quantidade - pedido.quantidade;

                        // Atualizar estoque com a nova quantidade
                        if (novaQuantidade >= 0) {
                            axios.put(`https://serveraquagas.shop:3001/estoque/${produtoID}`, { quantidade: novaQuantidade })
                                .then(() => console.log(`Estoque do produto ID ${produtoID} atualizado com sucesso.`))
                                .catch(err => console.error('Erro ao atualizar estoque:', err.response ? err.response.data : err.message));
                        } else {
                            console.warn(`Quantidade insuficiente no estoque para o produto ID ${produtoID}.`);
                        }
                    })
                    .catch(err => console.error('Erro ao buscar produto:', err.response ? err.response.data : err.message));
            } else {
                console.warn('Produto não encontrado no mapeamento de IDs.');
            }
        })
        .catch(error => {
            console.error('Erro ao adicionar pedido:', error.response ? error.response.data : error.message);
        });

        // Enviar Pedido para o contato pessoal do dono
        client.sendMessage('559192431116@c.us', `Novo Pedido✅ ${mensagemResumo}`);
        //pedido.estado = "FimPedido"
        delete clientsInProgress[message.from]; // Resetar o pedido para iniciar um novo atendimento
    }
}


// Função para iniciar o temporizador de inatividade (5 minutos)
function startInactivityTimer(clientId) {
    clientTimers[clientId] = setTimeout(() => {
        // Se não houver interação por 5 minutos, reinicia o atendimento
        console.log(`Cliente ${clientId} inativo por 5 minutos. Reiniciando atendimento...`);
        resetClientState(clientId);
    }, 45 * 60 * 1000); // 5 minutos
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
        delete clientsInProgress[clientId];  // Reinicia o estado do cliente
    }
}

// Iniciar o cliente
client.initialize();
