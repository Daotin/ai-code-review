#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import config from './review.config.js';

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
  const CWD = process.cwd();

  if (fs.existsSync(path.join(CWD, '.git'))) {
    console.log(`${colors.blue}信息: ${colors.reset}检测到 Git 仓库`);
    return 'git';
  } else if (fs.existsSync(path.join(CWD, '.svn'))) {
    console.log(`${colors.blue}信息: ${colors.reset}检测到 SVN 仓库`);
    return 'svn';
  } else {
    console.warn(`${colors.yellow}警告: ${colors.reset}未检测到 Git 或 SVN 仓库`);
    return null;
  }
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
        // // 首先尝试获取已暂存的变更
        // let stagedDiff = execSync('git diff --cached --unified=0', { encoding: 'utf8' });

        // // 如果有已暂存变更，返回
        // if (stagedDiff && stagedDiff.trim() !== '') {
        //   return stagedDiff;
        // }

        // 尝试获取工作目录的变更
        console.log(`${colors.blue}信息: ${colors.reset}没有已暂存的变更，检查工作目录变更...`);
        let workingDiff = execSync('git diff HEAD --unified=0', { encoding: 'utf8' });

        // 如果有工作目录变更，返回
        if (workingDiff && workingDiff.trim() !== '') {
          return workingDiff;
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
 * 解析diff内容，获取相关信息
 * @param {string} diff diff内容
 * @returns {Object} 解析结果
 */
function analyzeDiff(diff) {
  const commentMatches = [];
  const envIssues = [];
  const businessDataSuspects = []; // 所有可疑的业务敏感数据
  const gitignoreRules = loadGitIgnoreRules();

  if (!diff || diff.trim() === '') {
    console.warn(`${colors.yellow}警告: ${colors.reset}没有发现变更内容`);
    return { commentMatches, envIssues, businessDataSuspects, originalDiff: diff };
  }

  // 按行分割diff
  const lines = diff.split('\n');
  let currentFile = null;
  let lineNumber = 0;

  // 单次扫描：同时检测所有问题
  for (const line of lines) {
    // 检测文件头行
    if (line.startsWith('+++') || line.startsWith('---')) {
      const filePath = line.substring(4).trim();
      if (line.startsWith('+++') && !filePath.startsWith('/dev/null')) {
        currentFile = filePath.replace(/^[ba]\//, '');

        // 检查是否应该忽略此文件
        if (shouldIgnoreFile(currentFile, gitignoreRules)) {
          console.log(`${colors.blue}信息: ${colors.reset}忽略文件: ${currentFile}`);
          currentFile = null;
        }
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

  return { commentMatches, envIssues, businessDataSuspects, originalDiff: diff };
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

  return `作为专业代码评审员，请分析以下代码变更（diff）。

请特别注意：你的回答必须简洁通俗易懂，言简意赅，排版清晰。

[代码变更]:
${diffContent}

[识别的注释标记]:
${commentsList}

[潜在的环境/配置问题]:
${issuesList}

[业务敏感数据]:
${businessDataList}

请提供简明的代码审查意见：
1. 全面分析代码变更内容（diffContent），不要仅依赖自动识别的环境问题和敏感数据列表
2. 关注代码中的关键问题和风险
3. 评估测试数据和硬编码值是否适合出现在生产环境
4. 明确列出需要在合并前解决的主要问题

请以中文提供简洁、结构清晰的总结:`;
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

  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bold}${colors.green}📋 代码审查结果 📋${colors.reset}`);
  console.log('='.repeat(80));

  if (commentMatches.length > 0) {
    console.log(`\n${colors.bold}${colors.yellow}🔍 发现的注释标记 (${commentMatches.length}):${colors.reset}`);
    for (const comment of commentMatches) {
      console.log(
        `  ${colors.cyan}${comment.file}:${comment.line}${colors.reset} - ${colors.yellow}${comment.type}:${colors.reset} ${comment.text}`
      );
    }
  }

  if (envIssues.length > 0) {
    console.log(`\n${colors.bold}${colors.magenta}⚠️ 潜在环境问题 (${envIssues.length}):${colors.reset}`);
    for (const issue of envIssues) {
      console.log(`  ${colors.cyan}${issue.file}:${issue.line}${colors.reset} - ${issue.message}`);
    }
  }

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

    for (const [category, items] of Object.entries(dataByCategory)) {
      console.log(`  ${colors.bold}${getEmojiForCategory(category)} ${category} (${items.length}项):${colors.reset}`);
      for (const item of items) {
        console.log(
          `    ${colors.cyan}${item.file}:${item.line}${colors.reset} - "${colors.yellow}${item.match}${colors.reset}" 在 "${item.content}"`
        );
      }
    }
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`${colors.bold}🤖 AI代码审查意见:${colors.reset}\n`);
  console.log(aiSummary);
  console.log('\n' + '='.repeat(80));
}

/**
 * 根据分类获取对应的emoji
 * @param {string} category 分类名称
 * @returns {string} 对应的emoji
 */
function getEmojiForCategory(category) {
  const emojiMap = {
    金额: '💰',
    账户: '👤',
    ID: '🔑',
    手机号: '📱',
    邮箱: '📧',
    密钥: '🔐',
    证件: '📄',
    URL: '🔗',
    IP: '🌐',
  };

  return emojiMap[category] || '📎';
}

/**
 * 主函数
 */
async function main() {
  console.log(`\n${colors.bold}${colors.green}🚀 开始代码审查...${colors.reset}\n`);

  const vcs = detectVCS();
  if (!vcs) {
    console.error(`${colors.red}❌ 错误: ${colors.reset}未能识别版本控制系统。请确保在Git或SVN仓库中执行此命令。`);
    process.exit(0);
  }

  const diff = getVCSDiff(vcs);
  if (!diff || diff.trim() === '') {
    console.log(`${colors.yellow}⚠️ 警告: ${colors.reset}没有检测到代码变更。确保你已经进行了修改但尚未提交。`);
    process.exit(0);
  }

  const analysisResult = analyzeDiff(diff);
  const prompt = buildPrompt(analysisResult);
  const aiSummary = await callOpenRouter(prompt);

  displayResults(analysisResult, aiSummary);

  // 非阻塞退出
  process.exit(0);
}

main().catch((error) => {
  console.error(`${colors.red}❌ 错误: ${colors.reset}程序执行失败:`, error);
  // 非阻塞退出
  process.exit(0);
});
