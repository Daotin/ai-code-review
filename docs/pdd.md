# 需求设计文档：AI 辅助的提交前代码审查工具

**版本：** 1.0
**日期：** 2025-05-20
**作者：** AI Assistant (根据用户需求整理)

## 1. 引言与目标

本文档旨在设计一个在代码提交到远程仓库前自动或手动进行 Code Review 的辅助工具。该工具将利用 OpenRouter API 对代码变更进行分析和总结，并特别关注生产/测试环境的校验以及特定代码注释（如 `TODO`, `BUG`, `FIXME`）的提取。目标是提高代码质量、前移问题发现时机、辅助开发者进行更全面的代码审查，同时不阻塞正常的代码提交流程。

## 2. 核心需求

1.  **触发机制：**
    - 支持集成到 Husky 中，在 `pre-commit` 阶段自动进行 diff 校验。
    - 支持通过独立的 npm script 手动触发校验。
2.  **校验与输出内容：**
    - 常规 Code Review 检查点（依赖 OpenRouter API 进行总结）。
    - 发布生产或测试环境的特定校验（例如，提醒代码中可能存在的测试数据、硬编码的测试环境配置等）。
    - 明确列出代码中包含的 `TODO`、`BUG`、`FIXME` 等注释及其所在位置。
    - 将上述信息通过调用 OpenRouter API 进行智能总结后输出。
3.  **版本控制系统支持：**
    - 支持 Git。
    - 支持 SVN。
4.  **执行特性：**
    - 仅列出重要信息和 AI 总结，不强制阻止代码提交。
5.  **用户体验：**
    - 分析结果能够在 VSCode 中方便地查看。
    - 方案能够方便地集成到已有的前端项目中。

## 3. 整体方案设计

本方案的核心是一个 Node.js 脚本，该脚本负责获取代码变更、执行本地分析、调用 OpenRouter API 并输出结果。

### 3.1. 核心脚本 (`src/code-review.js`)

此脚本是所有逻辑的执行中心。

**3.1.1. 主要职责：**

- 检测当前项目使用的版本控制系统（Git 或 SVN）。
- 获取代码变更（diff）。
- 对 diff 内容进行初步分析：提取特定注释、检测潜在的环境配置问题。
- 构建合适的 Prompt，将分析结果和 diff 内容发送给 OpenRouter API。
- 接收 API 的响应，并将其与本地分析结果一同格式化输出。

**3.1.2. 版本控制系统与 Diff 获取：**

- **VCS 检测：** 通过检查项目根目录下是否存在 `.git` 或 `.svn` 文件夹来判断。
- **Git Diff 获取：**
  - Husky `pre-commit` 钩子：`git diff --cached --unified=0` (获取暂存区变更)。
  - 手动执行：可配置为 `git diff HEAD --unified=0` 或与其他分支对比。
- **SVN Diff 获取：**
  - 执行 `svn diff` 命令获取工作副本的变更。
- **实现示例 (Node.js `child_process`)：**

  ```javascript
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');

  function getVCSDiff() {
    const CWD = process.cwd();
    if (fs.existsSync(path.join(CWD, '.git'))) {
      console.log('INFO: Detected Git repository. Fetching staged changes...');
      try {
        return execSync('git diff --cached --unified=0', { encoding: 'utf8' });
      } catch (error) {
        console.error('ERROR: Failed to get Git diff.', error.stderr || error.message);
        return ''; // Or handle differently, e.g., diff against HEAD for manual run
      }
    } else if (fs.existsSync(path.join(CWD, '.svn'))) {
      console.log('INFO: Detected SVN repository. Fetching local changes...');
      try {
        return execSync('svn diff', { encoding: 'utf8' });
      } catch (error) {
        console.error('ERROR: Failed to get SVN diff.', error.stderr || error.message);
        return '';
      }
    } else {
      console.warn('WARN: No Git or SVN repository detected.');
      return null;
    }
  }
  ```

**3.1.3. 代码分析：**

- **特定注释提取：**
  - 使用正则表达式（可配置）扫描 diff 内容，匹配如 `TODO:`, `FIXME:`, `BUG:` 等注释，忽略大小写。
  - 记录文件名、行号（diff 中的相对行号或通过 `git blame` 辅助定位原始行号，后者较复杂）、注释内容。
  - 示例正则：
    ```javascript
    const commentKeywords = [
      { pattern: /TODO\s*:(.*)/gi, type: 'TODO' },
      { pattern: /FIXME\s*:(.*)/gi, type: 'FIXME' },
      { pattern: /BUG\s*:(.*)/gi, type: 'BUG' },
      { pattern: /XXX\s*:(.*)/gi, type: 'XXX' },
    ];
    // ... logic to scan diff lines and apply these patterns
    ```
- **环境特定校验：**
  - 定义一组（可配置的）正则表达式，用于检测不应提交到生产环境的代码片段。
  - 例如：`console.log(...)`, `alert(...)`, `debugger;`, 硬编码的 `localhost` 或测试 API 地址，敏感测试数据模式。
  - 示例规则：
    ```javascript
    const environmentChecks = [
      { pattern: /(console\.log\(|alert\(|debugger;)/g, message: 'Potential debug code found.' },
      { pattern: /api-test\.example\.com/g, message: 'Hardcoded test API endpoint found.' },
    ];
    // ... logic to scan diff lines
    ```

**3.1.4. OpenRouter API 集成：**

- **Prompt 构建：**

  - 将获取到的代码 diff、提取的特定注释列表、检测到的环境问题列表，整合到一个结构化的 Prompt 中。
  - Prompt 应清晰指示 OpenRouter API 对这些信息进行代码审查、总结潜在风险和改进点。
  - 参考 Prompt 示例：

    ```text
    As an expert code reviewer, please analyze the following code changes (diff), identified comment tags, and potential environment-specific issues. Provide a concise summary highlighting critical concerns, areas for improvement, and any TODOs or FIXMEs that require attention before merging.

    [Code Diff]:
    ${diffContent}

    [Identified Comment Tags]:
    ${commentList.map(c => `- ${c.file}:${c.line} ${c.type}: ${c.text}`).join('\n')}

    [Potential Environment/Configuration Issues]:
    ${envIssues.map(i => `- ${i.file}:${i.line} ${i.message}`).join('\n')}

    Your summary:
    ```

- **API 调用：**

  - 使用 `node-fetch` (或 Node.js 18+ 内置的 `Workspace`) 发送 POST 请求到 OpenRouter API endpoint (`https://openrouter.ai/api/v1/chat/completions`)。
  - Headers: `Authorization: Bearer <OPENROUTER_API_KEY>`, `Content-Type: application/json`等。
  - Body: 包含 `model` (e.g., `deepseek/deepseek-chat-v3-0324:free`) 和 `messages` (包含构建的 Prompt)。
  - **API Key 管理：** `OPENROUTER_API_KEY` 必须通过环境变量 (`process.env.OPENROUTER_API_KEY`) 或 `.env` 文件获取，**严禁硬编码**。

  ```javascript
  async function callOpenRouter(promptContent) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('ERROR: OPENROUTER_API_KEY is not set in environment variables.');
      return 'OpenRouter API key not configured. AI summary unavailable.';
    }

    try {
      const response = await fetch('[https://openrouter.ai/api/v1/chat/completions](https://openrouter.ai/api/v1/chat/completions)', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          // "HTTP-Referer": "<YOUR_SITE_URL>", // Optional
          // "X-Title": "<YOUR_SITE_NAME>", // Optional
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat-v3-0324:free', // Or other preferred model
          messages: [{ role: 'user', content: promptContent + '\nAlways response in Chinese.' }],
        }),
      });
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      return data.choices[0]?.message?.content || 'No summary received from AI.';
    } catch (error) {
      console.error('ERROR: Failed to call OpenRouter API:', error.message);
      return 'Error communicating with AI. Summary unavailable.';
    }
  }
  ```

**3.1.5. 输出结果：**

- 将本地提取的注释、环境问题，以及 OpenRouter API 返回的总结，清晰地打印到控制台。
- 使用不同的日志级别或颜色（例如，使用 `chalk` 库）可以增强可读性。

### 3.2. 集成方式

**3.2.1. Husky (自动预提交校验)：**

1.  安装 Husky: `npm install husky --save-dev` (或 `yarn add husky --dev`)
2.  初始化 Husky: `npx husky init` (会在 `.husky/` 目录下生成文件)
3.  添加 `pre-commit` 钩子:
    `npx husky add .husky/pre-commit "node ./src/code-review.js && exit 0"`
    - **关键：** `&& exit 0` 确保即使脚本发现问题并输出信息，也不会阻止提交。如果希望在脚本执行出错时阻止提交，可以去掉 `&& exit 0`，并在脚本内部的严重错误处 `process.exit(1)`。但根据需求，这里是不阻塞提交。

**3.2.2. NPM Script (手动校验)：**

- 在 `package.json` 的 `scripts` 中添加:
  ```json
  "scripts": {
    "review:code": "node ./src/code-review.js"
  }
  ```
- 执行命令：`npm run review:code` 或 `yarn review:code`。

### 3.3. 非阻塞特性

如上所述，通过在 Husky `pre-commit` 命令末尾添加 `&& exit 0`，或者确保 `code-review.js` 脚本在正常完成其信息输出任务后总是以 `process.exit(0)` 结束，可以实现非阻塞提交。

## 4. VSCode 集成 (信息输出)

- **主要方式：集成终端输出。**
  - 当 Husky 钩子运行时，脚本的 `console.log/warn/error` 输出会直接显示在 VSCode 的集成终端（通常是 "Git" 输出或执行提交操作的终端）。
  - 手动运行 npm script 时，输出同样显示在执行命令的终端。
- **优点：** 简单直接，无需额外 VSCode 扩展或复杂配置。

## 5. 集成到已有前端项目

1.  **脚本文件：** 将 `code-review.js` 放置在项目目录中（例如 `src/code-review.js`）。
2.  **依赖安装：**
    - `husky` (如果需要自动校验)。
    - `dotenv` (推荐，用于管理 API Key): `npm install dotenv --save-dev`。
    - `node-fetch` (如果 Node.js < 18): `npm install node-fetch --save-dev`。
3.  **配置 `package.json`：** 添加手动执行的 script。
4.  **Husky 设置：** 按照 3.2.1 步骤配置。
5.  **环境变量：**
    - 创建 `.env` 文件 (并将其添加到 `.gitignore`)：
      ```
      OPENROUTER_API_KEY="your_actual_openrouter_api_key"
      # Optional:
      # OPENROUTER_SITE_URL="your_site_url"
      # OPENROUTER_SITE_NAME="your_site_name"
      ```
    - 在 `code-review.js` 脚本开头加载：`require('dotenv').config();`
6.  **自定义规则 (推荐)：**
    - 将注释关键词、环境校验正则表达式等配置项提取到独立的配置文件（如 `review.config.js`），使主脚本更简洁，配置更灵活。
    ```javascript
    // review.config.js
    module.exports = {
      commentKeywords: [
        /* ...as defined before... */
      ],
      environmentChecks: [
        /* ...as defined before... */
      ],
      // ignoredPaths: ['tests/', 'mocks/'] // Example: Paths to ignore
    };
    ```
    然后在 `code-review.js` 中 `const config = require('./review.config');`。
7.  **团队宣贯：** 向团队成员说明工具的使用方法、配置要求（特别是 API Key）和输出解读。

## 6. 配置项

- **`OPENROUTER_API_KEY` (必需):** OpenRouter API 密钥。
- **`OPENROUTER_SITE_URL` (可选):** 用于 OpenRouter 排名的站点 URL。
- **`OPENROUTER_SITE_NAME` (可选):** 用于 OpenRouter 排名的站点名称。
- **`review.config.js` (推荐):**
  - `commentKeywords`: 自定义需要提取的注释标记及其正则表达式。
  - `environmentChecks`: 自定义环境相关问题的检测规则（正则和提示信息）。
  - `ignoredPaths`: 可选，用于指定哪些文件或路径应跳过检查。
  - `openRouterModel`: 可选，指定使用的 OpenRouter 模型。

## 7. 关键考虑点与最佳实践

- **API Key 安全：** 严禁将 API Key 提交到版本库。始终使用环境变量。
- **Prompt 工程：** Prompt 的质量直接影响 AI 总结的效果。需持续优化。
- **Diff 大小与 API 限制：** 过大的 diff 可能导致 API 调用失败或响应缓慢。对于非常大的单次提交，可能需要策略（如仅分析部分文件或提醒用户拆分提交）。
- **错误处理：** 脚本应健壮地处理各种潜在错误（如命令执行失败、网络问题、API 错误），并给出用户友好的提示。
- **性能：** API 调用是网络依赖的，会有一定耗时。由于是非阻塞的，通常可接受。本地分析应尽可能高效。
- **Node.js 版本：** 确保脚本兼容团队成员的 Node.js 环境。
- **可配置性：** 提供灵活的配置选项，使工具能适应不同项目的具体需求。
- **迭代优化：** 初版上线后，根据团队反馈持续调整 Prompt、校验规则和输出格式。

## 8. 未来可考虑的增强功能

- 更细致的 diff 分析（例如，基于 AST 的分析，但会增加复杂度）。
- 支持针对特定文件类型配置不同的校验规则。
- 与 VSCode 更深度集成（例如，通过自定义扩展将问题直接标记在编辑器中），但这会显著增加复杂性。
- 允许用户在评论中对特定 AI 建议进行反馈，用于未来优化 Prompt。

## 9. 总结

该方案通过结合本地代码分析和强大的 OpenRouter AI 能力，旨在提供一个实用且灵活的提交前代码审查辅助工具。它通过非阻塞的方式向开发者提供有价值的反馈，帮助提升代码质量和开发效率。
