import fs from 'fs'
import path from 'path'

/**
 * 打印帮助信息
 */
export function printHelp () {
  console.log(`
🧠 AIT - AI JSON Translator

用法：
  ait [选项]

选项：
  --apiKey=<key>          AI 平台 API Key（必填）
  --apiUrl=<url>          模型接口地址，默认 https://openrouter.ai/api/v1/chat/completions
  --model=<name>          模型名称，默认 gpt-4o-mini
  --lang=<ar,de,fr>       指定语言（默认处理所有）
  --concurrency=<num>     并发翻译任务数，默认 2
  --retry=<num>           失败重试次数，默认 1
  --timeout=<ms>          请求超时（毫秒），默认 60000
  --dry                   Dry Run 模式，仅打印结果不写入文件
  --merge=false           禁用合并写入，改为完全覆盖
  -v, --version           显示版本号
  -h, --help              显示此帮助信息

示例：
  ait --apiKey=sk-or-v1-xxxx --model=gpt-4o-mini
  ait --apiKey=sk-or-v1-xxxx --lang=ar,de --dry
  `)
}

/**
 * 打印版本信息
 */
export function printVersion () {
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    console.log(`ait v${pkg.version}`)
  } catch {
    console.log('ait (unknown version)')
  }
}
