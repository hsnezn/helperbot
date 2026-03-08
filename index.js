require('dotenv').config()
const { Telegraf } = require('telegraf')
const { Client } = require('discord.js')
const { fetch } = require('undici')

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const DISCORD_TARGET_USER_ID = process.env.DISCORD_TARGET_USER_ID
const MAX_FILE_SIZE_MB = Number(process.env.DISCORD_MAX_FILE_SIZE_MB || 25)

function requireEnv(name, value) {
  if (!value || String(value).trim() === '') {
    console.error(`[config] Missing required environment variable: ${name}`)
    return false
  }
  return true
}

const hasEnv =
  requireEnv('TELEGRAM_BOT_TOKEN', TELEGRAM_BOT_TOKEN) &&
  requireEnv('DISCORD_BOT_TOKEN', DISCORD_BOT_TOKEN) &&
  requireEnv('DISCORD_TARGET_USER_ID', DISCORD_TARGET_USER_ID)

if (!hasEnv) {
  process.exit(1)
}

const discord = new Client({ intents: [] })
const tg = new Telegraf(TELEGRAM_BOT_TOKEN)

async function sendBufferToDiscord(buffer, filename, content) {
  try {
    const user = await discord.users.fetch(DISCORD_TARGET_USER_ID)
    await user.send({
      content: content || '',
      files: [{ attachment: buffer, name: filename }],
    })
    return true
  } catch (err) {
    console.error('[discord] Failed to send DM:', err?.message || err)
    return false
  }
}

async function fetchTelegramFileAsBuffer(ctx, fileId) {
  const link = await ctx.telegram.getFileLink(fileId)
  const res = await fetch(link.href)
  if (!res.ok) {
    throw new Error(`Failed to download file: HTTP ${res.status}`)
  }
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

function withinLimit(bytes) {
  const limitBytes = MAX_FILE_SIZE_MB * 1024 * 1024
  return bytes <= limitBytes
}

async function forwardDocument(ctx) {
  const doc = ctx.message.document
  const caption = ctx.message.caption || ''
  const sender =
    (ctx.message.from && ctx.message.from.username) ||
    (ctx.message.from && ctx.message.from.first_name) ||
    'unknown'

  if (doc.file_size && !withinLimit(doc.file_size)) {
    await ctx.reply(
      `File is too large (${Math.round(doc.file_size / (1024 * 1024))} MB). Limit is ${MAX_FILE_SIZE_MB} MB for Discord.`
    )
    return
  }

  try {
    const buffer = await fetchTelegramFileAsBuffer(ctx, doc.file_id)
    if (!withinLimit(buffer.length)) {
      await ctx.reply(
        `Downloaded file exceeds limit (${Math.round(buffer.length / (1024 * 1024))} MB). Limit is ${MAX_FILE_SIZE_MB} MB.`
      )
      return
    }
    const ok = await sendBufferToDiscord(
      buffer,
      doc.file_name || 'document.bin',
      `From Telegram @${sender}${caption ? ` — ${caption}` : ''}`
    )
    await ctx.reply(ok ? 'Sent to Discord user.' : 'Failed to send to Discord.')
  } catch (err) {
    console.error('[telegram] forwardDocument error:', err?.message || err)
    await ctx.reply('Error downloading or forwarding this document.')
  }
}

async function forwardPhoto(ctx) {
  const photos = ctx.message.photo || []
  if (photos.length === 0) return
  const best = photos[photos.length - 1]
  const caption = ctx.message.caption || ''
  const sender =
    (ctx.message.from && ctx.message.from.username) ||
    (ctx.message.from && ctx.message.from.first_name) ||
    'unknown'

  if (best.file_size && !withinLimit(best.file_size)) {
    await ctx.reply(
      `Photo is too large (${Math.round(best.file_size / (1024 * 1024))} MB). Limit is ${MAX_FILE_SIZE_MB} MB for Discord.`
    )
    return
  }

  try {
    const buffer = await fetchTelegramFileAsBuffer(ctx, best.file_id)
    if (!withinLimit(buffer.length)) {
      await ctx.reply(
        `Downloaded photo exceeds limit (${Math.round(buffer.length / (1024 * 1024))} MB). Limit is ${MAX_FILE_SIZE_MB} MB.`
      )
      return
    }
    const filename = `photo_${Date.now()}.jpg`
    const ok = await sendBufferToDiscord(
      buffer,
      filename,
      `From Telegram @${sender}${caption ? ` — ${caption}` : ''}`
    )
    await ctx.reply(ok ? 'Photo sent to Discord user.' : 'Failed to send photo to Discord.')
  } catch (err) {
    console.error('[telegram] forwardPhoto error:', err?.message || err)
    await ctx.reply('Error downloading or forwarding this photo.')
  }
}

async function forwardVideo(ctx) {
  const video = ctx.message.video
  if (!video) return
  const caption = ctx.message.caption || ''
  const sender =
    (ctx.message.from && ctx.message.from.username) ||
    (ctx.message.from && ctx.message.from.first_name) ||
    'unknown'

  if (video.file_size && !withinLimit(video.file_size)) {
    await ctx.reply(
      `Video is too large (${Math.round(video.file_size / (1024 * 1024))} MB). Limit is ${MAX_FILE_SIZE_MB} MB.`
    )
    return
  }

  try {
    const buffer = await fetchTelegramFileAsBuffer(ctx, video.file_id)
    if (!withinLimit(buffer.length)) {
      await ctx.reply(
        `Downloaded video exceeds limit (${Math.round(buffer.length / (1024 * 1024))} MB). Limit is ${MAX_FILE_SIZE_MB} MB.`
      )
      return
    }
    const filename = video.file_name || `video_${Date.now()}.mp4`
    const ok = await sendBufferToDiscord(
      buffer,
      filename,
      `From Telegram @${sender}${caption ? ` — ${caption}` : ''}`
    )
    await ctx.reply(ok ? 'Video sent to Discord user.' : 'Failed to send video to Discord.')
  } catch (err) {
    console.error('[telegram] forwardVideo error:', err?.message || err)
    await ctx.reply('Error downloading or forwarding this video.')
  }
}

async function forwardAudio(ctx) {
  const audio = ctx.message.audio
  if (!audio) return
  const caption = ctx.message.caption || ''
  const sender =
    (ctx.message.from && ctx.message.from.username) ||
    (ctx.message.from && ctx.message.from.first_name) ||
    'unknown'

  if (audio.file_size && !withinLimit(audio.file_size)) {
    await ctx.reply(
      `Audio is too large (${Math.round(audio.file_size / (1024 * 1024))} MB). Limit is ${MAX_FILE_SIZE_MB} MB.`
    )
    return
  }

  try {
    const buffer = await fetchTelegramFileAsBuffer(ctx, audio.file_id)
    if (!withinLimit(buffer.length)) {
      await ctx.reply(
        `Downloaded audio exceeds limit (${Math.round(buffer.length / (1024 * 1024))} MB). Limit is ${MAX_FILE_SIZE_MB} MB.`
      )
      return
    }
    const filename = audio.file_name || `audio_${Date.now()}.mp3`
    const ok = await sendBufferToDiscord(
      buffer,
      filename,
      `From Telegram @${sender}${caption ? ` — ${caption}` : ''}`
    )
    await ctx.reply(ok ? 'Audio sent to Discord user.' : 'Failed to send audio to Discord.')
  } catch (err) {
    console.error('[telegram] forwardAudio error:', err?.message || err)
    await ctx.reply('Error downloading or forwarding this audio.')
  }
}

async function forwardVoice(ctx) {
  const voice = ctx.message.voice
  if (!voice) return
  const sender =
    (ctx.message.from && ctx.message.from.username) ||
    (ctx.message.from && ctx.message.from.first_name) ||
    'unknown'

  if (voice.file_size && !withinLimit(voice.file_size)) {
    await ctx.reply(
      `Voice note is too large (${Math.round(voice.file_size / (1024 * 1024))} MB). Limit is ${MAX_FILE_SIZE_MB} MB.`
    )
    return
  }

  try {
    const buffer = await fetchTelegramFileAsBuffer(ctx, voice.file_id)
    if (!withinLimit(buffer.length)) {
      await ctx.reply(
        `Downloaded voice note exceeds limit (${Math.round(buffer.length / (1024 * 1024))} MB). Limit is ${MAX_FILE_SIZE_MB} MB.`
      )
      return
    }
    const filename = `voice_${Date.now()}.ogg`
    const ok = await sendBufferToDiscord(
      buffer,
      filename,
      `From Telegram @${sender} — voice note`
    )
    await ctx.reply(ok ? 'Voice note sent to Discord user.' : 'Failed to send voice note to Discord.')
  } catch (err) {
    console.error('[telegram] forwardVoice error:', err?.message || err)
    await ctx.reply('Error downloading or forwarding this voice note.')
  }
}

discord.once('ready', async () => {
  console.log(`[discord] Logged in as ${discord.user.tag}`)
  tg.on('document', forwardDocument)
  tg.on('photo', forwardPhoto)
  tg.on('video', forwardVideo)
  tg.on('audio', forwardAudio)
  tg.on('voice', forwardVoice)
  tg.launch()
  console.log('[telegram] Bot is up and listening for files.')
})

discord
  .login(DISCORD_BOT_TOKEN)
  .catch((err) => {
    console.error('[discord] Login failed:', err?.message || err)
    process.exit(1)
  })

process.once('SIGINT', () => {
  tg.stop('SIGINT')
})
process.once('SIGTERM', () => {
  tg.stop('SIGTERM')
})
