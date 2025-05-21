// 代码审查工具配置

export default {
  // 需要提取的注释标记
  commentKeywords: [
    { pattern: /TODO\s*:(.*)/gi, type: 'TODO' },
    { pattern: /FIXME\s*:(.*)/gi, type: 'FIXME' },
    { pattern: /BUG\s*:(.*)/gi, type: 'BUG' },
    { pattern: /XXX\s*:(.*)/gi, type: 'XXX' },
  ],

  // 环境相关问题检测规则
  environmentChecks: [
    // { pattern: /(console\.log\(|alert\(|debugger;)/g, message: '可能存在调试代码' },
    // { pattern: /localhost|127\.0\.0\.1|0\.0\.0\.0/g, message: '发现localhost地址' },
    // { pattern: /api-test|test-api|dev-api|staging-api/g, message: '发现测试API端点' },
    // { pattern: /test_token|test_key|test_password|test_secret/g, message: '可能存在测试凭证' },
  ],

  // 业务数据敏感模式 - 全面收集所有可能的敏感数据
  businessDataPatterns: {
    // 可疑的测试金额
    amounts: [
      { pattern: /(?:price|amount|fee|total|sum|price|cost)\s*(?:=|:)\s*(?:"|')?0*(?:\.0*)?1(?:"|')?/gi },
      { pattern: /(?:"|'|\s)(?:0\.01|1|1\.00|0\.1)(?:"|'|\s)/g },
      { pattern: /(?:price|amount|fee|total)\s*(?:=|:)\s*(?:"|')?(?:0|1|2|100|999|1000)(?:"|')?/gi },
    ],

    // 明显的测试账户
    accounts: [
      { pattern: /test(?:_|-)?(?:account|user|admin|customer)/gi },
      { pattern: /(?:user|account|customer|member)(?:_|-)?(?:id|name)?\s*(?:=|:)\s*(?:"|')?(?:12|123|1234|123456)(?:\d{0,6})(?:"|')?/gi },
      { pattern: /(?:"|'|\s)(?:admin|test|demo|example)(?:_|-)?user(?:"|'|\s)/g },
    ],

    // 示例数据标识
    sampleData: [{ pattern: /demo|example|sample|test/gi }],

    // 固定ID模式
    ids: [
      { pattern: /(?:order|product|transaction|payment)(?:_|-)?id\s*(?:=|:)\s*(?:"|')?[A-Z]*\d{4,12}(?:"|')?/gi },
      { pattern: /(?:"|')[A-Z]{2,8}-\d{4,12}(?:"|')/g },
    ],

    // 明显的测试环境标识
    environment: [
      { pattern: /process\.env\.NODE_ENV\s*(?:===|==|!==|!=)\s*(?:"|')(?:test|development|dev|qa)(?:"|')/g },
      { pattern: /is(?:Test|Dev|Development|Debug|QA)\s*(?:=|:)\s*true/g },
    ],

    // 硬编码的状态值
    status: [{ pattern: /status\s*(?:=|:)\s*(?:"|')?(?:success|fail|error|complete|pending)(?:"|')?/gi }],

    // 可疑的计算覆盖
    calculations: [{ pattern: /(?:discount|tax|rate)\s*(?:=|:)\s*(?:"|')?[01](?:\.[0-9]+)?(?:"|')?/gi }],
  },

  // 忽略检查的路径
  ignoredPaths: ['tests/', 'mocks/', 'node_modules/', 'package.json', 'package-lock.json'],

  // OpenRouter API设置
  openRouter: {
    model: 'deepseek/deepseek-chat-v3-0324:free',
    // model: 'qwen/qwen3-235b-a22b:free',
    apiKey: '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',
  },
};
