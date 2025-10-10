import { callAI, cleanAIResponse } from './ai-request'
import { getPrompt } from './prompt'
import { buildFileTasks, readJsonFile, writeJsonFile, FileTask } from './io-handler'

function parseArgs () {
  const args = process.argv.slice(2)
  const params: Record<string, string | boolean> = {}
  for (const arg of args) {
    if (!arg.startsWith('--')) continue
    const [k, v] = arg.slice(2).split('=')
    const key = k.trim()
    if (!key) continue
    params[key] = v ?? true

    if (key.toUpperCase() === 'OPENROUTER_API_KEY' || key.toUpperCase() === 'APIKEY') {
      process.env.OPENROUTER_API_KEY = String(v)
    }
    if (key.toUpperCase() === 'APIURL') {
      process.env.OPENROUTER_API_URL = String(v)
    }
  }
  return params
}

function parseJsonRobust (raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(cleanAIResponse(raw))
  }
}

async function runTask (task: FileTask, cfg: any) {
  const { lang, file, pendingPath, targetPath, isNew } = task
  console.log(`🟦 [${lang}] ${file} (${isNew ? '新增' : '替换'})`)
  const sourceJson = readJsonFile(pendingPath)
  const prompt = getPrompt(JSON.stringify(sourceJson, null, 2), lang)

  let translated = ''
  for (let attempt = 1; attempt <= cfg.retry + 1; attempt++) {
    try {
      console.log(`   ├── 调用 AI (尝试 ${attempt}/${cfg.retry + 1})`)
      translated = await callAI({
        apiKey: cfg.apiKey,
        apiUrl: cfg.apiUrl,
        model: cfg.model,
        prompt,
        timeoutMs: cfg.timeoutMs
      })
      break
    } catch (err) {
      console.warn(`   ⚠️ 调用失败: ${err}. 重试中...`)
      // eslint-disable-next-line promise/param-names
      await new Promise(r => setTimeout(r, attempt * 1000))
    }
  }

  if (!translated) {
    console.error(`   ❌ 翻译失败: ${lang}/${file}`)
    return { ok: false }
  }

  try {
    const json = parseJsonRobust(translated)
    if (!cfg.dry) writeJsonFile(targetPath, json)
    console.log(`   └── ✅ 写入成功: ${targetPath}\n`)
    return { ok: true }
  } catch (e: any) {
    console.error(`   ❌ JSON 解析失败: ${lang}/${file}\n${translated}`)
    console.error(e.message)
    return { ok: false }
  }
}

export async function main () {
  const args = parseArgs()
  const apiKey =
    (args.apiKey as string) ||
    (args.OPENROUTER_API_KEY as string) ||
    process.env.OPENROUTER_API_KEY ||
    ''
  const apiUrl =
    (args.apiUrl as string) ||
    process.env.OPENROUTER_API_URL ||
    'https://openrouter.ai/api/v1/chat/completions'
  const model = (args.model as string) || 'gpt-4o-mini'
  const concurrency = Number(args.concurrency ?? 2)
  const retry = Number(args.retry ?? 1)
  const dry = Boolean(args.dry ?? false)
  const timeoutMs = Number(args.timeout ?? 60000)

  if (!apiKey) {
    console.error('❌ 缺少 OPENROUTER_API_KEY')
    process.exit(1)
  }

  console.log('\n🚀 启动翻译任务...')
  console.log(`🌍 API: ${apiUrl}`)
  console.log(`🔑 模型: ${model}`)
  console.log(`🧵 并发: ${concurrency}`)
  console.log(`🔁 重试: ${retry}`)
  console.log(`📝 Dry-Run: ${dry ? '开启' : '关闭'}\n`)

  const tasks = buildFileTasks()
  const start = Date.now()
  let ok = 0
  let fail = 0

  const queue = [...tasks]
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const task = queue.shift()
      if (!task) break
      const result = await runTask(task, { apiKey, apiUrl, model, timeoutMs, retry, dry })
      if (result.ok) ok++
      else fail++
    }
  })

  await Promise.all(workers)
  const used = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✅ 完成: 成功 ${ok}, 失败 ${fail}, 耗时 ${used}s`)
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(e => {
    console.error('💥 程序运行出错:')
    console.error(e)
    process.exit(1)
  })
}
