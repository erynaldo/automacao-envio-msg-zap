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

        try {

            // NÃO EXISTE QR

            if (

                !ultimoQR ||

                typeof ultimoQR !== 'string' ||

                ultimoQR.trim() === ''

            ) {

                return res.send(`

<!DOCTYPE html>

<html>

<head>

<title>WhatsApp</title>

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

            // GERAR BASE64 QR

            const qrBase64 =
                qrImage.imageSync(

                    ultimoQR,

                    {

                        type: 'png',

                        encoding: 'base64'
                    }
                )

            // RETORNAR HTML

            return res.send(`

<!DOCTYPE html>

<html>

<head>

<title>QR Code WhatsApp</title>

<script src="https://cdn.tailwindcss.com"></script>

</head>

<body class="bg-slate-950 min-h-screen flex items-center justify-center">

    <div class="bg-slate-900 p-10 rounded-3xl shadow-2xl text-center">

        <h1 class="text-white text-3xl font-black mb-6">

            Escaneie o QR Code

        </h1>

        <img

            src="data:image/png;base64,${qrBase64}"

            class="rounded-2xl"
        >

    </div>

</body>

</html>

`)

        } catch (error) {

            console.log(
                'ERRO QR CODE:',
                error
            )

            // GARANTE NÃO ENVIAR 2X

            if (!res.headersSent) {

                return res.status(500).send(`

                    <h1>
                        Erro gerar QRCode
                    </h1>

                `)
            }
        }
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