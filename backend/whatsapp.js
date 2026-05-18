const fs = require('fs')

const qrcodeTerminal =
    require('qrcode-terminal')

const qrImage =
    require('qr-image')

const {

    Client,
    LocalAuth,
    MessageMedia

} = require('whatsapp-web.js')

const client = new Client({

    authStrategy:
        new LocalAuth()
})

let prontoWhatsApp = false

let ultimoQR = null

// INICIAR WHATSAPP

function iniciarWhatsApp() {

    // QR CODE

    client.on('qr', (qr) => {

        ultimoQR = qr

        console.log(
            '📲 Escaneie o QR Code'
        )

        qrcodeTerminal.generate(

            qr,

            {
                small: true
            }
        )
    })

    // READY

    client.on('ready', () => {

        prontoWhatsApp = true

        ultimoQR = null

        console.log(
            '✅ WhatsApp conectado!'
        )
    })

    // DESCONECTADO

    client.on('disconnected', () => {

        prontoWhatsApp = false

        console.log(
            '⚠️ WhatsApp desconectado'
        )
    })

    client.initialize()
}

// CONFIGURAR ROTA QR CODE

function configurarQRCode(app) {

    app.get('/qrcode', (req, res) => {

// bbbbbbbbbbbbbbbbbbbbbbbbbb
        try {
            const code =
                qrImage.image(

                    ultimoQR,

                    {
                        type: 'png'
                    }
                )
            res.type('png')
            code.pipe(res)
        }

        catch (error) {

            console.log(error)

            res.status(500).send(
                'Erro ao gerar o QR Code'
            )
        }

// bbbbbbbbbbbbbbbbbbbbbbbbb

        if (!ultimoQR) {

            return res.send(`

<!DOCTYPE html>

<html>

<head>

<title>WhatsApp Conectado</title>

<script src="https://cdn.tailwindcss.com"></script>

</head>

<body class="bg-slate-950 min-h-screen flex items-center justify-center">

    <div class="bg-slate-900 p-10 rounded-3xl text-center">

        <h1 class="text-3xl font-black text-emerald-400">

            ✅ WhatsApp já conectado

        </h1>

    </div>

</body>

</html>

`)
        }

        // bbbbbbbbbbbbbbbbbbbbb
    })
}

// FORMATAR TELEFONE

function formatarTelefone(numero) {

    if (!numero) return null

    numero = numero.toString()

    numero = numero.replace(/\D/g, '')

    if (!numero.startsWith('55')) {

        numero = '55' + numero
    }

    return `${numero}@c.us`
}

// ENVIAR MENSAGEM

async function enviarMensagem(

    numero,
    texto,
    imagem

) {

    try {

        const chatId =
            formatarTelefone(numero)

        if (!chatId) {

            throw new Error(
                'Telefone inválido'
            )
        }

        await client.sendMessage(

            chatId,
            texto
        )

        console.log(
            `📨 Mensagem enviada:
            ${numero}`
        )

        // IMAGEM OPCIONAL

        if (

            imagem &&

            imagem.trim() !== '' &&

            fs.existsSync(imagem)

        ) {

            const media =
                MessageMedia.fromFilePath(
                    imagem
                )

            await client.sendMessage(

                chatId,
                media
            )

            console.log(
                `🖼️ Imagem enviada:
                ${numero}`
            )
        }

    } catch (error) {

        console.log(
            `❌ Erro enviar:
            ${numero}`
        )

        console.log(error)

        throw error
    }
}

// STATUS

function statusWhatsApp() {

    return prontoWhatsApp
}

module.exports = {

    client,

    iniciarWhatsApp,

    configurarQRCode,

    enviarMensagem,

    statusWhatsApp
}