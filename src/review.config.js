// 代码审查工具配置
import fs from 'fs';
import path from 'path';
import os from 'os';

export let apiConfig = {
  apiKey: '',
  model: '',
};

// 获取API Key
function getApiConfig() {
  try {
    const configPath = path.join(os.homedir(), '.dt-cr-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      apiConfig.apiKey = config.apiKey || '';
      apiConfig.model = config.model || 'deepseek/deepseek-chat-v3-0324:free'; // XXX 默认模型
    }
  } catch (error) {
    console.error('读取配置文件失败:', error.message);
  }
  return apiConfig;
}

export default {
  // 需要提取的注释标记
  commentKeywords: [
    { pattern: /[\s\/\*]TODO\s*(.*)/gi, type: 'TODO' },
    { pattern: /[\s\/\*]FIXME\s*(.*)/gi, type: 'FIXME' },
    { pattern: /[\s\/\*]BUG\s*(.*)/gi, type: 'BUG' },
    { pattern: /[\s\/\*]XXX\s*(.*)/gi, type: 'XXX' },
    { pattern: /[\s\/\*]HACK\s*(.*)/gi, type: 'HACK' },
    { pattern: /[\s\/\*]NOTE\s*(.*)/gi, type: 'NOTE' },
    { pattern: /[\s\/\*]WARNING\s*(.*)/gi, type: 'WARNING' },
    { pattern: /[\s\/\*]REVIEW\s*(.*)/gi, type: 'REVIEW' },
  ],

  // 环境相关问题检测规则
  environmentChecks: [
    {
      pattern: /(?:api_key|apikey|access_token|secret_key|private_key|password)\s*[:=]\s*['"`][^'"`\s]{8,}/gi,
      message: '可能存在硬编码的敏感信息',
    },
    { pattern: /(?:bearer|token)\s+[A-Za-z0-9\-_]{20,}/gi, message: '可能存在硬编码的认证令牌' },
    // { pattern: /(console\.log\(|console\.debug\(|alert\(|debugger;)/g, message: '可能存在调试代码，生产环境请移除' },
    { pattern: /localhost|127\.0\.0\.1|0\.0\.0\.0/g, message: '发现localhost地址，请确认是否为开发环境配置' },
    { pattern: /api-test|test-api|dev-api|staging-api|api\.dev|dev\.api/g, message: '发现测试API端点，请确认环境配置' },
    { pattern: /test_token|test_key|test_password|test_secret|dev_token|dev_key/g, message: '可能存在测试凭证，生产环境请移除' },
    { pattern: /process\.env\.NODE_ENV\s*(?:!==|!=)\s*['"`]production['"`]/g, message: '非生产环境判断，请确认逻辑正确性' },
  ],

  // 业务数据敏感模式 - 全面收集所有可能的敏感数据
  businessDataPatterns: {
    // 可疑的测试金额
    amounts: [
      { pattern: /(?:price|amount|fee|total|sum|cost|salary|wage|income)\s*(?:=|:)\s*(?:"|')?0*(?:\.0*)?1(?:"|')?/gi },
      { pattern: /(?:"|'|\s)(?:0\.01|1|1\.00|0\.1|100|999|1000|9999)(?:"|'|\s)/g },
      { pattern: /(?:price|amount|fee|total)\s*(?:=|:)\s*(?:"|')?(?:0|1|2|100|999|1000)(?:"|')?/gi },
      { pattern: /(?:discount|tax|rate)\s*(?:=|:)\s*(?:"|')?[01](?:\.[0-9]+)?(?:"|')?/gi },
    ],

    // 明显的测试账户
    accounts: [
      { pattern: /test(?:_|-)?(?:account|user|admin|customer|member|client)/gi },
      { pattern: /(?:user|account|customer|member)(?:_|-)?(?:id|name)?\s*(?:=|:)\s*(?:"|')?(?:12|123|1234|123456)(?:\d{0,6})(?:"|')?/gi },
      { pattern: /(?:"|'|\s)(?:admin|test|demo|example|sample)(?:_|-)?(?:user|account)(?:"|'|\s)/g },
      { pattern: /email\s*(?:=|:)\s*(?:"|')?test@|admin@|demo@|example@/gi },
      { pattern: /(?:username|login)\s*(?:=|:)\s*(?:"|')?(?:admin|test|demo|root|user)(?:"|')?/gi },
    ],

    // 示例数据标识
    sampleData: [
      { pattern: /(?:demo|example|sample|test|mock|fake)(?:_|-)?(?:data|user|product|order)/gi },
      { pattern: /(?:data|user|product|order)(?:_|-)?(?:demo|example|sample|test|mock|fake)/gi },
    ],

    // 固定ID模式
    ids: [
      { pattern: /(?:order|product|transaction|payment|user)(?:_|-)?id\s*(?:=|:)\s*(?:"|')?[A-Z]*\d{4,12}(?:"|')?/gi },
      { pattern: /(?:"|')[A-Z]{2,8}-\d{4,12}(?:"|')/g },
      { pattern: /uuid\s*(?:=|:)\s*(?:"|')?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:"|')?/gi },
    ],

    // 明显的测试环境标识
    environment: [
      { pattern: /process\.env\.NODE_ENV\s*(?:===|==|!==|!=)\s*(?:"|')(?:test|development|dev|qa|staging)(?:"|')/g },
      { pattern: /is(?:Test|Dev|Development|Debug|QA|Staging)\s*(?:=|:)\s*true/g },
      { pattern: /(?:NODE_ENV|ENV|ENVIRONMENT)\s*(?:=|:)\s*(?:"|')?(?:dev|test|staging|qa)(?:"|')?/gi },
    ],

    // 硬编码的状态值
    status: [
      { pattern: /status\s*(?:=|:)\s*(?:"|')?(?:success|fail|error|complete|pending|active|inactive)(?:"|')?/gi },
      { pattern: /state\s*(?:=|:)\s*(?:"|')?(?:loading|loaded|error|success|failed)(?:"|')?/gi },
    ],

    // 可疑的业务逻辑硬编码
    businessLogic: [
      { pattern: /if\s*\(\s*(?:user|customer|account)(?:Id|Name)?\s*(?:===|==)\s*(?:"|')?(?:123|admin|test)/gi },
      { pattern: /(?:role|permission)\s*(?:=|:)\s*(?:"|')?(?:admin|superuser|root)(?:"|')?/gi },
      { pattern: /(?:level|tier|vip)\s*(?:=|:)\s*(?:"|')?(?:premium|gold|platinum|diamond)(?:"|')?/gi },
    ],

    // 可疑的时间和日期硬编码
    datetime: [
      { pattern: /(?:date|time|timestamp)\s*(?:=|:)\s*(?:"|')?2024-01-01|2023-12-31|1970-01-01(?:"|')?/gi },
      { pattern: /new Date\((?:"|')?(?:2024|2023|2022)(?:"|')?\)/g },
    ],
  },

  // 忽略检查的路径
  ignoredPaths: [
    'tests/',
    'test/',
    '__tests__/',
    'mocks/',
    'mock/',
    '__mocks__/',
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    'package.json',
    'package-lock.json',
    'yarn.lock',
    '.git/',
    '.next/',
    '.nuxt/',
    'public/',
    'assets/',
    'static/',
    '*.min.js',
    '*.min.css',
    '*.map',
  ],

  // OpenRouter API设置
  openRouter: {
    model: getApiConfig().model,
    apiKey: getApiConfig().apiKey,
  },
};
