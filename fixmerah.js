const { Telegraf } = require('telegraf');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const nodemailer = require('nodemailer');

// --- KONFIGURASI ---
const BOT_TOKEN = '8004440395:AAFF4WR5mwxSJaXvvxJWFXFq9wNiaEMya74'; 
const MY_NUMBER = '6283850944643'; 
const GMAIL = "devaariputra@gmail.com";
const APP_PASSWORD = "zixe ipot bzze fflj";
// -------------------

const bot = new Telegraf(BOT_TOKEN);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL, pass: APP_PASSWORD }
});

async function mulai() {
    const { state, saveCreds } = await useMultiFileAuthState('session_wa');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        console.log(`\n⏳ Menunggu Kode Pairing untuk ${MY_NUMBER}...`);
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(MY_NUMBER);
                console.log('\n=======================================');
                console.log(`  KODE PAIRING ANDA: \x1b[32m${code}\x1b[0m`);
                console.log('=======================================');
            } catch (err) { console.error(err); }
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (up) => {
        if (up.connection === 'open') console.log('\n✅ WhatsApp Berhasil Terhubung!');
        if (up.connection === 'close') mulai(); 
    });

    bot.start((ctx) => {
        const menu = `🔴━━━━━━━━━━━━━━━━━━🔴\n` +
                     `      DEVV BOT FIX MERAH\n` +
                     `🔴━━━━━━━━━━━━━━━━━━🔴\n\n` +
                     `⚡ Welcome To Devv Multi Bot\n` +
                     `📩 Support Mail & WA Checker\n\n` +
                     `📌 *FORMAT CEK BIO:* \n` +
                     `🔍 \`/cek\` (lalu list nomor ke bawah)\n` +
                     `Maksimal 25 nomor sekaligus.\n\n` +
                     `📌 *FORMAT SEND MAIL:* \n` +
                     `📧 \`/send 628xxx\`\n\n` +
                     `👤 *OWNER:* 083850944643`;
        ctx.replyWithMarkdown(menu);
    });

    // --- FITUR 1: BULK CEK BIO WA (LIMIT 25) ---
    bot.command('cek', async (ctx) => {
        const fullText = ctx.message.text.split('\n');
        let args = fullText.length > 1 ? fullText.slice(1) : ctx.message.text.split(' ').slice(1);
        
        const cleanArgs = args.map(a => a.trim()).filter(a => a.length > 5);

        if (cleanArgs.length === 0) {
            return ctx.reply('⚠️ *Format Salah!*\nGunakan:\n`/cek`\n`628xxx`\n`628yyy`');
        }

        // LIMIT 25 NOMOR
        if (cleanArgs.length > 25) {
            return ctx.reply('🚫 *Terlalu banyak!* Maksimal 25 nomor sekali perintah agar aman.');
        }

        await ctx.reply(`🔎 *Memproses ${cleanArgs.length} nomor...*\n⏳ Jeda 2 detik per nomor agar akun aman.`, { parse_mode: 'Markdown' });

        for (let numRaw of cleanArgs) {
            let num = numRaw.replace(/[^0-9]/g, '');
            if (num.startsWith('0')) num = '62' + num.slice(1);
            if (num.startsWith('8')) num = '62' + num;

            const jid = num + '@s.whatsapp.net';
            const formattedNum = '+' + num;

            try {
                const [onWa] = await sock.onWhatsApp(jid);
                
                if (!onWa || !onWa.exists) {
                    await ctx.reply(`❌ *Nomor:* \`${formattedNum}\`\nStatus: Tidak terdaftar.`);
                } else {
                    let bio = 'Diprivasi atau Kosong';
                    let img = 'https://telegra.ph/file/0c1f303070438346f0412.png';
                    let hasPp = false;

                    try {
                        const s = await sock.fetchStatus(jid);
                        if (s && s.status) bio = s.status;
                    } catch (e) {}

                    try {
                        img = await sock.profilePictureUrl(jid, 'image');
                        hasPp = true;
                    } catch (e) {}

                    const hasil = 
                        `✨ *HASIL PELACAKAN* ✨\n` +
                        `━━━━━━━━━━━━━━━━━━\n` +
                        `📱 *Nomor:* \`${formattedNum}\`\n` +
                        `📝 *Bio:* _"${bio}"_\n` +
                        `🟢 *Status:* WhatsApp Aktif\n` +
                        `━━━━━━━━━━━━━━━━━━`;

                    if (hasPp) {
                        await ctx.replyWithPhoto({ url: img }, { caption: hasil, parse_mode: 'Markdown' });
                    } else {
                        await ctx.reply(hasil, { parse_mode: 'Markdown' });
                    }
                }

                // JEDA AMAN 2 DETIK
                await new Promise(res => setTimeout(res, 2000));

            } catch (error) {
                console.log("Error pada: " + num);
            }
        }
        ctx.reply('✅ *Selesai memproses 25 nomor.*');
    });

    bot.command('send', async (ctx) => {
        const targetNum = ctx.message.text.split(' ')[1];
        if (!targetNum) return ctx.reply('⚠️ Format: /send 628xxx');
        await ctx.reply('⏳ Mengirim email support...');
        transporter.sendMail({ from: GMAIL, to: 'support@support.whatsapp.com', subject: 'Login error', text: targetNum }, (err) => {
            if (err) return ctx.reply('❌ Gagal: ' + err.message);
            ctx.reply('✅ *BERHASIL TERKIRIM*');
        });
    });

    bot.launch();
}

mulai().catch(err => console.error(err));