import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { colors, shouldIgnoreFile } from './utils.js';

/**
 * 检测项目使用的版本控制系统
 * @returns {string|null} 'git', 'svn' 或 null
 */
export function detectVCS() {
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
export function getVCSDiff(vcs) {
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
export function filterIgnoredFiles(diff, gitignoreRules, vcs = 'git') {
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
