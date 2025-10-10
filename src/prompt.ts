/** 强约束：只返回纯 JSON，不得含代码块/解释文字 */
export function getPrompt (source: string, language: string): string {
  return `
请将以下 JSON 内容翻译为 ${language}（保持结构与 key 完全一致，仅翻译字符串值）。
⚠️ 只返回合法 JSON；不要输出任何解释文字；不要使用代码块标记(\`\`\`json)。
⚠️ 不要翻译 {{...}} 这种占位符；不要改动 HTML 标签。

内容如下：
${source}
`.trim()
}
