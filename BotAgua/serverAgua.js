const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise'); // Use a versão de promise para facilitar o uso de async/await
const https = require('https');
const app = express();
const port = 3001;
const fs = require('fs');

const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/serveraquagas.shop/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/serveraquagas.shop/fullchain.pem'),
};
// Configuração do pool de conexões
const pool = mysql.createPool({
  host: 'myboxclub.com.br',
  user: 'u129712343_gustavo',
  password: 'GustavoTocantins360#',
  database: 'u129712343_BaseClientes',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

app.use(cors());
app.use(express.json());

// Testa a conexão com o banco de dados na inicialização
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Conexão bem-sucedida ao banco de dados!');
    connection.release(); // Libera a conexão de volta ao pool
  } catch (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  }
})();

// Rota para adicionar um novo pedido
app.post('/pedido', async (req, res) => {
  const { itens, local,valor,pagamento,descricao, cliente, whatsapp } = req.body;
  const now = new Date();
  const hora = now.toTimeString().split(' ')[0]; // Hora no formato HH:mm:ss
  const data = now.toISOString().split('T')[0]; // Data no formato YYYY-MM-DD
  const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']; // Siglas para os dias da semana
  const dia = diasSemana[now.getDay()]; // Pega o índice do dia da semana
  if (!descricao || !cliente || !whatsapp) {
    return res.status(400).json({ error: 'Descrição, cliente e WhatsApp são obrigatórios' });
  }

  const sql = `
    INSERT INTO pedidos_agua (descricao, nome_cliente, whatsapp, status,itens,local,valor,hora,dia,data,pagamentos )
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `;

  try {
    const [result] = await pool.execute(sql, [descricao, cliente, whatsapp,'aberto',itens,local,valor,hora,dia,data,pagamento]);
    res.status(201).json({
      message: 'Pedido adicionado com sucesso',
      pedido: { id: result.insertId, descricao, cliente, whatsapp, status: 'aberto' }
    });
  } catch (err) {
    console.error('Erro ao adicionar pedido:', err.message);
    res.status(500).json({ error: 'Erro ao adicionar pedido' });
  }
});

// Rota para atualizar o status de um pedido
app.put('/pedido/:id/:status', async (req, res) => {
  const { id, status } = req.params;

  const sql = 'UPDATE pedidos_agua SET status = ? WHERE id = ?';

  try {
    const [result] = await pool.execute(sql, [status, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    res.json({ message: `Status do pedido atualizado para "${status}"` });
  } catch (err) {
    console.error('Erro ao atualizar status do pedido:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar pedido' });
  }
});

// Rota para buscar pedidos com filtro (status em aberto)
app.get('/pedidos/abertos', async (req, res) => {
  const sql = 'SELECT * FROM pedidos_agua';

  try {
    const [resultados] = await pool.execute(sql);
    res.json({ pedidos: resultados });
  } catch (err) {
    console.error('Erro ao buscar pedidos:', err.message);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

// Rota para buscar todos os produtos no estoque
app.get('/estoque', async (req, res) => {
  const sql = 'SELECT id, nome, imagem, quantidade, created_at, updated_at FROM estoque';

  try {
    const [produtos] = await pool.execute(sql);
    res.json({ produtos });
  } catch (err) {
    console.error('Erro ao buscar produtos:', err.message);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

// Rota para atualizar a quantidade de um produto
app.put('/estoque/:id', async (req, res) => {
  const { id } = req.params;
  const { quantidade } = req.body;

  if (quantidade < 0) {
    return res.status(400).json({ error: 'Quantidade não pode ser negativa' });
  }

  const sql = 'UPDATE estoque SET quantidade = ?, updated_at = NOW() WHERE id = ?';

  try {
    const [result] = await pool.execute(sql, [quantidade, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    res.json({ message: 'Quantidade atualizada com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar quantidade:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

app.get('/cliente/:whatsapp', async (req, res) => {
  const { whatsapp } = req.params;

  const sql = 'SELECT * FROM clientes WHERE whatsapp = ?';

  try {
    const [clientes] = await pool.execute(sql, [whatsapp]);

    if (clientes.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    res.json({ cliente: clientes[0] });
  } catch (err) {
    console.error('Erro ao buscar cliente:', err.message);
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});
app.post('/cliente', async (req, res) => {
  const { nome, whatsapp, endereco, bairro, genero } = req.body;

  if (!nome || !whatsapp || !endereco || !bairro) {
    return res.status(400).json({ error: 'Nome, WhatsApp e endereço são obrigatórios' });
  }

  try {
    // Verifica se o WhatsApp já existe
    const [existingClient] = await pool.execute('SELECT * FROM clientes WHERE whatsapp = ?', [whatsapp]);

    if (existingClient.length > 0) {
      // Se o WhatsApp existir, atualiza os outros dados
      const sql = 'UPDATE clientes SET nome = ?, endereco = ?, bairro = ?, genero = ? WHERE whatsapp = ?';
      await pool.execute(sql, [nome, endereco, bairro, genero,whatsapp]);

      res.status(200).json({
        message: 'Cliente atualizado com sucesso',
        cliente: { nome, whatsapp, endereco, bairro,genero },
      });
    } else {
      // Se o WhatsApp não existir, insere um novo cliente
      const sql = 'INSERT INTO clientes (nome, whatsapp, endereco, bairro, genero) VALUES (?, ?, ?, ?,?)';
      const [result] = await pool.execute(sql, [nome, whatsapp, endereco, bairro, genero]);

      res.status(201).json({
        message: 'Cliente cadastrado com sucesso',
        cliente: { id: result.insertId, nome, whatsapp, endereco, bairro },
      });
    }
  } catch (err) {
    console.error('Erro ao cadastrar ou atualizar cliente:', err.message);
    res.status(500).json({ error: 'Erro ao cadastrar ou atualizar cliente' });
  }
});


// Rota para buscar um produto específico (opcional)
app.get('/estoque/:id', async (req, res) => {
  const { id } = req.params;

  const sql = 'SELECT id, nome, imagem, quantidade, created_at, updated_at FROM estoque WHERE id = ?';

  try {
    const [produtos] = await pool.execute(sql, [id]);

    if (produtos.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    res.json({ produto: produtos[0] });
  } catch (err) {
    console.error('Erro ao buscar produto:', err.message);
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});


// Inicia o servidor
https.createServer(options, app).listen(port, () => {
  console.log('Servidor HTTPS rodando na porta 3001');
});
