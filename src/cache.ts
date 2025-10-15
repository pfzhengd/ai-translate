import fs from 'fs'
import path from 'path'

/** 读取 package.json 的 name，动态决定缓存路径 */
function getCachePath (): string {
  const root = process.cwd()
  const pkgPath = path.join(root, 'package.json')
  let pkgName = 'default'
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    pkgName = pkg.name?.replace(/^@/, '').replace(/\//g, '-') || 'default'
  } catch {}
  return path.resolve(root, `node_modules/.cache/${pkgName}/cache.json`)
}

function ensureDir (filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

/** 加载缓存 */
export function loadCache (): Record<string, any> {
  const cachePath = getCachePath()
  if (!fs.existsSync(cachePath)) return {}
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'))
  } catch {
    return {}
  }
}

/** 保存缓存 */
export function saveCache (cache: any) {
  const cachePath = getCachePath()
  ensureDir(cachePath)
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8')
}

/** 提取所有 key 的路径 */
export function collectKeyPaths (obj: Record<string, any>, prefix = ''): string[] {
  const result: string[] = []
  for (const [key, val] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key
    if (val && typeof val === 'object') {
      result.push(...collectKeyPaths(val, full))
    } else {
      result.push(full)
    }
  }
  return result
}

/** 根据 lang + file + keyPath 更新缓存 */
export function markTranslated (
  cache: Record<string, any>,
  lang: string,
  file: string,
  keyPath: string,
  originalValue: any
) {
  cache[lang] ??= {}
  cache[lang][file] ??= {}
  cache[lang][file][keyPath] = originalValue
}

/** 过滤出未翻译或变更的条目 */
export function filterUntranslated (
  source: Record<string, any>,
  cache: Record<string, any>,
  lang: string,
  file: string,
  force = false
): Record<string, any> {
  if (force) return source
  const result: Record<string, any> = {}
  const cached = cache[lang]?.[file] ?? {}

  for (const key of collectKeyPaths(source)) {
    const current = key.split('.').reduce((a, k) => a?.[k], source)
    if (cached[key] !== current) {
      assignDeep(result, key.split('.'), current)
    }
  }
  return result
}

/** 深层赋值 */
function assignDeep (obj: any, pathArr: string[], val: any) {
  const key = pathArr.shift()!
  if (!pathArr.length) {
    obj[key] = val
    return
  }
  obj[key] ??= {}
  assignDeep(obj[key], pathArr, val)
}
