# 智方云cubecloud

Windows 桌面应用启动板。一键启动本地 EXE 程序或 localhost 网址，搭配玻璃拟态风格界面。

![平台](https://img.shields.io/badge/平台-Windows%20x64-blue)
![版本](https://img.shields.io/badge/版本-1.0.5-blue)
![Electron](https://img.shields.io/badge/electron-34-47848F)
![许可证](https://img.shields.io/badge/许可证-Elastic%20License%202.0-orange)

---

## 功能特性

- 一键启动本地 EXE 程序或 `http://` 网址
- 新增、修改、删除应用快捷方式，支持自定义图标、标签与磁贴颜色
- 玻璃拟态毛玻璃界面，深蓝色面板风格
- 数据持久化存储于 `%AppData%`，重装系统后数据仍保留
- 最小化窗口，双击图标恢复
- NSIS 安装包，自动创建开始菜单与桌面快捷方式

---

## 安装方式

### 发布选项

- 主要应用交付方式：Windows NSIS 安装包 `.exe`
- 并行构建与分发方式：基于 Docker 的 HTTP 构建服务，用来生成并提供同一个 Windows 安装包

用户实际运行 **智方云cubecloud** 的方式仍然是 Windows 安装包。Docker 选项面向需要一个通用构建服务、通过 HTTP 来构建、托管或下载安装包的团队或运维场景。是否再叠加 webhook 触发，由使用方决定，并不是必须项。

### 下载安装（推荐）

1. 前往 [Releases 页面](../../releases/latest)
2. 下载 `智方云cubecloud Setup 1.0.5.exe`
3. 运行安装程序 — 选择安装目录，点击"安装"
4. 从开始菜单或桌面快捷方式启动：**智方云cubecloud**

**系统要求：** Windows 10 / 11，x64

---

## 开发指南

### 环境准备

```bash
git clone https://github.com/JZKK720/pop-launcher.git
cd pop-launcher
npm install
```

### 运行开发模式

```bash
npm start
```

### 构建安装包

```bash
npm run build
# 输出路径：dist/智方云cubecloud Setup 1.0.5.exe
```

原生 Windows 打包流程仍然使用仓库内的 `dist/` 目录。

### 本地运行 HTTP 构建服务

```bash
npm run start:build-service
```

可用接口：

- `GET /healthz` 返回服务健康状态与当前构建信息
- `GET /builds` 返回最近的构建任务列表
- `POST /builds` 启动新的构建任务
- `GET /builds/:id` 返回构建状态与产物元数据
- `GET /builds/:id/logs` 返回该任务的构建日志
- `GET /builds/:id/artifact` 下载该任务生成的安装包
- `GET /artifacts/latest` 下载最近一次成功构建的安装包

`POST /builds` 可选请求体：

```json
{
	"cleanDist": true,
	"installDependencies": false,
	"command": "npm run build:win"
}
```

如果设置了 `BUILD_TOKEN`，请通过 `x-build-token` 请求头或 `?token=` 查询参数传递。

### 运行 Docker 构建服务

1. 复制 `.env.example` 为 `.env`，如果需要远程访问，请设置真实的 `BUILD_TOKEN`。
2. 启动服务：

```bash
npm run docker:build-service
```

3. 触发构建：

```bash
curl -X POST http://127.0.0.1:3001/builds \
	-H "Content-Type: application/json" \
	-H "x-build-token: change-me" \
	-d '{"cleanDist":true}'
```

4. 下载最近一次成功构建的安装包：

```bash
curl -L "http://127.0.0.1:3001/artifacts/latest?token=change-me" --output cubecloud-installer.exe
```

容器会将安装包保存到 `artifacts/`，并将任务元数据和日志保存到 `build-service-data/`。

Docker 构建服务会在容器内部使用独立的 `docker-dist/` 作为构建输出目录，因此不会覆盖 `npm run build` 使用的原生 `dist/` 输出。

这意味着 `1.0.5` 版本可以同时提供两种选择：

- 面向普通 Windows 用户的直接安装包下载
- 面向自动化、团队管理或按需 webhook 触发场景的 Docker 构建服务

### 技能集成命令

仓库内置了用于个人 Copilot 技能集成与校验的辅助脚本。

```bash
# 一键启动集成（等同于 skills:apply）
npm run skills:kickoff

# 应用集成（全局技能 + 仓库指令）
npm run skills:apply

# 仅预演应用（不落盘）
npm run skills:apply:dry

# 回滚集成
npm run skills:rollback

# 仅预演回滚（不落盘）
npm run skills:rollback:dry

# 校验集成状态
npm run skills:verify
```

实现细节见 `tools/skill-integration/README.md`。

### Copilot Chat 启动短句（单行）

```text
应用 karpathy-guidelines，修复 <bug>，最小改动、不要重构，只跑相关检查并报告改动文件。
应用 karpathy-guidelines，先复现 <issue>，只修根因，并说明每一处改动原因。
应用 understand，输出架构/模块/依赖热点/风险点，再给出带验证门槛的安全改动计划。
应用 understand-chat，解释 <feature> 的端到端流程，包含调用链、涉及文件、配置点、失败模式。
应用 understand-domain，抽取 <业务域> 的领域/流程/步骤/依赖及改动风险点。
使用仓库 frontend taste 配置，给出 <UI 区域> 的保守版与大胆版方案，再实现选中方案。
使用仓库 frontend taste 配置 + karpathy-guidelines，优化 <UI 区域>，聚焦小 diff，不迁移框架。
先用 understand 分析，再用 karpathy-guidelines 实施；先输出假设、风险、3 步验证计划，再执行。
按严重级别评审当前分支发布风险并附文件引用，覆盖回归与文档漂移，除非明确要求否则不跑构建。
仅审查当前改动的功能与上线风险，给出最小修复建议，除非明确要求否则不跑 build/test。
```

---

## 数据存储

所有用户数据存储于 `%AppData%\智方云cubecloud\`：

| 路径 | 内容说明 |
|---|---|
| `apps.json` | 应用列表（名称、路径、图标、标签、颜色） |
| `icons/` | 用户上传的图标图片 |

首次启动时，默认应用与图标将从安装包自动复制到用户数据目录。
NSIS 安装程序在升级或卸载前也会在 `%AppData%\智方云cubecloud-backup\` 下创建带时间戳的快照，为 `apps.json` 和 `icons/` 保留多份回滚副本。

运行 HTTP 构建服务时，还会在仓库根目录生成以下目录：

| 路径 | 内容说明 |
|---|---|
| `artifacts/` | HTTP 构建服务导出的安装包 |
| `build-service-data/` | 构建任务元数据与日志 |

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 桌面框架 | Electron 34 |
| 前端 | 原生 HTML / CSS / JS |
| IPC 通信 | `contextBridge` + `preload.js` |
| 打包工具 | electron-builder，NSIS，Windows x64 |

---

## 许可证

© 2026 智方云 cubecloud.io。基于 [Elastic License 2.0](LICENSE) 发布。

可免费使用，源码开放。品牌与商标归属智方云 cubecloud.io — 不得修改、移除品牌标识或以其他名称重新分发。
