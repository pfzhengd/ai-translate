import fs from 'fs'
import path from 'path'

export interface CacheData {
  [lang: string]: {
    [file: string]: {
      [keyPath: string]: string // 记录原始英文文本
    }
  }
}

const CACHE_FILE = path.resolve(process.cwd(), '.ait-cache.json')

export function loadCache (): CacheData {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {}
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

export function saveCache (data: CacheData): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (e) {
    console.warn('⚠️ 写入缓存失败：', e)
  }
}

/** 判断是否需要重新翻译 */
export function shouldTranslate (
  cache: CacheData,
  lang: string,
  file: string,
  keyPath: string,
  currentValue: any
): boolean {
  const oldValue = cache?.[lang]?.[file]?.[keyPath]
  if (oldValue === undefined) return true // ✅ 从未翻译
  return oldValue !== String(currentValue) // ✅ 值发生变化
}

/** 标记已翻译，并记录源值 */
export function markTranslated (
  cache: CacheData,
  lang: string,
  file: string,
  keyPath: string,
  originalValue: any
): void {
  if (!cache[lang]) cache[lang] = {}
  if (!cache[lang][file]) cache[lang][file] = {}
  cache[lang][file][keyPath] = String(originalValue)
}

/** 递归收集所有 key 路径 */
export function collectKeyPaths (obj: any, prefix = ''): string[] {
  const paths: string[] = []
  for (const key in obj) {
    const full = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      paths.push(...collectKeyPaths(obj[key], full))
    } else {
      paths.push(full)
    }
  }
  return paths
}

/** 根据缓存过滤未翻译字段 */
export function filterUntranslated (
  obj: any,
  cache: CacheData,
  lang: string,
  file: string,
  force = false,
  prefix = ''
): any {
  if (force) return obj // 强制翻译全部

  const result: any = Array.isArray(obj) ? [] : {}
  for (const key in obj) {
    const full = prefix ? `${prefix}.${key}` : key
    const value = obj[key]
    if (typeof value === 'object' && value !== null) {
      const nested = filterUntranslated(value, cache, lang, file, force, full)
      if (Object.keys(nested).length > 0) result[key] = nested
    } else if (shouldTranslate(cache, lang, file, full, value)) {
      result[key] = value
    }
  }
  return result
}
