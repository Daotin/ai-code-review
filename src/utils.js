import fs from 'fs';
import path from 'path';
import os from 'os';
import config from './review.config.js';

// ANSI 颜色代码
export const colors = {
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
 * 设置API Key到配置文件
 * @param {string} apiKey 要设置的API Key
 */
export function setApiKey(apiKey) {
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
export function loadGitIgnoreRules() {
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
export function shouldIgnoreFile(filePath, gitignoreRules) {
  // 标准化文件路径，统一使用正斜杠
  const normalizedPath = filePath.replace(/\\/g, '/');

  // 检查自定义忽略规则
  if (config.ignoredPaths && config.ignoredPaths.length > 0) {
    for (const pattern of config.ignoredPaths) {
      if (typeof pattern === 'string') {
        // 处理字符串模式
        if (matchStringPattern(normalizedPath, pattern)) {
          return true;
        }
      } else if (pattern instanceof RegExp) {
        // 处理正则表达式模式
        if (pattern.test(normalizedPath)) {
          return true;
        }
      }
    }
  }

  // 检查.gitignore规则
  for (const rule of gitignoreRules) {
    if (matchGitIgnoreRule(normalizedPath, rule)) {
      return true;
    }
  }

  return false;
}

/**
 * 匹配字符串模式（支持通配符）
 * @param {string} filePath 文件路径
 * @param {string} pattern 匹配模式
 * @returns {boolean} 是否匹配
 */
function matchStringPattern(filePath, pattern) {
  // 标准化模式，统一使用正斜杠
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // 如果模式以 / 结尾，表示目录匹配
  if (normalizedPattern.endsWith('/')) {
    const dirPattern = normalizedPattern.slice(0, -1);
    // 检查是否在该目录下或者就是该目录
    return filePath.startsWith(dirPattern + '/') || filePath === dirPattern;
  }

  // 如果模式包含通配符 *
  if (normalizedPattern.includes('*')) {
    return matchWildcard(filePath, normalizedPattern);
  }

  // 精确匹配文件名
  if (filePath === normalizedPattern) {
    return true;
  }

  // 检查文件名是否匹配（不包含路径）
  const fileName = filePath.split('/').pop();
  if (fileName === normalizedPattern) {
    return true;
  }

  // 检查路径是否包含该模式
  if (filePath.includes(normalizedPattern)) {
    return true;
  }

  return false;
}

/**
 * 匹配通配符模式
 * @param {string} filePath 文件路径
 * @param {string} pattern 通配符模式
 * @returns {boolean} 是否匹配
 */
function matchWildcard(filePath, pattern) {
  // 将通配符模式转换为正则表达式
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
    .replace(/\*/g, '.*'); // 将 * 替换为 .*

  const regex = new RegExp(`^${regexPattern}$`);

  // 检查完整路径匹配
  if (regex.test(filePath)) {
    return true;
  }

  // 检查文件名匹配
  const fileName = filePath.split('/').pop();
  if (regex.test(fileName)) {
    return true;
  }

  return false;
}

/**
 * 匹配.gitignore规则
 * @param {string} filePath 文件路径
 * @param {string} rule gitignore规则
 * @returns {boolean} 是否匹配
 */
function matchGitIgnoreRule(filePath, rule) {
  // 忽略空规则和注释
  if (!rule || rule.startsWith('#')) {
    return false;
  }

  // 移除前后空格
  const cleanRule = rule.trim();
  if (!cleanRule) {
    return false;
  }

  // 如果规则以 / 开头，表示从根目录开始匹配
  if (cleanRule.startsWith('/')) {
    const rootRule = cleanRule.slice(1);
    return matchStringPattern(filePath, rootRule);
  }

  // 如果规则以 / 结尾，表示目录匹配
  if (cleanRule.endsWith('/')) {
    const dirRule = cleanRule.slice(0, -1);
    return filePath.startsWith(dirRule + '/') || filePath === dirRule;
  }

  // 检查路径是否以规则结尾
  if (filePath.endsWith(cleanRule)) {
    return true;
  }

  // 检查路径是否包含 /规则
  if (filePath.includes('/' + cleanRule)) {
    return true;
  }

  // 检查文件名是否匹配
  const fileName = filePath.split('/').pop();
  if (fileName === cleanRule) {
    return true;
  }

  return false;
}
