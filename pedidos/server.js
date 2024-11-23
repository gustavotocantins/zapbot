const express = require('express');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware para interpretar JSON
app.use(express.json());

// Arquivo para armazenar os pedidos
const pedidosFile = 'pedidos.json';

// Função para carregar pedidos do arquivo
function carregarPedidos() {
    if (fs.existsSync(pedidosFile)) {
        const data = fs.readFileSync(pedidosFile, 'utf8');
        return JSON.parse(data);
    }
    return [];
}

// Função para salvar pedidos no arquivo
function salvarPedidos(pedidos) {
    fs.writeFileSync(pedidosFile, JSON.stringify(pedidos, null, 2));
}

// Rota para adicionar um novo pedido
app.post('/pedido', (req, res) => {
    const { descricao, cliente, whatsapp } = req.body;

    if (!descricao || !cliente || !whatsapp) {
        return res.status(400).json({ error: 'Descrição, cliente e WhatsApp são obrigatórios' });
    }

    const pedidos = carregarPedidos();
    const novoPedido = {
        id: pedidos.length + 1,
        descricao,
        cliente,
        whatsapp,
        status: 'aberto'
    };
    pedidos.push(novoPedido);
    salvarPedidos(pedidos);

    res.status(201).json({ message: 'Pedido adicionado com sucesso', pedido: novoPedido });
});

// Rota para marcar um pedido como concluído
app.put('/pedido/:id/concluir', (req, res) => {
    const { id } = req.params;
    const pedidos = carregarPedidos();
    const pedido = pedidos.find(p => p.id === parseInt(id));

    if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    pedido.status = 'concluído';
    salvarPedidos(pedidos);

    res.json({ message: 'Pedido concluído com sucesso', pedido });
});

// Rota para retornar todos os pedidos em aberto
app.get('/pedidos/abertos', (req, res) => {
    const pedidos = carregarPedidos();
    const pedidosAbertos = pedidos.filter(p => p.status === 'aberto');

    res.json({ pedidosAbertos });
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
