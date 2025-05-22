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
# 不安装
npx dt-cr

# 全局安装
npm install -g dt-cr
```

## 设置 API Key

首次使用前，需要设置 OpenRouter API Key：

```bash
# 不安装的情况
npx dt-cr --set-key YOUR_API_KEY

# 全局安装的情况
dt-cr --set-key YOUR_API_KEY
```

API Key 将安全保存在用户主目录下的 `.dt-cr-config.json` 文件中，无需重复设置。

## 使用方法

### 全局使用

```bash
# 不安装的情况，直接运行
npx dt-cr

# 全局安装的情况
dt-cr

# 或添加到 package.json 脚本
# "scripts": {
#   "review": "dt-cr"
# }
```

### 显示帮助信息

```bash
dt-cr --help
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

## 发布准备

1. 确保已经登录 npm 账户

```bash
npm login
```

2. 执行发布命令

```bash
npm publish --access public
```

## 更新版本

如需更新版本，修改 package.json 中的版本号并重新发布：

1. 升级补丁版本（修复 bug）

```bash
npm version patch
```

2. 升级小版本（新增功能）

```bash
npm version minor
```

3. 升级主版本（不兼容变更）

```bash
npm version major
```
