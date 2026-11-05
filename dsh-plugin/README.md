# 碎时重启 · DeepSeek Harness 插件

在 DeepSeek Harness 聊天里整理资料。插件把指定的附件、工作区文件或公开网页提交给同一台电脑上的「碎时重启」。整理完成后，聊天可查看摘要、知识点、标签和课程归属，资料也会出现在碎时重启收件箱。网页抓取失败时，聊天会显示服务返回的原因。

## 启动

按 [项目安装说明](https://github.com/LuoJiachun37/dsh-fragment-restart#1-启动本地服务) 启动本地服务和收件箱，并配置自己的 DeepSeek API 密钥。

如果还没有安装插件，使用 Harness 的插件管理器安装此目录，或者在 PowerShell 中把包添加到你的配置。桌面端配置使用 desktop，浏览器使用 web。安装后重新打开对应客户端。

```powershell
$bundle = 'file:' + ((Resolve-Path ./dsh-plugin).Path -replace '\\', '/')
dsh plugin --profile desktop add $bundle
```

如果是在 Aurabot 的大肥鱼 QQ 私聊中使用，请按 [Aurabot 安装说明](https://github.com/LuoJiachun37/dsh-fragment-restart#aurabot--大肥鱼-qq) 安装独立模块。

## 聊天示例

- 随消息发送一张课本照片，然后说「大肥鱼，用碎时重启整理这张照片」。
- 在支持文档附件的 Harness 中，发送 PDF、DOCX、PPTX、TXT 或 Markdown 文件，然后说「大肥鱼，用碎时重启整理这份讲义」。
- 如果当前 Harness 的附件选择器只支持图片，把文档放进这段对话的工作区，然后说「大肥鱼，用碎时重启整理工作区里的 讲义/导数.docx」。路径相对于创建这段对话时选定的工作区。
- 粘贴一个完整公开网页链接，在同一条消息说「大肥鱼，用碎时重启整理这个链接」。

默认选择当前对话最近一条带附件的用户消息。也可以报出附件文件名。每次最多处理 5 个附件，单份上限 30 MB。PDF 需要有可提取的文本层。等候超时的资料继续在后台处理，可以到收件箱查看。没有明确匹配的课程会显示为「未分类」，可在收件箱手动调整。
