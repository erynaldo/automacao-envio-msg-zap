require('dotenv').config()
const { Pool } = require('pg')
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
})
// Cria as tabelas caso ainda não existam
async function inicializarBanco() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'inativo',
            criado_em TIMESTAMP DEFAULT NOW()
        )
    `)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tarefas (
            id SERIAL PRIMARY KEY,
            nome_professor TEXT NOT NULL,
            telefone_professor TEXT NOT NULL,
            nome_disciplina TEXT NOT NULL,
            serie_turma TEXT NOT NULL,
            hora_inicio TEXT NOT NULL,
            hora_fim TEXT NOT NULL,
            dia_semana TEXT NOT NULL,
            horario_envio TEXT NOT NULL,
            mensagem_individual TEXT,
            caminho_imagem TEXT,
            criado_em TIMESTAMP DEFAULT NOW()
        )
    `)
    console.log('✅ Banco de dados pronto')
}
module.exports = { pool, inicializarBanco }