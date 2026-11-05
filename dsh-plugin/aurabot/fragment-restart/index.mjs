import { win32 } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const base = 'http://127.0.0.1:8000'
const inbox = 'http://127.0.0.1:5173/'
const maxBytes = 30 * 1024 * 1024
const recentMs = 30 * 60_000
const formats = new Set(['.pdf', '.docx', '.pptx', '.txt', '.md', '.jpg', '.jpeg', '.png', '.webp'])
const usage = '先在私聊发文件，再发 /整理。也可以发 /整理 文件名、/整理 图片 或 /整理 网页链接。'

async function request(path, options = {}, signal = AbortSignal.timeout(8000)) {
  let response
  try {
    response = await fetch(base + path, { ...options, signal, redirect: 'error' })
  } catch {
    throw new Error('连不上碎时重启，请在 app 目录运行 npm run api。')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.detail || '碎时重启服务响应异常。')
  return data
}

function imageName(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'QQ图片.png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'QQ图片.jpg'
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'QQ图片.webp'
  throw new Error('请发送 JPG、PNG 或 WebP 图片，也可以按原图文件发送。')
}

async function upload(name, bytes) {
  if (!bytes.byteLength || bytes.byteLength > maxBytes) throw new Error('附件为空或超过 30 MB。')
  const form = new FormData()
  form.append('course_id', 'auto')
  form.append('files', new Blob([bytes]), name.replace(/[\r\n"]/g, '_'))
  const [source] = await request('/api/sources/upload', { method: 'POST', body: form }, AbortSignal.timeout(30_000))
  return source
}

async function importFile(api, msg, filename, net) {
  const now = Date.now()
  const recent = api.core.hub.recentFiles(msg.chatId)
  const file = recent.findLast((item) => String(item.userId) === String(msg.userId) && item.at <= now && now - item.at < recentMs
    && (!filename || item.name === filename))
  if (!file) throw new Error('近 30 分钟内找不到这份文件。' + usage)
  const name = win32.basename(file.name || '')
  if (!formats.has(win32.extname(name).toLowerCase())) throw new Error('请发送 DOCX、PPTX、带文本的 PDF、TXT、Markdown 或 JPG、PNG、WebP。')
  if (file.size > maxBytes) throw new Error('单份文件不能超过 30 MB。')
  let bytes
  try {
    const url = new URL(file.url || (await api.onebot('get_private_file_url', {
      user_id: Number(msg.userId), file_id: file.id, file_hash: file.hash || '',
    }, { timeoutMs: 15_000 }))?.url)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('QQ 文件地址无效')
    bytes = await net.fetchImage(url.href, { maxBytes, allowLocal: false, timeoutMs: 20_000 })
  } catch {
    throw new Error('QQ 文件下载失败，请重新发送原文件后再试。')
  }
  return upload(name, bytes)
}

async function importImage(api, msg, net) {
  const image = api.core.hub.recentMedia(msg.chatId, msg.userId).findLast((item) => !item.sticker)
  if (!image) throw new Error('近 30 分钟内没收到你的图片，请先发一张。')
  let bytes
  try {
    bytes = await net.segmentBytes(image.seg, api.core.onebot, { maxBytes, allowLocal: false, timeoutMs: 20_000 })
  } catch {
    throw new Error('QQ 图片下载失败，请重新发送图片后再试。')
  }
  return upload(imageName(bytes), bytes)
}

async function waitForNotes(source) {
  const signal = AbortSignal.timeout(23_000)
  try {
    while (source.status === '处理中') {
      await delay(800, undefined, { signal })
      source = await request('/api/sources/' + source.id, {}, signal)
    }
  } catch {
    // The local service keeps processing even if the chat stops waiting.
  }
  return source
}

function formatNotes(source) {
  const title = `《${source.title}》`
  if (source.status === '处理中') return `${title}已收下，正在后台整理。稍后可在本机收件箱查看。\n${inbox}`
  if (source.extraction?.status === '失败') return `${title}没能读出来。${source.extraction.error}`
  if (source.analysis?.status !== '已完成') return `${title}已提取内容。${source.analysis?.error || 'AI 笔记暂未生成。'}\n${inbox}`
  const { summary, key_points, tags } = source.analysis
  return [
    `${title}整理好啦。`,
    `课程：${source.course}`,
    `摘要：${summary.slice(0, 500)}`,
    ...key_points.slice(0, 4).map(({ title, explanation }, index) => `${index + 1}. ${title}：${explanation.slice(0, 160)}`),
    tags.length ? `标签：${tags.slice(0, 6).join('、')}` : '',
    `完整笔记：${inbox}`,
  ].filter(Boolean).join('\n')
}

export default {
  id: 'fragment-restart',
  name: '碎时重启',
  version: '0.2.0',
  api: 1,
  description: '在主人私聊里整理 QQ 文件、图片和公开网页',
  setup(api) {
    const net = api.lib('core/net.js')
    api.command({
      name: '整理',
      aliases: ['fragment'],
      desc: usage,
      async run(arg, msg) {
        if (!api.isOwner(msg.userId)) return ''
        if (msg.kind !== 'private') return '请在主人私聊里使用 /整理。'
        try {
          if (arg === '测试') {
            const health = await request('/health')
            if (health.service !== 'fragment-restart-local-api') throw new Error('8000 端口未运行碎时重启。')
            return '碎时重启已连通。' + usage
          }
          if (msg.raw?.simulated || api.config().dryRun) return '试运行只检查连接，请使用 /整理 测试。'
          if (arg === '图片') return formatNotes(await waitForNotes(await importImage(api, msg, net)))
          if (/^https?:\/\//i.test(arg)) {
            const source = await request('/api/sources/link', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: arg, course_id: 'auto' }),
            })
            return formatNotes(await waitForNotes(source))
          }
          return formatNotes(await waitForNotes(await importFile(api, msg, arg, net)))
        } catch (error) {
          return `整理遇到问题。${error.message}`
        }
      },
    })
  },
}
