const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise'); // Use a versão de promise para facilitar o uso de async/await

const app = express();
const port = 3001;

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

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
