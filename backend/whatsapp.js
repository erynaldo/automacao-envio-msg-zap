const fs = require('fs')
const qrcode = require('qrcode-terminal')
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const client = new Client({
    authStrategy: new LocalAuth()
})
let prontoWhatsApp = false
function iniciarWhatsApp() {
    client.on('qr', (qr) => {
        console.log('📲 Escaneie o QR Code abaixo no WhatsApp:')
        qrcode.generate(qr, { small: true })
    })
    client.on('ready', () => {
        prontoWhatsApp = true
        console.log('✅ WhatsApp conectado!')
    })
    client.on('disconnected', () => {
        prontoWhatsApp = false
        console.log('⚠️ WhatsApp desconectado')
    })
    client.initialize()
}
async function enviarMensagem(numero, texto, imagem) {
    try {
        const chatId = `${numero}@c.us`
        await client.sendMessage(chatId, texto)
        if (imagem && imagem.trim() !== '' && fs.existsSync(imagem)) {
            const media = MessageMedia.fromFilePath(imagem)
            await client.sendMessage(chatId, media)
            console.log(`🖼️  Imagem enviada para ${numero}`)
        }
    } catch (error) {
        console.log(`❌ Erro ao enviar mensagem para ${numero}`)
        console.log(error)
        throw error
    }
}
function statusWhatsApp() {
    return prontoWhatsApp
}
module.exports = { client, iniciarWhatsApp, enviarMensagem, statusWhatsApp }