🧠 AIT — AI 多语言翻译命令行工具

ait 是一个基于 AI 模型（OpenRouter / DeepSeek / OpenAI）的多语言 JSON 翻译 CLI 工具。
它会读取 pending-langs 目录下的待翻译文件，并根据 locales 下的语言目录自动生成或更新翻译结果。

⸻

🚀 功能特性

✅ 自动识别多语言目录结构  
✅ 支持 OpenRouter / DeepSeek / OpenAI / 自定义接口  
✅ 自动合并写入（仅更新变更字段）  
✅ 支持缓存机制，避免重复调用浪费 Token  
✅ 可通过 --force 强制忽略缓存重新翻译  
✅ 支持并发执行、自动重试  
✅ Dry Run 模式仅输出不写文件  
✅ --log=json 可生成 JSONL 格式日志（便于管控台收集）  
✅ 清理非法 JSON 输出（自动处理 ```json 块）  
✅ 错误日志包含请求上下文与堆栈  

⸻

📦 安装

`npm install -g @jupiterjs/translate`

💡 axios 为 peer 依赖，请确保宿主项目中已安装：

`npm install axios`



⸻

⚙️ 使用方法  

1️⃣ 准备目录结构  

在项目根目录中，需包含以下两个文件夹：
```
.
├── pending-langs/         # 待翻译文件（英文源 JSON）
│   ├── common.json
│   └── home.json
│
└── locales/               # 多语言目录
    ├── ar/                # 阿拉伯语
    │   └── common.json
    ├── de/                # 德语
    │   └── common.json
    ├── fr/
    └── ...
```
📘 规则说明：  
  •	pending-langs 中的文件名会与 locales/<lang>/ 下对应。  
  •	若目标文件不存在 → 自动创建。  
  •	若目标文件存在 → 自动合并，仅更新变更字段。  

⸻

2️⃣ 执行翻译命令

使用 OpenRouter：

```
ait \
  --apiKey=sk-or-v1-xxxxx \
  --apiUrl=https://openrouter.ai/api/v1/chat/completions \
  --model=gpt-4o-mini

```
使用 DeepSeek：

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
--lang | ar,de,fr | 指定语言（默认翻译全部）
--concurrency | 3 | 并发任务数（默认 2）
--retry | 2 | 失败重试次数（默认 1）
--timeout | 60000 | 请求超时（默认 60 秒）
--dry | 无 | Dry Run 模式，仅打印结果不写文件
--force | 无 | 忽略缓存，强制翻译所有字段
--log=json | 无 | 输出 JSONL 格式日志（机器可读）
-v, --version | 无 | 显示版本
-h, --help | 无 | 显示帮助信息


⸻

📘 示例

输入文件：

```
// pending-langs/common.json
{
  "hello": "Hello world",
  "seo": {
    "title": "Cryptocurrency Converter | Bitrue"
  }
}

```
执行命令：

`ait --apiKey=sk-or-v1-xxxx --lang=ar,de`

输出示例：

```
🚀 启动翻译任务...
🌍 API: https://openrouter.ai/api/v1/chat/completions
🔑 模型: gpt-4o-mini
🧵 并发: 2
🔁 重试: 1
💥 强制翻译: 关闭

✅ 2025-10-15T03:18:31.125Z [ar/common.json] 成功 | 354ms
✅ 2025-10-15T03:18:32.009Z [de/common.json] 成功 | 281ms

✅ 成功: 2 | ❌ 失败: 0 | ⏱️ 耗时: 1.7s

```

⸻

🪄 Dry Run 模式

`ait --dry --apiKey=sk-or-v1-xxxx`

输出：

```
ℹ️ 2025-10-15T03:22:00Z [fr/common.json] 跳过 | cache.hit
✅ 2025-10-15T03:22:01Z [ar/common.json] 成功
💡 Dry Run 模式启用：未写入文件

```

⸻

💾 缓存机制

AIT 默认会在：

`node_modules/.cache/@jupiterjs-translate/cache.json`

中记录每次翻译的 原始值快照。  
	•	当字段的原始英文内容未变化时，将自动跳过，节省 Token。  
	•	若内容发生变化或新增字段，则会重新翻译并更新缓存。  
	•	使用 --force 参数可忽略缓存，强制翻译所有内容，并刷新缓存。  

⸻

⚠️ 错误日志示例  

当 AI 返回非法 JSON 时，会自动清理并打印上下文：  

```
❌ AI 翻译失败
   ↳ Unexpected token '`', "```json {...}" is not valid JSON

------ 🧩 AI 请求上下文 ------
模型: gpt-4o-mini
语言: ar
文件: common.json
提示词(前200字):
请将以下内容翻译为 ar，并保持结构与 key 完全一致，仅翻译字符串值。
{
  "hello": "冲呀",
  "seo": {
    "title": "Cryptocurrency Converter & Calculator | Bitrue"
  }
}
--------------------------------

```

⸻

📁 日志输出模式

模式 | 参数 | 特点
------- | ------- | -------
pretty | 默认 | 适合人类阅读
json | --log=json | 每条日志为一行 JSONL，便于日志系统收集分析


⸻

🧠 Peer Dependencies

模块 | 说明
---|---
axios | 用于发起 AI 请求（需宿主项目安装）

`npm install axios`


⸻

🧰 License

MIT © 2025 pfzhengd

⸻