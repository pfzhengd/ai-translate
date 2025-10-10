import axios from 'axios'

export interface AiRequestOptions {
  apiKey: string
  apiUrl: string
  model?: string
  prompt: string
  temperature?: number
  timeoutMs?: number
  referer?: string
  title?: string
}

/** 清洗模型响应，去掉 ```json``` / 解释文字 / 控制符，仅保留 JSON */
export function cleanAIResponse (raw: string): string {
  let s = (raw ?? '').trim()

  // 去掉 Markdown 包装
  s = s
    .replace(/^\s*```json\s*/i, '')
    .replace(/^\s*```/, '')
    .replace(/\s*```$/, '')
    .trim()

  // 截取第一个 { 到最后一个 }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1)
  }

  // 去掉控制符
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim()
}

/** 通用 AI 调用函数 */
export async function callAI ({
  apiKey,
  apiUrl,
  model = 'gpt-4o-mini',
  prompt,
  temperature = 0.2,
  timeoutMs = 60000,
  referer = process.env.OPENROUTER_HTTP_REFERER || 'https://localhost',
  title = process.env.OPENROUTER_X_TITLE || 'bitrue-translate-cli'
}: AiRequestOptions): Promise<string> {
  if (!apiKey) throw new Error('❌ 缺少 apiKey')
  if (!apiUrl) throw new Error('❌ 缺少 apiUrl')

  try {
    const response = await axios.post(
      apiUrl,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': referer,
          'X-Title': title
        },
        timeout: timeoutMs
      }
    )

    const content = response.data?.choices?.[0]?.message?.content ?? ''
    return cleanAIResponse(String(content))
  } catch (error: any) {
    console.error('❌ AI 请求失败：')
    if (error.response) {
      console.error('Status:', error.response.status)
      console.error('Data:', error.response.data)
    } else {
      console.error(error.message)
    }
    throw error
  }
}
