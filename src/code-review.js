import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import os from 'os';
import config from './review.config.js';
import { apiConfig } from './review.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

let pkg = {};
try {
  const pkgPath = path.join(__dirname, '../package.json');
  const pkgContent = fs.readFileSync(pkgPath, 'utf8');
  pkg = JSON.parse(pkgContent);
} catch (error) {
  console.error(`${colors.red}错误: ${colors.reset}读取 package.json 失败:`, error.message);
}

/**
 * 设置API Key到配置文件
 * @param {string} apiKey 要设置的API Key
 */
function setApiKey(apiKey) {
  try {
    const configPath = path.join(os.homedir(), '.dt-cr-config.json');
    let config = {};

    // 如果配置文件已存在，读取现有配置
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    // 更新API Key
    config.apiKey = apiKey;

    // 写入配置文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`${colors.green}✓ 成功: ${colors.reset}API Key已保存到 ${configPath}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}错误: ${colors.reset}保存API Key失败:`, error.message);
    return false;
  }
}

/**
 * 读取.gitignore文件并解析忽略规则
 * @returns {string[]} 忽略规则列表
 */
function loadGitIgnoreRules() {
  const CWD = process.cwd();
  const gitignorePath = path.join(CWD, '.gitignore');

  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const rules = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
      console.log(`${colors.blue}信息: ${colors.reset}已加载${rules.length}条.gitignore规则`);
      return rules;
    } catch (error) {
      console.warn(`${colors.yellow}警告: ${colors.reset}读取.gitignore文件失败:`, error.message);
      return [];
    }
  }
  return [];
}

/**
 * 检查文件是否应该被忽略
 * @param {string} filePath 文件路径
 * @param {string[]} gitignoreRules .gitignore规则
 * @returns {boolean} 是否忽略
 */
function shouldIgnoreFile(filePath, gitignoreRules) {
  // 检查自定义忽略规则
  if (
    config.ignoredPaths &&
    config.ignoredPaths.some((pattern) => {
      if (typeof pattern === 'string') {
        return filePath.includes(pattern);
      } else if (pattern instanceof RegExp) {
        return pattern.test(filePath);
      }
      return false;
    })
  ) {
    return true;
  }

  // 检查.gitignore规则
  for (const rule of gitignoreRules) {
    // 简单实现:检查路径是否匹配规则(包含或结束)
    if (filePath.endsWith(rule) || filePath.includes('/' + rule)) {
      return true;
    }
  }
  return false;
}

/**
 * 检测项目使用的版本控制系统
 * @returns {string|null} 'git', 'svn' 或 null
 */
function detectVCS() {
  let currentPath = process.cwd();
  const root = path.parse(currentPath).root; // 获取文件系统根目录，避免无限循环

  while (currentPath && currentPath !== root) {
    if (fs.existsSync(path.join(currentPath, '.git'))) {
      console.log(`${colors.blue}信息: ${colors.reset}在 ${currentPath} 检测到 Git 仓库`);
      return 'git';
    } else if (fs.existsSync(path.join(currentPath, '.svn'))) {
      console.log(`${colors.blue}信息: ${colors.reset}在 ${currentPath} 检测到 SVN 仓库`);
      return 'svn';
    }
    currentPath = path.dirname(currentPath); // 移动到上一级目录
  }

  // 最后检查一次根目录（如果循环因为 currentPath === root 而停止）
  if (currentPath === root) {
    if (fs.existsSync(path.join(currentPath, '.git'))) {
      console.log(`${colors.blue}信息: ${colors.reset}在 ${currentPath} 检测到 Git 仓库`);
      return 'git';
    } else if (fs.existsSync(path.join(currentPath, '.svn'))) {
      console.log(`${colors.blue}信息: ${colors.reset}在 ${currentPath} 检测到 SVN 仓库`);
      return 'svn';
    }
  }

  console.warn(`${colors.yellow}警告: ${colors.reset}未检测到 Git 或 SVN 仓库 (已从 ${process.cwd()} 向上搜索)`);
  return null;
}

/**
 * 获取代码变更
 * @param {string} vcs 版本控制系统类型
 * @returns {string} diff内容
 */
function getVCSDiff(vcs) {
  try {
    if (vcs === 'git') {
      try {
        console.log(`${colors.blue}信息: ${colors.reset}检查工作目录变更...`);
        let workingDiff = execSync('git diff HEAD', { encoding: 'utf8' });

        // 获取已暂存的更改
        let stagedDiff = execSync('git diff --cached', { encoding: 'utf8' });

        // 合并两种更改
        let combinedDiff = workingDiff + stagedDiff;

        // 如果有任何变更，返回
        if (combinedDiff && combinedDiff.trim() !== '') {
          return combinedDiff;
        }
      } catch (gitError) {
        // Git命令可能失败，尝试获取本地文件变更
        console.warn(`${colors.yellow}警告: ${colors.reset}无法使用git获取变更，尝试从本地文件读取...`);
      }
    } else if (vcs === 'svn') {
      return execSync('svn diff', { encoding: 'utf8' });
    }
    return '';
  } catch (error) {
    console.error(`${colors.red}错误: ${colors.reset}获取变更失败:`, error.stderr || error.message);
    return '';
  }
}

/**
 * 从diff中过滤掉应该被忽略的文件
 * @param {string} diff diff内容
 * @param {string[]} gitignoreRules gitignore规则
 * @param {string} vcs 版本控制系统类型 ('git' 或 'svn')
 * @returns {string} 过滤后的diff
 */
function filterIgnoredFiles(diff, gitignoreRules, vcs = 'git') {
  if (!diff || diff.trim() === '') {
    return diff;
  }

  // 解析diff为文件块
  const diffBlocks = [];
  let currentBlock = [];
  let currentFile = null;

  // 按行分割diff
  const lines = diff.split('\n');

  // 根据VCS类型选择不同的解析策略
  if (vcs === 'git') {
    // Git差异解析
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 检测新文件头
      if (line.startsWith('diff --git')) {
        // 保存之前的块
        if (currentBlock.length > 0 && currentFile) {
          diffBlocks.push({
            file: currentFile,
            content: currentBlock.join('\n'),
          });
        }

        // 开始新块
        currentBlock = [line];

        // 提取文件名
        const match = line.match(/diff --git a\/(.*) b\/(.*)/);
        if (match) {
          currentFile = match[1];
        } else {
          currentFile = null;
        }

        continue;
      }

      // 将当前行添加到当前块
      if (currentBlock.length > 0) {
        currentBlock.push(line);
      } else {
        // 如果没有diff头就开始了，先创建一个块
        currentBlock = [line];
      }
    }
  } else if (vcs === 'svn') {
    // SVN差异解析
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // SVN中新文件块通常以"Index: "开头
      if (line.startsWith('Index: ')) {
        // 保存之前的块
        if (currentBlock.length > 0 && currentFile) {
          diffBlocks.push({
            file: currentFile,
            content: currentBlock.join('\n'),
          });
        }

        // 开始新块
        currentBlock = [line];

        // 提取文件名 (在"Index: "之后)
        currentFile = line.substring(7).trim();
        continue;
      }

      // 将当前行添加到当前块
      if (currentBlock.length > 0) {
        currentBlock.push(line);
      } else {
        // 如果没有Index头就开始了，先创建一个块
        currentBlock = [line];
      }
    }
  }

  // 添加最后一个块
  if (currentBlock.length > 0 && currentFile) {
    diffBlocks.push({
      file: currentFile,
      content: currentBlock.join('\n'),
    });
  }

  // 过滤掉应该忽略的文件块
  const filteredBlocks = diffBlocks.filter((block) => {
    if (!block.file) return true;
    if (shouldIgnoreFile(block.file, gitignoreRules)) {
      return false;
    }
    return true;
  });

  // 打印文件过滤结果
  console.log(`\n${colors.blue}文件过滤结果：${colors.reset}`);

  // 显示被忽略的文件 - 进行去重处理
  const ignoredFiles = diffBlocks.filter((block) => block.file && shouldIgnoreFile(block.file, gitignoreRules));
  // 使用Set对文件名进行去重
  const uniqueIgnoredFiles = [...new Set(ignoredFiles.map((block) => block.file))];

  if (uniqueIgnoredFiles.length > 0) {
    console.log(`  ${colors.blue}◌ 忽略文件 (${uniqueIgnoredFiles.length}):${colors.reset}`);
    uniqueIgnoredFiles.forEach((file) => {
      console.log(`    - ${colors.cyan}${file}${colors.reset}`);
    });
  } else {
    console.log(`  ${colors.green}✓ 无忽略文件${colors.reset}`);
  }

  // 显示参与分析的文件 - 进行去重处理
  // 使用Set对文件名进行去重
  const uniqueAnalyzedFiles = [...new Set(filteredBlocks.filter((block) => block.file).map((block) => block.file))];

  if (uniqueAnalyzedFiles.length > 0) {
    console.log(`  ${colors.green}✓ 分析文件 (${uniqueAnalyzedFiles.length}):${colors.reset}`);
    uniqueAnalyzedFiles.forEach((file) => {
      console.log(`    - ${colors.cyan}${file}${colors.reset}`);
    });
  } else {
    console.log(`  ${colors.yellow}⚠️ 无分析文件${colors.reset}`);
  }
  console.log(''); // 空行分隔

  // 重新组合diff
  return filteredBlocks.map((block) => block.content).join('\n\n');
}

/**
 * 解析diff内容，获取相关信息
 * @param {string} diff diff内容
 * @param {string} vcs 版本控制系统类型 ('git' 或 'svn')
 * @returns {Object} 解析结果
 */
function analyzeDiff(diff, vcs = 'git') {
  const commentMatches = [];
  const envIssues = [];
  const businessDataSuspects = []; // 所有可疑的业务敏感数据
  const gitignoreRules = loadGitIgnoreRules();

  if (!diff || diff.trim() === '') {
    console.warn(`${colors.yellow}警告: ${colors.reset}没有发现变更内容`);
    return {
      commentMatches,
      envIssues,
      businessDataSuspects,
      originalDiff: diff,
    };
  }

  // 首先过滤掉被忽略的文件
  const filteredDiff = filterIgnoredFiles(diff, gitignoreRules, vcs);

  if (!filteredDiff || filteredDiff.trim() === '') {
    console.warn(`${colors.yellow}警告: ${colors.reset}过滤后没有变更内容`);
    return {
      commentMatches,
      envIssues,
      businessDataSuspects,
      originalDiff: filteredDiff,
    };
  }

  // 按行分割diff
  const lines = filteredDiff.split('\n');
  let currentFile = null;
  let lineNumber = 0;

  // 单次扫描：同时检测所有问题
  for (const line of lines) {
    // 检测文件头行
    if (line.startsWith('+++') || line.startsWith('---')) {
      const filePath = line.substring(4).trim();
      if (line.startsWith('+++') && !filePath.startsWith('/dev/null')) {
        currentFile = filePath.replace(/^[ba]\//, '');
      }
      continue;
    }

    // 检测行号变化
    if (currentFile && line.startsWith('@@')) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        lineNumber = parseInt(match[1], 10) - 1;
      }
      continue;
    }

    // 分析增加的行内容
    if (currentFile && line.startsWith('+') && !line.startsWith('+++')) {
      const contentLine = line.substring(1);
      lineNumber++;

      // 检查特定注释标记
      for (const keyword of config.commentKeywords) {
        const matches = [...contentLine.matchAll(keyword.pattern)];
        for (const match of matches) {
          commentMatches.push({
            file: currentFile,
            line: lineNumber,
            type: keyword.type,
            text: match[1]?.trim() || '未提供描述',
          });
        }
        // 重置正则表达式内部状态
        keyword.pattern.lastIndex = 0;
      }

      // 检查环境特定问题
      for (const check of config.environmentChecks) {
        if (check.pattern.test(contentLine)) {
          envIssues.push({
            file: currentFile,
            line: lineNumber,
            message: check.message,
          });
          // 重置正则表达式内部状态
          check.pattern.lastIndex = 0;
        }
      }

      // 检查业务敏感数据 - 简化版，只收集所有匹配项
      if (config.businessDataPatterns) {
        // 遍历不同类型的业务数据模式
        for (const [category, patterns] of Object.entries(config.businessDataPatterns)) {
          for (const patternConfig of patterns) {
            const matches = [...contentLine.matchAll(patternConfig.pattern)];
            for (const match of matches) {
              // 收集可能的敏感数据，不进行上下文分析
              businessDataSuspects.push({
                file: currentFile,
                line: lineNumber,
                category,
                match: match[0],
                content: contentLine.trim(),
              });

              // 重置正则表达式内部状态
              patternConfig.pattern.lastIndex = 0;
            }
          }
        }
      }
    } else if (currentFile && line.startsWith(' ')) {
      // 上下文行，更新行号
      lineNumber++;
    }
  }

  // Deduplicate commentMatches
  const uniqueCommentMatches = [];
  const seenCommentKeys = new Set();
  for (const cm of commentMatches) {
    const key = `${cm.file}:${cm.line}:${cm.type}:${cm.text}`;
    if (!seenCommentKeys.has(key)) {
      uniqueCommentMatches.push(cm);
      seenCommentKeys.add(key);
    }
  }

  // Deduplicate envIssues
  const uniqueEnvIssues = [];
  const seenEnvIssueKeys = new Set();
  for (const ei of envIssues) {
    const key = `${ei.file}:${ei.line}:${ei.message}`;
    if (!seenEnvIssueKeys.has(key)) {
      uniqueEnvIssues.push(ei);
      seenEnvIssueKeys.add(key);
    }
  }

  // Deduplicate businessDataSuspects
  const uniqueBusinessDataSuspects = [];
  const seenBusinessDataKeys = new Set();
  for (const bd of businessDataSuspects) {
    const key = `${bd.file}:${bd.line}:${bd.category}:${bd.match}`;
    if (!seenBusinessDataKeys.has(key)) {
      uniqueBusinessDataSuspects.push(bd);
      seenBusinessDataKeys.add(key);
    }
  }

  return {
    commentMatches: uniqueCommentMatches,
    envIssues: uniqueEnvIssues,
    businessDataSuspects: uniqueBusinessDataSuspects,
    originalDiff: filteredDiff,
  };
}

/**
 * 构建AI提示词
 * @param {Object} analysisResult 分析结果
 * @returns {string} 提示词
 */
function buildPrompt(analysisResult) {
  const { commentMatches, envIssues, businessDataSuspects, originalDiff } = analysisResult;

  let commentsList = '无特殊注释标记';
  if (commentMatches.length > 0) {
    commentsList = commentMatches.map((c) => `- ${c.file}:${c.line} ${c.type}: ${c.text}`).join('\n');
  }

  let issuesList = '无环境相关问题';
  if (envIssues.length > 0) {
    issuesList = envIssues.map((i) => `- ${i.file}:${i.line} ${i.message}`).join('\n');
  }

  // 构建业务敏感数据列表
  let businessDataList = '无业务敏感数据';
  if (businessDataSuspects.length > 0) {
    businessDataList = businessDataSuspects
      .map((b) => `- ${b.file}:${b.line} [${b.category}] 匹配: "${b.match}" 在内容: "${b.content}"`)
      .join('\n');
  }

  let diffContent = originalDiff.trim();
  if (diffContent === '') {
    diffContent = '没有发现代码变更';
  }

  return `
## Role（角色定义）
你是一位资深的全栈开发专家，具备15年以上前后端开发和代码审查经验，精通多种编程语言、框架和技术栈，对生产环境部署、安全规范和业务风险控制有深入理解。

## Task（任务描述）
基于提供的代码diff和辅助分析信息，执行全面的代码评审，重点关注：
- **代码质量**：可读性、可维护性、性能、安全性
- **业务风险**：生产环境适用性、敏感数据处理、测试数据泄露
- **部署安全**：配置管理、环境隔离、硬编码检查

## Format（输出格式）

### 输入数据
"""
代码变更（diff）：${diffContent}
辅助信息：
- 识别的注释标记：${commentsList}
- 潜在环境/配置问题：${issuesList}
- 涉及的业务敏感数据：${businessDataList}
"""

### 输出结构
使用以下固定格式输出中文评审意见：

"""
## 代码审查意见

### 【🔴 代码相关】
[如无代码相关问题，显示"无"]

1. [文件路径]
	📍行 [行号] - `[具体代码片段]`
		 问题：[问题描述]
		 解决：[具体解决方案]
	📍行 [行号] - `[具体代码片段]`
		 问题：[问题描述]
		 解决：[具体解决方案]

2. [另一个文件路径]
	📍行 [行号] - `[具体代码片段]`
		 问题：[问题描述]
		 解决：[具体解决方案]

### 【🟡 业务相关】
[如无业务相关问题，显示"无"]

1. [文件路径]
	📍行 [行号] - `[具体代码片段]`
		 问题：[业务风险/部署安全问题描述]
		 解决：[具体解决方案]
	📍行 [行号] - `[具体代码片段]`
		 问题：[业务风险/部署安全问题描述]
		 解决：[具体解决方案]

## 📋 整改清单
- [ ] [具体整改项目1]
- [ ] [具体整改项目2]
- [ ] [具体整改项目3]
"""

## 评审分类与检查点

### 🔴 代码相关问题
包括但不限于：
- **代码质量**：可读性、可维护性、代码规范
- **功能实现**：逻辑错误、边界条件、异常处理
- **性能问题**：算法复杂度、资源使用、内存泄露
- **安全漏洞**：输入验证、权限控制、加密处理
- **最佳实践**：设计模式、代码结构、重构机会

### 🟡 业务相关问题  
包括但不限于：
- **生产环境风险**：敏感信息泄露、硬编码配置
- **测试数据污染**：测试数据残留、调试代码未清理
- **部署安全**：环境配置、服务依赖、兼容性
- **业务逻辑**：业务规则正确性、数据一致性
- **合规要求**：数据隐私、审计日志、权限管控

## 输出要求
1. **语言**：中文
2. **格式**：严格按TXT模板输出，每个问题必须包含文件路径、行号、代码片段、问题描述和解决方案
3. **风格**：简洁明了，不啰嗦，问题描述20字以内，解决方案30字以内
4. **分类**：代码相关（技术问题）、业务相关（业务风险和部署安全）
5. **定位**：精确标明文件路径和行号，引用实际代码片段
6. **整改清单**：汇总所有需要修改的具体行动项

严格按格式输出，确保简洁准确。
`;
}

/**
 * 调用OpenRouter API
 * @param {string} promptContent 提示词内容
 * @returns {Promise<string>} API响应
 */
async function callOpenRouter(promptContent) {
  if (!config.openRouter.apiKey) {
    console.error(`${colors.red}错误: ${colors.reset}未设置 apiKey 环境变量`);
    return 'OpenRouter API密钥未配置。AI分析不可用。';
  }

  console.log(`${colors.blue}信息: ${colors.reset}正在调用AI进行代码审查，请稍候...`);
  console.log(`${colors.blue}使用模型：${config.openRouter.model}${colors.reset}`);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openRouter.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.openRouter.model,
        messages: [{ role: 'user', content: promptContent }],
      }),
    });

    if (!response.ok) {
      throw new Error(`API请求失败，状态码 ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '未从AI接收到摘要。';
  } catch (error) {
    console.error(`${colors.red}错误: ${colors.reset}调用OpenRouter API失败:`, error.message);
    return 'AI通信出错。摘要不可用。';
  }
}

/**
 * 显示分析结果
 * @param {Object} analysisResult 分析结果
 * @param {string} aiSummary AI总结
 */
function displayResults(analysisResult, aiSummary) {
  const { commentMatches, envIssues, businessDataSuspects } = analysisResult;

  // 标题栏
  console.log(`\n${'='.repeat(40)}`, '📋 代码审查结果', '='.repeat(40));

  // 代码标记
  if (commentMatches.length > 0) {
    console.log(`\n${colors.bold}${colors.yellow}🔍 发现代码标记 (${commentMatches.length}):${colors.reset}`);

    // 按类型分组
    const commentsByType = {};
    for (const comment of commentMatches) {
      if (!commentsByType[comment.type]) {
        commentsByType[comment.type] = [];
      }
      commentsByType[comment.type].push(comment);
    }

    // 按类型展示
    for (const [type, comments] of Object.entries(commentsByType)) {
      console.log(`  ${colors.yellow}${type}${colors.reset} (${comments.length}项):`);
      for (const comment of comments) {
        console.log(`    ${colors.cyan}${comment.file}:${comment.line}${colors.reset} - ${comment.text}`);
      }
    }
  }

  // 环境问题
  if (envIssues.length > 0) {
    console.log(`\n${colors.bold}${colors.magenta}⚠️ 潜在环境问题 (${envIssues.length}):${colors.reset}`);

    // 按消息分组
    const issuesByMessage = {};
    for (const issue of envIssues) {
      if (!issuesByMessage[issue.message]) {
        issuesByMessage[issue.message] = [];
      }
      issuesByMessage[issue.message].push(issue);
    }

    // 按消息类型展示
    for (const [message, issues] of Object.entries(issuesByMessage)) {
      console.log(`  ${colors.magenta}${message}${colors.reset} (${issues.length}项):`);
      for (const issue of issues) {
        console.log(`    ${colors.cyan}${issue.file}:${issue.line}${colors.reset}`);
      }
    }
  }

  // 业务敏感数据
  if (businessDataSuspects.length > 0) {
    console.log(`\n${colors.bold}${colors.cyan}🔒 业务敏感数据 (${businessDataSuspects.length}):${colors.reset}`);

    // 按类别分组显示
    const dataByCategory = {};
    for (const data of businessDataSuspects) {
      if (!dataByCategory[data.category]) {
        dataByCategory[data.category] = [];
      }
      dataByCategory[data.category].push(data);
    }

    // 按类别排序并展示
    const sortedCategories = Object.keys(dataByCategory).sort();
    for (const category of sortedCategories) {
      const items = dataByCategory[category];
      console.log(`  ${colors.bold} ${category} (${items.length}项):${colors.reset}`);

      // 按文件分组
      const itemsByFile = {};
      for (const item of items) {
        if (!itemsByFile[item.file]) {
          itemsByFile[item.file] = [];
        }
        itemsByFile[item.file].push(item);
      }

      // 按文件展示
      for (const [file, fileItems] of Object.entries(itemsByFile)) {
        console.log(`    ${colors.cyan}${file}:${colors.reset}`);
        for (const item of fileItems) {
          console.log(
            `      ${colors.cyan}行 ${item.line}${colors.reset} - "${colors.yellow}${item.match}${colors.reset}" 在 "${item.content}"`
          );
        }
      }
    }
  }

  // 统计信息
  const totalIssues = commentMatches.length + envIssues.length + businessDataSuspects.length;
  // if (totalIssues > 0) {
  //   console.log(`\n${colors.bold}📊 统计信息:${colors.reset}`);
  //   console.log(`  • 代码标记: ${commentMatches.length}项`);
  //   console.log(`  • 环境问题: ${envIssues.length}项`);
  //   console.log(`  • 敏感数据: ${businessDataSuspects.length}项`);
  //   console.log(`  • 总计问题: ${totalIssues}项`);
  //   console.log(`  ${'-'.repeat(40)}`);
  // }

  // 如果没有发现任何问题
  if (totalIssues === 0) {
    console.log(`\n${colors.green}✓ 未发现任何预制问题${colors.reset}`);
  }

  // AI 审查意见
  console.log(`\n${'='.repeat(40)}`, '🤖 AI代码审查意见', '='.repeat(40));
  console.log(aiSummary);
}

/**
 * 主函数
 */
async function main() {
  // 处理命令行参数

  // 打印Figlet风格的dt-cr标题
  console.log(`${colors.green}
==================================================

  ██████╗ ████████╗          ██████╗ ██████╗
  ██╔══██╗╚══██╔══╝          ██╔════╝██╔══██╗
  ██║  ██║   ██║    ██████╗  ██║     ██████╔╝
  ██║  ██║   ██║    ╚═════╝  ██║     ██╔══██╗
  ██████╔╝   ██║             ╚██████╗██║  ██║
  ╚═════╝    ╚═╝              ╚═════╝╚═╝  ╚═╝
  
  ${colors.bold}AI 代码审查工具 v${pkg.version}${colors.reset}

===================================================
  `);

  const args = process.argv.slice(2);
  if (args.length > 0) {
    // 设置API Key
    if (args[0] === '--set-key' || args[0] === '-k') {
      const apiKey = args[1];
      if (!apiKey) {
        console.error(`${colors.red}错误: ${colors.reset}请提供API Key`);
        console.log(`用法: dt-cr --set-key YOUR_API_KEY`);
        process.exit(1);
      }

      const success = setApiKey(apiKey);
      if (success) {
        console.log(`${colors.green}API Key设置成功。${colors.reset}您现在可以直接运行 dt-cr 命令了。`);
      }
      process.exit(success ? 0 : 1);
    }

    // 显示帮助信息
    if (args[0] === '--help' || args[0] === '-h') {
      console.log(`
${colors.bold}AI 代码审查工具${colors.reset}

使用方法:
  dt-cr                   运行代码审查
  dt-cr --set-key KEY     设置API Key
  dt-cr --help            显示帮助信息

示例:
  dt-cr --set-key sk-xxxxxxxxxxxx     设置OpenRouter API Key
  dt-cr                               审查当前Git仓库的代码变更
      `);
      process.exit(0);
    }
  }

  console.log(`\n${'='.repeat(40)}`, '🚀 开始代码审查', '='.repeat(40));

  const vcs = detectVCS();
  if (!vcs) {
    console.error(`${colors.red}❌ 错误: ${colors.reset}未能识别版本控制系统。请确保在Git或SVN仓库中执行此命令。`);
    process.exit(0);
  }

  const diff = getVCSDiff(vcs);
  if (!diff || diff.trim() === '') {
    console.log(`\n${colors.yellow}⚠️ 警告: ${colors.reset}没有检测到代码变更。确保你的修改已经保存。`);
    process.exit(0);
  }

  const analysisResult = analyzeDiff(diff, vcs);

  // 计算总问题数
  const totalIssues = analysisResult.commentMatches.length + analysisResult.envIssues.length + analysisResult.businessDataSuspects.length;

  let aiSummary = '未检测到代码变更或问题，跳过AI审查。'; // 初始化 AI 摘要

  // 检查API Key是否已设置，只有在需要调用AI时才检查
  if (!config.openRouter.apiKey) {
    console.error(`\n${colors.red}❌ 错误: ${colors.reset}未设置API Key，请先运行以下命令设置:`);
    console.log(`dt-cr --set-key YOUR_API_KEY`);
    process.exit(1);
  }

  const prompt = buildPrompt(analysisResult);
  aiSummary = await callOpenRouter(prompt);
  // aiSummary = 'AI 审查意见';

  displayResults(analysisResult, aiSummary);

  // 非阻塞退出
  process.exit(0);
}

main().catch((error) => {
  console.error(`\n${colors.red}❌ 错误: ${colors.reset}程序执行失败:`, error);
  // 非阻塞退出
  process.exit(0);
});
