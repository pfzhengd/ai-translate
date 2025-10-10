🧠 AIT — AI 翻译命令行工具

ait 是一个基于 AI 模型的多语言 JSON 翻译 CLI 工具。
它会读取 pending-langs 目录下的待翻译文件，根据 locales 下的语言目录自动生成翻译结果。

⸻

🚀 功能特性

✅ 自动识别语言目录结构
✅ 支持 OpenRouter / DeepSeek / OpenAI 接口
✅ 支持并发请求、重试机制
✅ 自动清理 AI 输出格式（去除 ```json）
✅ 错误日志包含上下文与原始响应
✅ Dry Run 模式可预览翻译结果

⸻

📦 安装

npm install -g @jupiterjs/translate


⸻

⚙️ 使用方法

1️⃣ 准备目录结构

项目根目录中需要包含两个文件夹：
```
.
├── pending-langs/         # 待翻译源文件（JSON）
│   ├── common.json
│   └── home.json
│
└── locales/               # 各语言翻译结果
    ├── ar/                # 阿拉伯语
    │   └── common.json
    ├── de/                # 德语
    │   └── common.json
    ├── fr/
    └── ...
```

📘 规则说明
	•	pending-langs 目录中的文件名将与 `locales/<lang>/` 下文件对应。  
	•	若目标文件不存在 → 自动创建。  
	•	若目标文件存在 → 自动覆盖。  
⸻

2️⃣ 执行翻译命令

使用 OpenRouter

```
ait \
  --apiKey=sk-or-v1-xxxxx \
  --apiUrl=https://openrouter.ai/api/v1/chat/completions \
  --model=gpt-4o-mini
```

使用 DeepSeek

```
ait \
  --apiKey=sk-deepseek-xxxxx \
  --apiUrl=https://api.deepseek.com/v1/chat/completions \
  --model=deepseek-chat
```
执行后会自动为 locales 下的每个语言目录生成对应文件。

⸻

🧩 命令参数

参数 | 示例 | 说明
---|----|---
--apiKey | sk-or-v1-xxxxx | ✅ 必填，AI 平台 API Key
--apiUrl | https://openrouter.ai/api/v1/chat/completions | 模型接口 URL（默认 OpenRouter）
--model | gpt-4o-mini | 模型名称
--lang | ar,de,fr | 指定语言（可选，不传则翻译所有）
--concurrency | 3 | 并发任务数（默认 2）
--retry | 2 | 失败重试次数（默认 1）
--timeout | 60000 | 单次请求超时（毫秒）
--dry | 无 | Dry Run 模式，仅打印结果不写文件


⸻

📘 示例
```
输入

// pending-langs/common.json
{
  "hello": "Hello world",
  "seo": {
    "title": "Cryptocurrency Converter | Bitrue"
  }
}

命令

ait --apiKey=sk-or-v1-xxxx --lang=ar,de

输出

🚀 启动翻译任务...
🌍 API: https://openrouter.ai/api/v1/chat/completions
🔑 模型: gpt-4o-mini
🧵 并发: 2
🔁 重试: 1

🟦 [ar] common.json (替换)
   ├── 调用 AI (尝试 1/2)
   └── ✅ 写入成功: locales/ar/common.json

🟦 [de] common.json (新增)
   ├── 调用 AI (尝试 1/2)
   └── ✅ 写入成功: locales/de/common.json

✅ 完成: 成功 2, 失败 0, 耗时 11.4s

```
⸻

🪄 Dry Run 模式

预览翻译结果但不写入文件：
```
ait --dry --apiKey=sk-or-v1-xxxx

输出：

🟦 [fr] common.json (替换)
   ├── 调用 AI 翻译中...
   └── 💡 Dry Run: 不写入文件。


⸻

⚠️ 错误日志示例

当 AI 返回非法 JSON 时，会自动清理并打印上下文：

❌ 翻译失败: ar/common.json
   错误信息: Unexpected token '`', "```json {...}" is not valid JSON

------ 🧩 AI 请求上下文 ------  
模型: gpt-4o-mini  
语言: ar  
文件: common.json  
提示词(前200字):  
请将以下内容翻译为ar，并保持内容的格式和代码块不变：  
{
  "hello": "冲呀",
  "seo": {
    ...
------ 💬 堆栈 ------
SyntaxError: Unexpected token '`', ...
--------------------------------
⸻
```

🧠 Peer Dependencies
模块 | 说明
------- | -------
axios | 用于发起 AI 请求（需在宿主项目中安装）


  
安装方式：
```
npm install axios
```

⸻

🧰 License

MIT © Zeke

⸻