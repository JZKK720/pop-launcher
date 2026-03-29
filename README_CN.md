# 智方云cubecloud

Windows 桌面应用启动板。一键启动本地 EXE 程序或 localhost 网址，搭配玻璃拟态风格界面。

![平台](https://img.shields.io/badge/平台-Windows%20x64-blue)
![版本](https://img.shields.io/badge/版本-1.0.0-blue)
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

### 下载安装（推荐）

1. 前往 [Releases 页面](../../releases/latest)
2. 下载 `智方云cubecloud Setup 1.0.0.exe`
3. 运行安装程序 — 选择安装目录，点击"安装"
4. 从开始菜单或桌面快捷方式启动：**智方云cubecloud**

**系统要求：** Windows 10 / 11，x64

---

## 开发指南

### 环境准备

```bash
git clone https://github.com/JZKK720/pop-installater.git
cd pop-installater
npm install
```

### 运行开发模式

```bash
npm start
```

### 构建安装包

```bash
npm run build
# 输出路径：dist/智方云cubecloud Setup 1.0.0.exe
```

---

## 数据存储

所有用户数据存储于 `%AppData%\智方云cubecloud\`：

| 路径 | 内容说明 |
|---|---|
| `apps.json` | 应用列表（名称、路径、图标、标签、颜色） |
| `icons/` | 用户上传的图标图片 |

首次启动时，默认应用与图标将从安装包自动复制到用户数据目录。

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
