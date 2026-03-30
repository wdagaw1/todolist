# To-Do List Desktop Widget (Electron)

一个放在桌面上的“悬浮贴附”待办小组件：类毛玻璃效果、带日历筛选、支持倒计时，并且可以在应用内开启“开机自启（桌面版）”。

## 运行（开发/本地）

需要先安装 Node.js（建议 18+）。

```bash
cd todolist
npm install
npm start
```

## 打包成 Windows EXE 安装包

```bash
cd todolist
npm run build
```

生成物在：

- `todolist/dist/To-Do List Widget Setup 1.0.0.exe`

## 功能说明

- 置顶：点击顶部“置顶”按钮可切换始终置顶。
- 开机自启：顶部“开机自启”复选框用于设置 Windows 登录项（由应用内部控制）。
- 数据保存：待办数据保存在本地（浏览器 `localStorage`）。

## 项目结构

- `todolist/`：Electron 主进程与前端页面
- `todolist/main.js`：窗口创建、置顶与开机自启相关 IPC
- `todolist/index.html / script.js / style.css`：界面与业务逻辑

