import { callAI, cleanAIResponse } from './ai-request'
import { getPrompt } from './prompt'
import { buildFileTasks, readJsonFile, writeJsonFile, FileTask } from './io-handler'
import { printHelp, printVersion } from './cli'
import {
  loadCache,
  saveCache,
  collectKeyPaths,
  markTranslated,
  filterUntranslated
} from './cache'

/**
 * 解析命令行参数
 */
function parseArgs (args: string[]) {
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

/**
 * 解析 AI 返回结果（带清理逻辑）
 */
function parseJsonRobust (raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(cleanAIResponse(raw))
  }
}

/**
 * 获取嵌套值（用于标记缓存）
 */
function getValueByPath (obj: any, keyPath: string) {
  return keyPath.split('.').reduce((acc, k) => acc?.[k], obj)
}

/**
 * 处理单个翻译任务
 */
async function runTask (task: FileTask, cfg: any, cache: any) {
  const { lang, file, pendingPath, targetPath, isNew } = task
  console.log(`🟦 [${lang}] ${file} (${isNew ? '新增' : '替换'})`)

  const sourceJson = readJsonFile(pendingPath)
  const filteredJson = filterUntranslated(sourceJson, cache, lang, file, cfg.force)

  if (Object.keys(filteredJson).length === 0) {
    console.log('   🔁 无需翻译（缓存一致）\n')
    return { ok: true }
  }

  const prompt = getPrompt(JSON.stringify(filteredJson, null, 2), lang)

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

    // ✅ 翻译成功后更新缓存（记录原始英文值）
    if (!cfg.force) {
      const paths = collectKeyPaths(sourceJson)
      for (const keyPath of paths) {
        const value = getValueByPath(sourceJson, keyPath)
        markTranslated(cache, lang, file, keyPath, value)
      }
    }

    console.log(`   └── ✅ 写入成功: ${targetPath}\n`)
    return { ok: true }
  } catch (e: any) {
    console.error(`   ❌ JSON 解析失败: ${lang}/${file}\n${translated}`)
    console.error(e.message)
    return { ok: false }
  }
}

/**
 * 主执行函数
 */
export async function main () {
  const args = process.argv.slice(2)

  // 处理帮助与版本命令
  if (args.includes('-v') || args.includes('--version')) return printVersion()
  if (args.includes('-h') || args.includes('--help')) return printHelp()

  const arg = parseArgs(args)
  const apiKey =
    (arg.apiKey as string) ||
    (arg.OPENROUTER_API_KEY as string) ||
    process.env.OPENROUTER_API_KEY ||
    ''
  const apiUrl =
    (arg.apiUrl as string) ||
    process.env.OPENROUTER_API_URL ||
    'https://openrouter.ai/api/v1/chat/completions'
  const model = (arg.model as string) || 'gpt-4o-mini'
  const concurrency = Number(arg.concurrency ?? 2)
  const retry = Number(arg.retry ?? 1)
  const dry = Boolean(arg.dry ?? false)
  const force = Boolean(arg.force ?? false)
  const timeoutMs = Number(arg.timeout ?? 60000)

  if (!apiKey) {
    console.error('❌ 缺少 OPENROUTER_API_KEY')
    process.exit(1)
  }

  console.log('\n🚀 启动翻译任务...')
  console.log(`🌍 API: ${apiUrl}`)
  console.log(`🔑 模型: ${model}`)
  console.log(`🧵 并发: ${concurrency}`)
  console.log(`🔁 重试: ${retry}`)
  console.log(`📝 Dry-Run: ${dry ? '开启' : '关闭'}`)
  console.log(`💥 强制翻译: ${force ? '开启（忽略缓存）' : '关闭'}\n`)

  // 加载或重置缓存
  const cache = force ? {} : loadCache()
  const tasks = buildFileTasks()
  const start = Date.now()
  let ok = 0
  let fail = 0

  const queue = [...tasks]
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const task = queue.shift()
      if (!task) break
      const result = await runTask(task, { apiKey, apiUrl, model, timeoutMs, retry, dry, force }, cache)
      result.ok ? ok++ : fail++
    }
  })

  await Promise.all(workers)
  if (!force) saveCache(cache)

  const used = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✅ 完成: 成功 ${ok}, 失败 ${fail}, 耗时 ${used}s`)
}

/**
 * 命令行直接执行
 */
if (process.env.NODE_ENV !== 'test') {
  main().catch(e => {
    console.error('💥 程序运行出错:')
    console.error(e)
    process.exit(1)
  })
}
