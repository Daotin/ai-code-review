# AI 辅助代码审查工具

基于 OpenRouter API 的代码审查工具，帮助开发者在提交代码前进行自动审查。

## 功能特点

- 支持 Git 和 SVN 版本控制系统
- 提取代码中的 TODO、FIXME、BUG 等特殊注释
- 检查环境相关问题（调试代码、测试端点等）
- 利用 AI 进行代码变更分析和智能总结
- 非阻塞式反馈，不影响正常提交流程

## 使用方法

### 环境准备

1. 确保已安装 Node.js (推荐 v14 以上版本)
2. 安装项目依赖

```bash
npm install
```

### 手动触发代码审查

```bash
npm run cr
```

## 配置

配置文件位于 `src/review.config.js`，可以自定义以下内容：

- 需要提取的注释标记（如 TODO、FIXME 等）
- 环境问题检测规则（调试代码、测试配置等）
- 忽略检查的路径
- OpenRouter API 设置`model`和`apiKey`
