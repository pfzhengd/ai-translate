import fs from 'fs'
import path from 'path'

export function printHelp () {
  console.log(`
🧠 AIT - AI JSON Translator

用法：
  ait [选项]

选项：
  --apiKey=<key>          AI 平台 API Key（必填）
  --apiUrl=<url>          模型接口地址（默认 https://openrouter.ai/api/v1/chat/completions）
  --model=<name>          模型名称（默认 gpt-4o-mini）
  --lang=<ar,de,fr>       指定语言（默认全部）
  --concurrency=<num>     并发翻译任务数（默认 2）
  --retry=<num>           失败重试次数（默认 1）
  --timeout=<ms>          超时时间（默认 60000）
  --dry                   Dry Run 模式，仅打印不写入文件
  --force                 忽略缓存，强制重新翻译所有字段
  -v, --version           显示版本
  -h, --help              显示帮助

示例：
  ait --apiKey=sk-or-v1-xxx
  ait --lang=ar,de --dry
  ait --force
`)
}

export function printVersion () {
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    console.log(`ait v${pkg.version}`)
  } catch {
    console.log('ait (unknown version)')
  }
}
