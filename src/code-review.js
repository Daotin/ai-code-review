import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { colors, setApiKey } from './utils.js';
import { detectVCS, getVCSDiff } from './vcs.js';
import { analyzeDiff, buildPrompt, callOpenRouter, displayResults } from './analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取package.json信息
let pkg = {};
try {
  const pkgPath = path.join(__dirname, '../package.json');
  const pkgContent = fs.readFileSync(pkgPath, 'utf8');
  pkg = JSON.parse(pkgContent);
} catch (error) {
  console.error(`${colors.red}错误: ${colors.reset}读取 package.json 失败:`, error.message);
}

/**
 * 主函数
 */
async function main() {
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

  let aiSummary = '未检测到代码变更或问题，跳过AI审查。';

  const prompt = buildPrompt(analysisResult);

  aiSummary = await callOpenRouter(prompt);

  displayResults(analysisResult, aiSummary);

  // 非阻塞退出
  process.exit(0);
}

main().catch((error) => {
  console.error(`\n${colors.red}❌ 错误: ${colors.reset}程序执行失败:`, error);
  // 非阻塞退出
  process.exit(0);
});
