require('dotenv').config()
const path = require('path')
const express = require('express')
const cors = require('cors')
const cron = require('node-cron')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { pool, inicializarBanco } = require('./db')
const { iniciarWhatsApp, enviarMensagem, statusWhatsApp } = require('./whatsapp')
const app = express()
const PORT = process.env.PORT || 3000
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'frontend')))
// ---------- Helpers ----------
const diasSemana = {
    domingo: 0, segunda: 1, terca: 2, terça: 2,
    quarta: 3, quinta: 4, sexta: 5, sabado: 6, sábado: 6
}
let notifications = []
let notificationId = 0
const jobsAgendados = new Map() // id_tarefa -> cron.ScheduledTask
function addNotification(message) {
    notificationId++
    notifications.push({
        id: notificationId,
        message,
        timestamp: new Date().toLocaleTimeString('pt-BR')
    })
    if (notifications.length > 100) notifications.shift()
    console.log(message)
}
function verificarToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader) return res.status(401).json({ error: 'Token ausente' })
        const token = authHeader.split(' ')[1]
        req.usuario = jwt.verify(token, process.env.JWT_SECRET)
        next()
    } catch {
        return res.status(401).json({ error: 'Token inválido' })
    }
}
// ---------- Autenticação ----------
app.post('/cadastro', async (req, res) => {
    try {
        let { nome, email, senha } = req.body
        if (!nome || !email || !senha) {
            return res.json({ success: false, error: 'Preencha todos os campos' })
        }
        nome = nome.toUpperCase()
        const existente = await pool.query(
            'SELECT id FROM usuarios WHERE email = $1', [email]
        )
        if (existente.rows.length > 0) {
            return res.json({ success: false, error: 'E-mail já cadastrado' })
        }
        const senhaHash = await bcrypt.hash(senha, 10)
        await pool.query(
            `INSERT INTO usuarios (nome, email, senha, status)
             VALUES ($1, $2, $3, 'inativo')`,
            [nome, email, senhaHash]
        )
        addNotification(`👤 Novo usuário cadastrado: ${email}`)
        res.json({ success: true })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error: 'Erro no cadastro' })
    }
})
app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1', [email]
        )
        if (result.rows.length === 0) {
            return res.json({ success: false, error: 'Usuário não encontrado' })
        }
        const usuario = result.rows[0]
        if (usuario.status !== 'ativo') {
            return res.json({ success: false, error: 'Usuário inativo' })
        }
        const senhaValida = await bcrypt.compare(senha, usuario.senha)
        if (!senhaValida) {
            return res.json({ success: false, error: 'Senha inválida' })
        }
        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, email: usuario.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )
        addNotification(`🔐 Usuário fez login: ${usuario.email}`)
        res.json({ success: true, token })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error: 'Erro no login' })
    }
})
// ---------- Tarefas (CRUD) ----------
app.get('/tarefas', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tarefas ORDER BY id DESC')
        res.json({ success: true, tarefas: result.rows })
    } catch (error) {
        console.log(error)
        res.json({ success: false })
    }
})
app.post('/criar-tarefa', verificarToken, async (req, res) => {
    try {
        let {
            nomeProfessor, telefoneProfessor, nomeDisciplina,
            serieTurma, horaInicio, horaFim, diaSemana,
            horarioEnvio, mensagemIndividual, caminhoImagem
        } = req.body
        nomeProfessor = (nomeProfessor || '').toUpperCase()
        nomeDisciplina = (nomeDisciplina || '').toUpperCase()
        serieTurma = (serieTurma || '').toUpperCase()
        diaSemana = (diaSemana || '').toUpperCase()
        await pool.query(
            `INSERT INTO tarefas (
                nome_professor, telefone_professor, nome_disciplina,
                serie_turma, hora_inicio, hora_fim, dia_semana,
                horario_envio, mensagem_individual, caminho_imagem
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [nomeProfessor, telefoneProfessor, nomeDisciplina,
             serieTurma, horaInicio, horaFim, diaSemana,
             horarioEnvio, mensagemIndividual, caminhoImagem]
        )
        addNotification(`📚 Novo lembrete criado para: ${nomeProfessor}`)
        res.json({ success: true })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error: 'Erro ao salvar tarefa' })
    }
})
app.put('/tarefas/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params
        let {
            nomeProfessor, telefoneProfessor, nomeDisciplina,
            serieTurma, horaInicio, horaFim, diaSemana, horarioEnvio, mensagemIndividual, caminhoImagem
        } = req.body
        nomeProfessor = (nomeProfessor || '').toUpperCase()
        nomeDisciplina = (nomeDisciplina || '').toUpperCase()
        serieTurma = (serieTurma || '').toUpperCase()
        diaSemana = (diaSemana || '').toUpperCase()
        await pool.query(
            `UPDATE tarefas SET
                nome_professor=$1, telefone_professor=$2, nome_disciplina=$3,
                serie_turma=$4, hora_inicio=$5, hora_fim=$6,
                dia_semana=$7, horario_envio=$8, mensagem_individual=$9, caminho_imagem=$10 
             WHERE id=$11`,
            [nomeProfessor, telefoneProfessor, nomeDisciplina,
             serieTurma, horaInicio, horaFim, diaSemana, horarioEnvio, mensagemIndividual, caminhoImagem, id]
        )
        addNotification(`✏️ Tarefa #${id} alterada`)
        res.json({ success: true })
    } catch (error) {
        console.log(error)
        res.json({ success: false })
    }
})
app.delete('/tarefas/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params
        await pool.query('DELETE FROM tarefas WHERE id=$1', [id])
        // cancela job se existir
        if (jobsAgendados.has(Number(id))) {
            jobsAgendados.get(Number(id)).stop()
            jobsAgendados.delete(Number(id))
        }
        addNotification(`🗑️ Tarefa #${id} removida`)
        res.json({ success: true })
    } catch (error) {
        console.log(error)
        res.json({ success: false })
    }
})
// ---------- Agendamento ----------
function limparJobs() {
    for (const job of jobsAgendados.values()) job.stop()
    jobsAgendados.clear()
}
function agendarTarefa(item) {
    const [hora, minuto, segundo = '0'] = String(item.horario_envio).split(':')
    const diaTexto = String(item.dia_semana).toLowerCase().trim()
    const diaNumero = diasSemana[diaTexto]
    if (diaNumero === undefined) {
        addNotification(`❌ Dia inválido em "${item.nome_professor}": ${item.dia_semana}`)
        return
    }
    const expr = `${segundo} ${minuto} ${hora} * * ${diaNumero}`
    const job = cron.schedule(expr, async () => {
        try {
            // const mensagem =
            //     `📚 Olá Professor(a) *${item.nome_professor}*. ` +
            //     `Sua próxima aula será na *Turma/Série:* ${item.serie_turma} ` +
            //     `>> *Disciplina:* ${item.nome_disciplina} ` +
            //     `>> *Horário:* ${item.hora_inicio}h às ${item.hora_fim}h.` +
            //     `>> *Aviso:* ${item.mensagem_individual}.`

// ============================================
            
            const mensagem =
                `📚 Olá ${item.nome_professor}. ` +
                `*AVISO IMPORTANTE:* Lembrando que ` +
                `${item.mensagem_individual}.`

// ============================================

            let imagem = null
            if (item.caminho_imagem && item.caminho_imagem.trim() !== '') {
                imagem = path.join(__dirname, 'imagens', item.caminho_imagem)
            }
            await enviarMensagem(item.telefone_professor, mensagem, imagem)
            addNotification(`📨 Mensagem enviada para ${item.nome_professor}`)
        } catch (error) {
            addNotification(`❌ Erro ao enviar para ${item.nome_professor}`)
            console.log(error)
        }
    }, { timezone: 'America/Sao_Paulo' })
    jobsAgendados.set(item.id, job)
    addNotification(
        `⏰ Agendado: ${item.nome_professor} | Fone ${item.telefone_professor} | ` +
        `${item.dia_semana} | Horário ${hora}:${minuto}:${segundo}`
    )
}
app.post('/start', verificarToken, async (req, res) => {
    try {
        limparJobs()
        addNotification('⚙️ Automação iniciada (lendo tarefas do banco de dados)')
        const result = await pool.query('SELECT * FROM tarefas ORDER BY id')
        result.rows.forEach(agendarTarefa)
        addNotification(`✅ ${result.rows.length} tarefa(s) agendada(s)`)
        res.json({ success: true, total: result.rows.length })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error: 'Erro ao iniciar automação' })
    }
})
app.post('/stop', verificarToken, (req, res) => {
    limparJobs()
    addNotification('🛑 Automação parada')
    res.json({ success: true })
})
// ---------- Status / notificações ----------
app.get('/status', (req, res) => {
    res.json({
        driver_ready: statusWhatsApp(),
        scheduler_running: jobsAgendados.size > 0,
        jobs_count: jobsAgendados.size
    })
})
app.get('/notifications', (req, res) => {
    const lastId = parseInt(req.query.last_id || 0)
    const novas = notifications.filter(n => n.id > lastId)
    res.json({ notifications: novas })
})
// ---------- Inicialização ----------
;(async () => {
    try {
        await inicializarBanco()
        iniciarWhatsApp()
        app.listen(PORT, () => {
            console.log(`\n🌐 Frontend:  http://localhost:${PORT}`)
            console.log(`📱 Aguardando conexão do WhatsApp...\n`)
            addNotification('🚀 Servidor iniciado')
        })
    } catch (e) {
        console.error('Falha ao iniciar:', e)
        process.exit(1)
    }
})()