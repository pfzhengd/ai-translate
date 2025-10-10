import fs from 'fs'
import path from 'path'

export interface FileTask {
  lang: string // 语言目录（例如 'ar', 'de'）
  file: string // 文件名（例如 'common.json'）
  pendingPath: string // pending-langs/<file>
  targetPath: string // locales/<lang>/<file>
  isNew: boolean // 目标是否新增
}

/** 获取目录下的所有 .json 文件名（不递归） */
function getJsonFiles (dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
}

/** 读取 JSON（带错误上下文） */
export function readJsonFile (filePath: string): any {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (e: any) {
    throw new Error(`❌ 无法读取或解析文件: ${filePath}\n${e?.message || e}`)
  }
}

/** 写入 JSON（自动建目录，带错误上下文） */
export function writeJsonFile (filePath: string, data: any): void {
  try {
    const dir = path.dirname(filePath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  } catch (e: any) {
    throw new Error(`❌ 写入文件失败: ${filePath}\n${e?.message || e}`)
  }
}

/** 扫描 pending-langs 和 locales 目录，生成任务队列 */
export function buildFileTasks (
  pendingDir = path.resolve(process.cwd(), 'pending-langs'),
  localesDir = path.resolve(process.cwd(), 'locales')
): FileTask[] {
  if (!fs.existsSync(pendingDir)) {
    throw new Error(`❌ pending-langs 目录不存在：${pendingDir}`)
  }
  if (!fs.existsSync(localesDir)) {
    throw new Error(`❌ locales 目录不存在：${localesDir}`)
  }

  const pendingFiles = getJsonFiles(pendingDir)
  if (pendingFiles.length === 0) {
    console.log('ℹ️ pending-langs 目录为空，无需处理。')
    return []
  }

  const langs = fs
    .readdirSync(localesDir)
    .filter(name => {
      const full = path.join(localesDir, name)
      return fs.existsSync(full) && fs.statSync(full).isDirectory()
    })
    .sort()

  if (langs.length === 0) {
    console.log('ℹ️ locales 下没有语种目录。')
    return []
  }

  const tasks: FileTask[] = []
  for (const lang of langs) {
    const langDir = path.join(localesDir, lang)
    for (const file of pendingFiles) {
      const pendingPath = path.join(pendingDir, file)
      const targetPath = path.join(langDir, file)
      const isNew = !fs.existsSync(targetPath)
      tasks.push({ lang, file, pendingPath, targetPath, isNew })
    }
  }
  return tasks
}
