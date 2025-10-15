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

/** ---------- 日志模块（支持 pretty / json） ---------- */

type LogMode = 'pretty' | 'json'

interface LogRecord {
  time: string
  taskId?: string
  step: string
  status?: 'ok' | 'fail' | 'info'
  attempt?: string
  durationMs?: number
  error?: string
  extra?: Record<string, unknown>
}

function nowISO () {
  return new Date().toISOString()
}

function createLogger (mode: LogMode) {
  const print = (rec: LogRecord) => {
    if (mode === 'json') {
      console.log(JSON.stringify(rec))
    } else {
      const { time, taskId, step, status, attempt, durationMs, error } = rec
      const badge = status === 'ok' ? '✅' : status === 'fail' ? '❌' : 'ℹ️'
      const dur = durationMs != null ? ` | ${durationMs}ms` : ''
      const att = attempt ? ` | attempt ${attempt}` : ''
      const tid = taskId ? ` [${taskId}]` : ''
      const err = error ? `\n   ↳ ${error}` : ''
      console.log(`${badge} ${time}${tid} ${step}${att}${dur}${err}`)
    }
  }

  return {
    startTask: (taskId: string) =>
      print({ time: nowISO(), taskId, step: '开始', status: 'info' }),
    callAI: (taskId: string, attempt: string) =>
      print({ time: nowISO(), taskId, step: 'AI 翻译中。。。', status: 'info', attempt }),
    retryAI: (taskId: string, attempt: string, error: string) =>
      print({ time: nowISO(), taskId, step: 'AI 重试翻译中。。。', status: 'info', attempt, error }),
    aiError: (taskId: string, error: string) =>
      print({ time: nowISO(), taskId, step: 'AI 翻译失败', status: 'fail', error }),
    skipTask: (taskId: string, reason = 'cache.hit') =>
      print({ time: nowISO(), taskId, step: '跳过', status: 'info', extra: { reason } }),
    writeOk: (taskId: string, durationMs: number, path: string) =>
      print({ time: nowISO(), taskId, step: '写入成功', status: 'ok', durationMs, extra: { path } }),
    success: (taskId: string, durationMs: number) =>
      print({ time: nowISO(), taskId, step: '成功', status: 'ok', durationMs }),
    parseError: (taskId: string, err: string) =>
      print({ time: nowISO(), taskId, step: '解析失败', status: 'fail', error: err }),
    done: (taskId: string) =>
      print({ time: nowISO(), taskId, step: '完成', status: 'info' }),
    summary: (ok: number, fail: number, durationMs: number, extra?: Record<string, unknown>) =>
      print({
        time: nowISO(),
        step: '总结',
        status: fail > 0 ? 'fail' : 'ok',
        durationMs,
        extra: { ok, fail, ...extra }
      })
  }
}

/** ---------- CLI 参数解析 ---------- */

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

/** ---------- JSON 解析增强 ---------- */
function parseJsonRobust (raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(cleanAIResponse(raw))
  }
}

/** ---------- 工具 ---------- */
function getValueByPath (obj: any, keyPath: string) {
  return keyPath.split('.').reduce((acc, k) => acc?.[k], obj)
}

/** ---------- 单任务执行 ---------- */
async function runTask (
  task: FileTask,
  cfg: {
    apiKey: string
    apiUrl: string
    model: string
    timeoutMs: number
    retry: number
    dry: boolean
    force: boolean
    logger: ReturnType<typeof createLogger>
  },
  cache: any
) {
  const { lang, file, pendingPath, targetPath } = task
  const taskId = `${lang}/${file}`
  const { logger } = cfg
  const t0 = Date.now()

  logger.startTask(taskId)

  const sourceJson = readJsonFile(pendingPath)
  const filteredJson = filterUntranslated(sourceJson, cache, lang, file, cfg.force)

  if (Object.keys(filteredJson).length === 0) {
    logger.skipTask(taskId, 'cache.hit')
    logger.done(taskId)
    return { ok: true }
  }

  const prompt = getPrompt(JSON.stringify(filteredJson, null, 2), lang)

  let translated = ''
  for (let attempt = 1; attempt <= cfg.retry + 1; attempt++) {
    try {
      logger.callAI(taskId, `${attempt}/${cfg.retry + 1}`)
      translated = await callAI({
        apiKey: cfg.apiKey,
        apiUrl: cfg.apiUrl,
        model: cfg.model,
        prompt,
        timeoutMs: cfg.timeoutMs
      })
      break
    } catch (err: any) {
      const msg = err?.message || String(err)
      if (attempt <= cfg.retry) {
        logger.retryAI(taskId, `${attempt}/${cfg.retry + 1}`, msg)
        // eslint-disable-next-line promise/param-names
        await new Promise(r => setTimeout(r, attempt * 1000))
      } else {
        logger.aiError(taskId, msg)
      }
    }
  }

  if (!translated) {
    logger.done(taskId)
    return { ok: false }
  }

  try {
    const json = parseJsonRobust(translated)
    const beforeWrite = Date.now()
    if (!cfg.dry) writeJsonFile(targetPath, json)
    const writeCost = Date.now() - beforeWrite

    const allPaths = collectKeyPaths(sourceJson)
    for (const pathKey of allPaths) {
      const val = getValueByPath(sourceJson, pathKey)
      markTranslated(cache, lang, file, pathKey, val)
    }

    logger.writeOk(taskId, writeCost, targetPath)
    logger.success(taskId, Date.now() - t0)
    logger.done(taskId)
    return { ok: true }
  } catch (e: any) {
    logger.parseError(taskId, e?.message || String(e))
    logger.done(taskId)
    return { ok: false }
  }
}

/** ---------- 主流程 ---------- */
export async function main () {
  const args = process.argv.slice(2)

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
  const dry = arg.dry === true || String(arg.dry) === 'true'
  const force = arg.force === true || String(arg.force) === 'true'
  const timeoutMs = Number(arg.timeout ?? 60000)
  const logMode: LogMode = (arg.log as string) === 'json' ? 'json' : 'pretty'

  if (!apiKey) {
    console.error('❌ 缺少 OPENROUTER_API_KEY')
    process.exit(1)
  }

  const logger = createLogger(logMode)

  if (logMode === 'pretty') {
    console.log('\n🚀 启动翻译任务...')
    console.log(`🌍 API: ${apiUrl}`)
    console.log(`🔑 模型: ${model}`)
    console.log(`🧵 并发: ${concurrency}`)
    console.log(`🔁 重试: ${retry}`)
    console.log(`📝 Dry-Run: ${dry ? '开启' : '关闭'}`)
    console.log(`💥 强制翻译: ${force ? '开启（忽略缓存判断）' : '关闭'}\n`)
  }

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
      const result = await runTask(
        task,
        { apiKey, apiUrl, model, timeoutMs, retry, dry, force, logger },
        cache
      )
      result.ok ? ok++ : fail++
    }
  })

  await Promise.all(workers)
  saveCache(cache)

  const used = Date.now() - start
  logger.summary(ok, fail, used, {
    apiUrl,
    model,
    concurrency,
    retry,
    dry,
    force,
    tasks: tasks.length
  })

  if (logMode === 'pretty') {
    console.log(`\n✅ 成功: ${ok} | ❌ 失败: ${fail} | ⏱️ 耗时: ${(used / 1000).toFixed(1)}s`)
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(e => {
    console.error('💥 程序运行出错:')
    console.error(e)
    process.exit(1)
  })
}
