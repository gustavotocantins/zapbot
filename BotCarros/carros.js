const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');  // Para manipulação de arquivos
const axios = require('axios');
const path = require('path');
const { pseudoRandomBytes } = require('crypto');
//Nome e seu telefone e Número de protocolo é:
let clientsInProgress = {};  // Armazena o estado de cada cliente
let clientTimers = {};  // Armazena os temporizadores para cada cliente

// Cria uma nova instância do cliente
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/usr/bin/chromium-browser',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }, 
});

function gerarProtocolo() {
    return Math.floor(1000 + Math.random() * 9000); // Gera número entre 1000 e 9999
}

// Gera o QR code para login no WhatsApp Web
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escaneie o QR Code para autenticar no WhatsApp');
});

function saudacaoPorHora() {
    const horaAtual = new Date().getHours(); // Obtém a hora atual
    
    if (horaAtual >= 6 && horaAtual < 12) {
        return "Bom dia!";
    } else if (horaAtual >= 12 && horaAtual < 18) {
        return "Boa tarde!";
    } else {
        return "Boa noite!";
    }
}

// Quando o cliente estiver pronto para enviar e receber mensagens
client.on('ready', () => {
    console.log('O bot está pronto para enviar e receber mensagens!');
});

// Função para encontrar o bairro da pessoa
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

// Função para o horário de funcionamento
function isWithinWorkingHours() {
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= 8 && currentHour < 23;  // Horário entre 8h e 18h
}

// Quando uma nova mensagem for recebida
client.on('message', (message) => {
    // Verifica se a mensagem foi enviada em um chat privado
    if (!message.isGroupMsg) {
        console.log(message.body);

        if (!clientsInProgress[message.from]) {
            if (false && !isWithinWorkingHours()) {
                message.reply('Desculpe, nosso horário de atendimento é das 8h às 18h. Por favor, entre em contato novamente mais tarde.');
                delete clientsInProgress[message.from];
                return;
            }
            // Marca o cliente como em atendimento e envia a mensagem de boas-vindas
            clientsInProgress[message.from] = {TipoCarro: '',
                MarcaCarro: '',
                ModeloCarro: '',
                ValorMaximo: 0,
                ValorMinimo:0,
                Avaliacao:{},
                nome: '',
                endereço: '',
                taxa:0,
                estado: 'nome' };
            //const name = contact.pushname || "tudo bem?";${name}
            message.reply(`${saudacaoPorHora()} Bem-vindo à *Center Carros!* Estamos prontos para ajudá-lo a *encontrar* o carro perfeito. 🚗✨`)
                .then(() => client.sendMessage(message.from,'Poderia nos informar *seu nome,* por favor:'));
            
        } else {
            // Verifica o estado do cliente e responde de acordo
            handleClientResponse(client, message);
        }
    }
});

const CarrosDisponiveis = [
    {tipo: 'Sedan', marca: 'Toyota',modelo: 'Corolla',ano:2020, preco: 75000,id:'tc01.jpg', descritivo:"Quilometragem: 105000\nPotência do motor: 2.0 - 2.9\nCombustível: Flex\nCâmbio: Automático\nCor: Cinza\nPortas: 4 portas"},
    {tipo: 'Sedan', marca: 'Honda',modelo: 'Civic',ano:2019, preco: 85000,id:'sh01.jpg',descritivo:""},
    {tipo: 'Sedan', marca: 'Chevrolet',modelo: 'Cruze',ano:2018, preco: 80000,id:'sc01.jpg',descritivo:""},
    {tipo: 'SUV', marca: 'Jeep',modelo: 'Compass', ano:2021,preco: 90000,id:'suj01.jpeg',descritivo:""},
    {tipo: 'SUV', marca: 'Hyundai',modelo: 'Creta', ano:2020,preco: 85000,id:'suh01.jpeg',descritivo:""},
    {tipo: 'SUV', marca: 'Chevrolet',modelo: 'tracker', ano:2022,preco: 82000,id:'suc01.jpg',descritivo:""},
    {tipo: 'Hatch', marca: 'Nissan',modelo: 'March',ano:2017, preco: 48000,id:'hn01.jpeg',descritivo:""},
    {tipo: 'Hatch', marca: 'Peugeot',modelo: '208',ano:2021, preco: 72000,id:'hp01.jpeg',descritivo:""},
    {tipo: 'Hatch', marca: 'Fiat',modelo: 'Argo',ano:2020, preco: 55000,id:'hf01.jpg',descritivo:""},
    {tipo: 'Hatch', marca: 'honda',modelo: 'New Beta',ano:2022, preco: 40000,id:'hh01.jpg',descritivo:""}
];

const TermosConfirmo = [
    'ver veiculos','ver veículos','1','um','primeiro','disponíveis','disponiveis','um','1','disponível',
    'disponivel'
];

const TermosAvaliacao = [
    'avaliação','avaliacao','avaliar','troca','avaliar meu veiculo','4','quatro'];

const TermosAgendar= [
        'agendar','agendamento','3','tres','três'];

const TermosOK= [
            'sim','quero','começar','comecar','simm'];
const TermosAtedente = [
                'atendente','vendedor','cinco','5'];
const TermosFinanciamento = [
                    'simular','financiamento','2','dois'];

const CancelarNao = [
                        'não','voltar','sair','cancelar'];
    

const cancelar = new RegExp(`\\b(${CancelarNao.join('|')})\\b`, 'i');
const ConfirmoFinanciamento = new RegExp(`\\b(${TermosFinanciamento.join('|')})\\b`, 'i');
const ConfirmoAtendente = new RegExp(`\\b(${TermosAtedente.join('|')})\\b`, 'i');
const Confirmo = new RegExp(`\\b(${TermosOK.join('|')})\\b`, 'i');
const ConfirmoAgendar = new RegExp(`\\b(${TermosAgendar.join('|')})\\b`, 'i');
const ConfirmoVeiculos = new RegExp(`\\b(${TermosConfirmo.join('|')})\\b`, 'i');
const ConfirmoAvaliacao = new RegExp(`\\b(${TermosAvaliacao.join('|')})\\b`, 'i');

async function handleClientResponse(client, message) {
    const pedido = clientsInProgress[message.from];
    resetInactivityTimer(message.from);
    if (pedido.estado === 'iniciar' && ConfirmoVeiculos.test(message.body.toLowerCase())) {
        client.sendMessage(
            message.from,
            `Vamos começar! Qual o *valor máximo* que você gostaria de pagar no carro?\n_Digite um valor numérico._`);
        pedido.estado = "definirOrcamento";
    }else if(pedido.estado === 'nome'){
        pedido.nome = message.body;
        message.reply(`Muito bom ter você aqui, ${pedido.nome}! Escolha uma das opções abaixo para melhor atendê-lo.`)
                .then(() => client.sendMessage(message.from,'1️⃣ Ver veículos disponíveis\n2️⃣ Simular financiamento\n3️⃣ Agendar test-drive\n4️⃣ Avaliar meu veículo para troca\n5️⃣ Falar com um vendedor'));
        
        pedido.estado = 'iniciar';
    } else if (pedido.estado === 'iniciar' && ConfirmoFinanciamento.test(message.body.toLowerCase())) {
        // Inicia o fluxo de simulação de financiamento
        pedido.estado = 'simulacao_financiamento';
        client.sendMessage(
            message.from,
            "Vamos começar a *simulação do financiamento* do seu veículo."
        ).then(() => client.sendMessage(message.from,`Por favor, informe o *valor do financiamento* desejado (apenas números).`));
    } else if (pedido.estado === 'simulacao_financiamento') {
        let valorEntrada = message.body.toLowerCase().replace(',', '.'); // Substitui vírgula por ponto
        let valorFinanciado;
    
        // Verifica se a mensagem contém "mil" e processa adequadamente
        if (valorEntrada.includes('mil')) {
            const numeros = parseFloat(valorEntrada.replace('mil', '').trim()); // Remove "mil" e converte para número
            valorFinanciado = numeros * 1000; // Multiplica por 1000
        } else {
            valorFinanciado = parseFloat(valorEntrada); // Converte diretamente
        }
    
        if (isNaN(valorFinanciado) || valorFinanciado <= 0) {
            client.sendMessage(
                message.from,
                "Por favor, insira um valor válido para o financiamento\n_Apenas números: 40000_"
            );
        } else {
            pedido.Financiamento = { valorFinanciado };
            pedido.estado = 'simulacao_parcelas';
            client.sendMessage(
                message.from,
                "Ótimo! Agora informe o *número de parcelas* desejado (por exemplo: 12, 24, 36)."
            );
        }
    } else if (pedido.estado === 'simulacao_parcelas') {
        const numParcelas = parseInt(message.body);
        if (isNaN(numParcelas) || numParcelas <= 0) {
            client.sendMessage(
                message.from,
                "Por favor, insira um *número válido* de parcelas."
            );
        } else {
            pedido.Financiamento.numParcelas = numParcelas;
    
            // Taxas de juros simuladas
            const taxas = {
                Itaú: 2.0,
                Bradesco: 2.2,
                BV: 2.5,
                Santander: 1.8,
                Caixa: 2.1,
            };
    
            let taxaMensagem = "*Taxas de Juros Atualizadas - Mês Atual:*";
            for (const [banco, taxa] of Object.entries(taxas)) {
                taxaMensagem += `\n*${banco}:* _${taxa}% ao mês_`;
            }
    
            pedido.estado = 'simulacao_banco';
            client.sendMessage(
                message.from,
                `${taxaMensagem}\n\n*Escolha o banco* para a simulação (Itaú, Bradesco, BV, Santander, Caixa).`
            );
            pedido.Financiamento.taxas = taxas;
        }
    } else if (pedido.estado === 'simulacao_banco') {
        const bancoEscolhido = message.body;
        const taxas = pedido.Financiamento.taxas || {};
        const taxaJuros = taxas[bancoEscolhido];
        if (!taxaJuros) {
            client.sendMessage(
                message.from,
                "Por favor, escolha um banco válido entre as opções fornecidas (Itaú, Bradesco, BV, Santander, Caixa)."
            );
        } else {
            const { valorFinanciado, numParcelas } = pedido.Financiamento;
    
            // Funções de cálculo
            const calcularParcela = (valor, taxa, parcelas) => {
                const taxaMensal = taxa / 100;
                return (valor * taxaMensal * Math.pow(1 + taxaMensal, parcelas)) /
                    (Math.pow(1 + taxaMensal, parcelas) - 1);
            };
    
            const calcularIOF = (valor, parcelas) => {
                const iofFixo = valor * 0.0038;
                const iofDiario = valor * 0.0001118 * (30 * parcelas);
                return iofFixo + iofDiario;
            };
    
            const parcelaMensal = calcularParcela(valorFinanciado, taxaJuros, numParcelas);
            const valorTotalParcelas = parcelaMensal * numParcelas;
    
            const iofTotal = calcularIOF(valorFinanciado, numParcelas);
            const tarifaCadastro = 600.00;
            const registroContrato = 400.00;
            const seguroProtecaoFinanceira = valorFinanciado * 0.03;
    
            const valorTotalFinanciamento = (
                valorTotalParcelas + iofTotal + tarifaCadastro + registroContrato + seguroProtecaoFinanceira
            );
    
            // Resumo da simulação
            client.sendMessage(
                message.from,
                `*RESUMO DA SIMULAÇÃO*:\n` +
                `Banco Escolhido: _${bancoEscolhido}_\n` +
                `Valor Financiado: _${valorFinanciado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}_\n` +
                `Taxa de Juros: _${taxaJuros.toFixed(2)}% ao mês_\n` +
                `Número de Parcelas: _${numParcelas}_\n` +
                `Valor da Parcela: _${parcelaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}_\n` +
                `Valor Total das Parcelas: _${valorTotalParcelas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}_\n` +
                `IOF Total: _${iofTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}_\n` +
                `Tarifa de Cadastro: _${tarifaCadastro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}_\n` +
                `Registro de Contrato: _${registroContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}_\n` +
                `Seguro de Proteção Financeira: _${seguroProtecaoFinanceira.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}_\n` +
                `*Valor Total do Financiamento: _${valorTotalFinanciamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}_*`
            ).then(() => {
                client.sendMessage(message.from, "Simulação concluída! você gostaria de falar com o nosso atendimento?\n_Responda: Sim ou Não_😊")
            });

            pedido.estado = 'gostousimulacao';
        }
    } else if (pedido.estado === 'gostousimulacao') {
        if (!cancelar.test(message.body.toLowerCase())) {
            client.sendMessage(message.from, 'Ótima! Estamos *lhe encaminhando* para nosso time de atendimento.')
                .then(() => {
                    pedido.estado = 'reiniciar';
                });
        } else {
            client.sendMessage(message.from, 'Você gostaria de falar com alguém do *nosso time?*')
                .then(() => {
                    client.sendMessage(message.from, 'Podemos verificar se temos uma opção que mais combina com você!\nResponda *"sim"* ou *"não"*')
                });
                pedido.estado = 'verificarAtendimentoSimulacao';
        }
    } else if (pedido.estado === 'verificarAtendimentoSimulacao') {
        if (!cancelar.test(message.body.toLowerCase())) {
            client.sendMessage(message.from, 'Ok! Estamos *encaminhando* você para o nosso atendimento humano.')
                .then(() => {
                    pedido.estado = 'reiniciar';
                });
        } else {
            client.sendMessage(message.from, 'Tudo bem! Caso precise de algo, estamos à disposição. Obrigado pelo contato!');
            delete clientsInProgress[message.from];
        }
    } else if (pedido.estado === 'iniciar' && ConfirmoAgendar.test(message.body.toLowerCase())) {
        // Inicia o fluxo de agendamento de test-drive
        pedido.estado = 'agendar_test_drive';
        client.sendMessage(message.from, "Você gostaria de agendar um *test-drive*? Responda com 'Sim' para continuar.");
        
    } else if (pedido.estado === 'agendar_test_drive' && Confirmo.test(message.body.toLowerCase())) {
        pedido.estado = 'escolher_carro';
        client.sendMessage(message.from, "Qual o *carro da nossa frota* que você gostaria de realizar o teste?");
        
    } else if (pedido.estado === 'escolher_carro') {
        // Salva o carro escolhido pelo cliente
        pedido.TestDrive = { carro: message.body };
        pedido.estado = 'escolher_dia';
        client.sendMessage(message.from, "Qual o *dia da semana* você gostaria de agendar o test-drive?");
        
    } else if (pedido.estado === 'escolher_dia') {
        // Salva o dia escolhido
        pedido.TestDrive.dia = message.body;
        pedido.estado = 'escolher_nome';
        client.sendMessage(message.from, "Qual o *horário* que você gostaria de realizar o test-drive?");
    } else if (pedido.estado === 'escolher_nome') {
        // Salva o dia escolhido
        pedido.TestDrive.hora = message.body;
        pedido.estado = 'escolher_numero_contato';
        client.sendMessage(message.from, "Estamos finalizando, me diga seu *nome*, por favor!");
    } else if (pedido.estado === 'escolher_numero_contato') {
        // Salva o dia escolhido
        pedido.TestDrive.nome = message.body;
        pedido.estado = 'escolher_horario';
        client.sendMessage(message.from, "Qual seu *número de telefone* para contato?");
    
    } else if (pedido.estado === 'escolher_horario') {
        // Salva o horário escolhido
        pedido.TestDrive.telefone = message.body;
        pedido.estado = 'finalizar_test_drive';
        const protocolo = gerarProtocolo();
        client.sendMessage(message.from, `Perfeito, *${pedido.TestDrive.nome}*! Seu agendamento foi feito para o carro *${pedido.TestDrive.carro}* no dia *${pedido.TestDrive.dia}* às *${pedido.TestDrive.hora}*.\n_Número de protocolo: ${protocolo}_`);
        client.sendMessage(message.from, "Nossa equipe vai verificar a disponibilidade e entrará em contato com você para confirmar. Estamos muito felizes em participar dessa experiência com você. 😊");
    
        // Reseta o estado do pedido
        pedido.estado = 'reiniciar';
    } else if (pedido.estado === 'iniciar' && ConfirmoAtendente.test(message.body.toLowerCase())) {
        // Fluxo para o Item 5
        pedido.estado = 'direcionar_vendas';
        client.sendMessage(message.from, "Estamos muito contentes com você por aqui na *Center Carros*.");
        client.sendMessage(message.from, "Estou direcionando você para nosso *time de vendas*. Por favor, aguarde um momento.");
        
        // Aqui você pode adicionar uma lógica para notificar o time de vendas, se necessário.
        pedido.estado = 'reiniciar'; // Reseta o estado do pedido
    }
     
    else if (pedido.estado === 'iniciar' && ConfirmoAvaliacao.test(message.body.toLowerCase())) {
        // Inicia o fluxo de avaliação do veículo
        pedido.estado = 'avaliar_veiculo';
        client.sendMessage(message.from, 
            `*Vamos começar!*\nPor favor, me diga:\n1️⃣ Qual é o seu carro (modelo e versão)?`
        );
    } else if (pedido.estado === 'avaliar_veiculo') {
        if (!pedido.Avaliacao.carro) {
            // Recebe o modelo e versão do carro
            pedido.Avaliacao.carro = message.body;
            client.sendMessage(message.from, `2️⃣ Qual o ano do seu carro?`);
        } else if (!pedido.Avaliacao.ano) {
            // Recebe o ano do carro
            pedido.Avaliacao.ano = message.body;
            client.sendMessage(message.from, `3️⃣ Qual a marca do seu carro?`);
        } else if (!pedido.Avaliacao.marca) {
            // Recebe a marca do carro
            pedido.Avaliacao.marca = message.body;
            client.sendMessage(message.from, `4️⃣ Qual a quilometragem atual do seu carro?`);
        } else if (!pedido.Avaliacao.quilometragem) {
            // Recebe a quilometragem do carro
            pedido.Avaliacao.quilometragem = message.body;
            client.sendMessage(message.from, 
                `5️⃣ Certo! Agora você precisa *enviar as fotos* do seu carro.`
            ).then(() => client.sendMessage(message.from,`Envie *uma foto* da frente do carro:`));;
            pedido.estado ='aguardando_fotos';
            
        }
    } else if (pedido.estado === 'aguardando_fotos') {
        if (message.hasMedia) {
            // Armazena as fotos enviadas
            if (!pedido.Avaliacao.fotos) pedido.Avaliacao.fotos = [];
            pedido.Avaliacao.fotos.push(message.body); // Supondo que a imagem seja salva como ID ou URL

            if (pedido.Avaliacao.fotos.length === 1) {
                client.sendMessage(message.from, `Concluído (1/5) ✅`)
                .then(() => client.sendMessage(message.from,`Agora envie a foto da *Lateral Direita:*`));
            } else if(pedido.Avaliacao.fotos.length ===2){
                client.sendMessage(message.from, `Concluído (2/5) ✅`)
                .then(() => client.sendMessage(message.from,`Agora envie a foto da *Lateral Esquerda:*`));
            }else if(pedido.Avaliacao.fotos.length === 3){
                client.sendMessage(message.from, `Concluído (3/5) ✅`)
                .then(() => client.sendMessage(message.from,`Agora envie a foto da *Traseira do Carro:*`));    
            }else if(pedido.Avaliacao.fotos.length === 4){
                client.sendMessage(message.from, `Concluído (4/5) ✅`)
                .then(() => client.sendMessage(message.from,`Agora envie a foto *Interna do Carro:*`));
            }
            if (pedido.Avaliacao.fotos.length > 4) {
                client.sendMessage(message.from, `Etapa *concluída!* ✅`)
                .then(() => client.sendMessage(message.from,'Para finalizar me diga *seu nome*:'));
                pedido.estado = 'avaliacao_telefone';
            }
        } else {
            client.sendMessage(message.from, `Por favor, envie as fotos do carro.`);
        }
    }else if(pedido.estado === 'avaliacao_concluido'){
        const protocolo = gerarProtocolo();
        client.sendMessage(message.from, `Recebemos suas informações e fotos. Nossa *equipe* fará a *avaliação* e entrará em *contato com você* em breve.\n_Número de protocolo: ${protocolo}_`);
        pedido.estado = 'reiniciar';
        pedido.Avaliacao = {};
    }else if(pedido.estado==='avaliacao_telefone'){
        client.sendMessage(message.from, `Por fim, me diga seu *número para contato:*`);
        pedido.estado = 'avaliacao_concluido';
        //
        //
    } else if (pedido.estado === 'definirOrcamento') {
        const interpretarValor = (entrada) => {
            entrada = entrada.toLowerCase(); // Converte tudo para minúsculo
            if (entrada.includes('mil')) {
                // Substitui "mil" por 1000, tratando números antes de "mil"
                const partes = entrada.split('mil');
                const numeroAntesDeMil = parseFloat(partes[0].replace(',', '.').trim()) || 1; // Se não houver número antes, considera 1
                return numeroAntesDeMil * 1000;
            }
            // Caso não inclua "mil", tenta converter diretamente
            return parseFloat(entrada.replace(/[^\d.]/g, ''));
        };
    
        const orcamento = interpretarValor(message.body); // Interpreta o valor do orçamento
    
        if (isNaN(orcamento) || orcamento <= 0) {
            client.sendMessage(
                message.from,
                `Por favor, envie um valor válido para o orçamento. Exemplo: 75000`
            );
        } else {
            pedido.QuerPagar = orcamento;
    
            // Filtrar os tipos de carro que possuem valores dentro do orçamento
            const tiposDisponiveis = [...new Set(
                CarrosDisponiveis.filter(carro => carro.preco <= orcamento)
                .map(carro => carro.tipo)
            )];
    
            if (tiposDisponiveis.length > 0) {
                client.sendMessage(
                    message.from,
                    `Com base no seu orçamento de *R$${orcamento.toLocaleString()},* esses são os tipos de *veículos disponíveis:*\n` +
                    tiposDisponiveis.map((tipo, index) => `${index + 1}️⃣ ${tipo}`).join("\n") +
                    `\nDigite o tipo de veículo que deseja escolher.`
                );
                pedido.estado = "escolhertipo";
            } else {
                client.sendMessage(
                    message.from,
                    `Não encontramos veículos dentro do seu orçamento de R$${orcamento.toLocaleString()}. Que tal ajustar o valor?`
                );
            }
        }
    }else if (pedido.estado === 'escolhertipo') {
        const tipoSelecionado = message.body.toLowerCase();
    
        // Verificar se o tipo está disponível no orçamento
        const tiposDisponiveis = [...new Set(
            CarrosDisponiveis.filter(carro => carro.preco <= pedido.QuerPagar)
            .map(carro => carro.tipo.toLowerCase())
        )];
    
        // Criar um mapeamento de tipos com seus índices
        const tiposComIndice = tiposDisponiveis.map((tipo, index) => ({
            indice: index + 1,
            tipo: tipo
        }));
    
        // Função para converter números por extenso em valores numéricos
        const numerosPorExtenso = {
            'um': 1, 'dois': 2, 'tres': 3, 'quatro': 4, 'cinco': 5,
            'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10
        };
    
        let tipoCorrespondente = null;
    
        if (!isNaN(tipoSelecionado)) {
            // Se o cliente digitou um número
            const indice = parseInt(tipoSelecionado, 10);
            const tipoPorIndice = tiposComIndice.find(item => item.indice === indice);
            if (tipoPorIndice) tipoCorrespondente = tipoPorIndice.tipo;
        } else if (numerosPorExtenso[tipoSelecionado]) {
            // Se o cliente digitou o número por extenso
            const indice = numerosPorExtenso[tipoSelecionado];
            const tipoPorIndice = tiposComIndice.find(item => item.indice === indice);
            if (tipoPorIndice) tipoCorrespondente = tipoPorIndice.tipo;
        } else if (tiposDisponiveis.includes(tipoSelecionado)) {
            // Se o cliente digitou o nome diretamente
            tipoCorrespondente = tipoSelecionado;
        }
    
        if (tipoCorrespondente) {
            pedido.TipoCarro = tipoCorrespondente;
            // Aqui você pode enviar a lista de marcas disponíveis ao cliente
            client.sendMessage(message.from, `Ótima escolha! Agora, vamos lhe mostrar as *opções disponíveis.* Posso mandar?`);
            pedido.estado = 'mostrar';
        } else {
            client.sendMessage(message.from, `Tipo inválido. Por favor, digite o número ou o nome do tipo que deseja.`);
        };
    } else if (pedido.estado === 'mostrar') {
        // Função para filtrar os carros disponíveis
        function filtrarCarros({
            tipo = null, 
            marca = null, 
            modelo = null, 
            ano = null, 
            precoMaiorQue = null, 
            precoMenorQue = null
        }) {
            return CarrosDisponiveis.filter(carro => {
                const tipoValido = !tipo || carro.tipo.toLowerCase() === tipo.toLowerCase();
                const marcaValida = !marca || carro.marca.toLowerCase() === marca.toLowerCase();
                const modeloValido = !modelo || carro.modelo.toLowerCase() === modelo.toLowerCase();
                const anoValido = !ano || carro.ano === ano;
                const precoMaiorValido = !precoMaiorQue || carro.preco >= precoMaiorQue;
                const precoMenorValido = !precoMenorQue || carro.preco <= precoMenorQue;
    
                return tipoValido && marcaValida && modeloValido && anoValido && precoMaiorValido && precoMenorValido;
            });
        }
    
        // Filtrar carros com base nos parâmetros escolhidos pelo cliente
        const carros = filtrarCarros({
            tipo: pedido.TipoCarro,
            precoMenorQue: pedido.QuerPagar
        });
    
        if (carros.length > 0) {
            // Enviar mensagem com os carros disponíveis
            client.sendMessage(message.from, `Aqui estão os *carros disponíveis* com base na sua escolha:\n`)
                .then(() => {
                    // Criar uma lista de Promises para o envio das imagens
                    const envioCarros = carros.map(carro => {
                        const imagePath = `./carros/${carro.id}`; // Caminho do arquivo de imagem
                        const media = MessageMedia.fromFilePath(imagePath); // Cria a mídia a partir do caminho do arquivo
    
                        // Retorna a Promise do envio da mensagem
                        return client.sendMessage(message.from, media, {
                            caption: `🚗 *${carro.marca} ${carro.modelo}*\n*Ano:* ${carro.ano}\n*Preço:* R$${carro.preco.toLocaleString('pt-BR')}\n${carro.descritivo || "Sem descrição disponível."}`
                        });
                    });
    
                    // Aguarda que todos os envios sejam concluídos
                    return Promise.all(envioCarros);
                })
                .then(() => {
                    // Envia a mensagem final após todos os carros terem sido enviados
                    client.sendMessage(message.from, 'Você *gostou* de algum modelo? Se sim, digite o nome do carro:');
                    pedido.estado = 'gostoucarro';
                })
                .catch(error => {
                    console.error('Erro ao enviar mensagens:', error);
                });
        } else {
            client.sendMessage(message.from, 'Não há carros disponíveis com base na sua escolha.');
        }
    } else if (pedido.estado === 'gostoucarro') {
        if (!cancelar.test(message.body.toLowerCase())) {
            client.sendMessage(message.from, 'Ótima escolha! Estamos *lhe encaminhando* para nosso time de atendimento.')
                .then(() => {
                    // Aqui você pode adicionar a lógica de redirecionamento para o atendimento
                    pedido.estado = 'reiniciar';
                });
        } else {
            client.sendMessage(message.from, 'Você gostaria de falar com alguém do *nosso time?*')
                .then(() => {
                    client.sendMessage(message.from, 'Podemos verificar se temos uma opção que mais combina com você!\nResponda *"sim"* ou *"não"*')
                });
                pedido.estado = 'verificarAtendimentoHumano';
        }
    } else if (pedido.estado === 'verificarAtendimentoHumano') {
        if (!cancelar.test(message.body.toLowerCase())) {
            client.sendMessage(message.from, 'Ok! Estamos *encaminhando* você para o nosso atendimento humano.')
                .then(() => {
                    pedido.estado = 'reiniciar';
                });
        } else {
            client.sendMessage(message.from, 'Tudo bem! Caso precise de algo, estamos à disposição. Obrigado pelo contato!');
            delete clientsInProgress[message.from];
        }
    } else if (message.body.toLowerCase() === 'não' && pedido.estado === 'iniciar') {
        message.reply('Poxa, que pena que não vai precisar. Mas qualquer coisa, estamos aqui. Desde já, agradecemos o contato!');
        delete clientsInProgress[message.from]; // Resetar o estado
    } else if (pedido.estado === 'reiniciar') {
        message.reply(`O que você deseja fazer agora?`)
            .then(() => client.sendMessage(message.from,'1️⃣ Ver veículos disponíveis\n2️⃣ Simular financiamento\n3️⃣ Agendar test-drive\n4️⃣ Avaliar meu veículo para troca\n5️⃣ Falar com um vendedor'));
        pedido.estado = 'iniciar';
    }
    

// Função para iniciar o temporizador de inatividade (5 minutos)
function startInactivityTimer(clientId) {
    clientTimers[clientId] = setTimeout(() => {
        // Se não houver interação por 5 minutos, reinicia o atendimento
        console.log(`Cliente ${clientId} inativo por 5 minutos. Reiniciando atendimento...`);
        resetClientState(clientId);
    }, 1 * 60 * 1000); // 5 minutos
}
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
