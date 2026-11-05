# 碎时重启

把聊天里的讲义、课本照片和公开网页整理成学习笔记。碎时重启提取正文，再用 DeepSeek 生成摘要、大纲、知识点、标签和复习问题，并尝试匹配已有课程。原资料和完整笔记保存在本机收件箱。

## 1. 启动本地服务

安装 Node.js 24。解析 DOCX 和 PPTX 还需要 Python 3，解析带文字层的 PDF 需要 Poppler 的 `pdftotext`。请确保相应命令在 `PATH` 中。图片识别首次运行会下载中文和英文识别模型。

下载 [GitHub 发布页](https://github.com/LuoJiachun37/dsh-fragment-restart/releases/latest) 的 `Source code (zip)`，解压后在项目目录打开 PowerShell。也可以用 Git 克隆。

```powershell
git clone https://github.com/LuoJiachun37/dsh-fragment-restart.git
cd dsh-fragment-restart
```

复制 `.env.example` 为 `.env`，在 `.env` 里填自己的 `DEEPSEEK_API_KEY`。服务将解析出的文本发送给 DeepSeek 生成笔记。留空时仍可提取原文。

```powershell
Copy-Item .env.example .env
# 编辑项目根目录的 .env 后运行以下命令
cd app
npm ci
npm run api
```

保留这个终端。在另一个终端进入项目的 `app` 目录，运行 `npm run dev -- --host 127.0.0.1`，然后打开 [本机收件箱](http://127.0.0.1:5173/)。DeepSeek Harness 或 Aurabot 需要和服务运行在同一台电脑上。聊天插件默认连接 `127.0.0.1:8000`。

## 2. 选择聊天入口

### Aurabot / 大肥鱼 QQ

先安装并绑定 Aurabot，在 Aurabot 中配置自己的主人 QQ。此模块在 Aurabot 1.2.0 上验证。

在仓库根目录打开 PowerShell，把模块复制进 Aurabot 的数据目录。若你的 Harness 使用自定义数据目录，请把 `$dshHome` 改为对应的 `.dsh` 目录。也可以从 Aurabot 的「扩展 → 已安装」面板打开模块文件夹，再复制 `dsh-plugin/aurabot/fragment-restart` 整个文件夹进去。

```powershell
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$module = Join-Path $dshHome 'plugins-data/aurabot/modules/fragment-restart'
New-Item -ItemType Directory -Path $module -Force | Out-Null
Copy-Item dsh-plugin/aurabot/fragment-restart/index.mjs (Join-Path $module 'index.mjs')
```

几秒后，在 Aurabot 的「扩展 → 已安装」确认「碎时重启」已启动。在 QQ 私聊肥鱼使用以下命令。

| 操作 | 命令 |
| --- | --- |
| 确认本机服务已连接 | `/整理 测试` |
| 整理最近一份 QQ 文件 | 先发文件，再发 `/整理` |
| 指定近 30 分钟内发过的文件 | `/整理 导数讲义.docx` |
| 整理最近发过的照片 | 先发图，再发 `/整理 图片` |
| 整理公开网页 | `/整理 https://example.org/article` |

整理命令只处理主人私聊里的资料。结果可能需要多一点时间，可在电脑的收件箱里查看进度。QQ 中显示的本机收件箱地址需要在运行服务的电脑上打开。试运行模式可检查连接。

### DeepSeek Harness 原生聊天

在仓库根目录打开 PowerShell。以下命令使用 Harness CLI，桌面端用 `desktop`，Web 端可改用 `web`。安装后重新打开对应客户端。

```powershell
$bundle = 'file:' + ((Resolve-Path ./dsh-plugin).Path -replace '\\', '/')
dsh plugin --profile desktop add $bundle
```

也可以从发布页下载 `dsh-fragment-restart-0.2.0.tgz`，以它的 `file:` 路径替换 `$bundle`。用自然语言请肥鱼整理对话附件、明确写出的工作区相对路径，或同一条消息粘贴的公开网页链接。旧版 Harness 可将文档放进聊天工作区再提供相对路径。详见 [Harness 插件说明](dsh-plugin/README.md)。

## 支持范围

- 文档支持 DOCX、PPTX、带文字层的 PDF、TXT 和 Markdown。图片支持 JPG、PNG 和 WebP。聊天入口单份文件上限为 30 MB。
- 网页提取标题、正文和封面，过滤常见广告与导航。登录、付费、超时和无法访问时，会尽量说明原因。扫描版 PDF 可先将页面转成图片，再通过图片 OCR 提取。
- 课程归属只从已创建的课程中推荐，资料可在收件箱确认或调整。资料文件保存在 `server/uploads/`，课程和笔记保存在 `server/data/`。
