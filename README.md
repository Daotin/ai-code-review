# AI 辅助代码审查工具

基于 OpenRouter API 的代码审查工具，帮助开发者在提交代码前进行自动审查。

## 功能特点

- 支持 Git 和 SVN 版本控制系统
- 提取代码中的 TODO、FIXME、BUG 等特殊注释
- 检查环境相关问题（调试代码、测试端点等）
- 利用 AI 进行代码变更分析和智能总结
- 非阻塞式反馈，不影响正常提交流程

## 安装方式

### 全局安装

```bash
npm install -g @fe-ai-demo/ai-code-review
```

### 项目内安装

```bash
npm install @fe-ai-demo/ai-code-review --save-dev
```

## 设置 API Key

首次使用前，需要设置 OpenRouter API Key：

```bash
# 全局安装的情况
ai-cr --set-key YOUR_API_KEY

# 项目内安装的情况
npx @fe-ai-demo/ai-code-review --set-key YOUR_API_KEY
```

API Key 将安全保存在用户主目录下的 `.ai-cr-config.json` 文件中，无需重复设置。

## 使用方法

### 全局使用

```bash
ai-cr
```

### 在项目中使用

```bash
# 直接运行
npx @fe-ai-demo/ai-code-review

# 或添加到 package.json 脚本
# "scripts": {
#   "review": "ai-cr"
# }
```

### 显示帮助信息

```bash
ai-cr --help
```

### 本地开发

1. 确保已安装 Node.js (推荐 v14 以上版本)
2. 安装项目依赖

```bash
npm install
```

3. 手动触发代码审查

```bash
npm run cr
```

## 配置

配置文件位于 `src/review.config.js`，可以自定义以下内容：

- 需要提取的注释标记（如 TODO、FIXME 等）
- 环境问题检测规则（调试代码、测试配置等）
- 忽略检查的路径
- OpenRouter API 设置`model`
