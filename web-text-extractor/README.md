# 网页文字提取器

## 项目简介

这是一个基于浏览器扩展和本地应用的网页文字提取系统，使用trafilatura库进行智能内容提取，支持图片OCR（可选）。

### 功能特点

- **一键提取**：点击浏览器扩展图标即可提取当前网页内容
- **智能过滤**：使用trafilatura库过滤广告、导航等无关内容
- **无头浏览器**：使用Selenium加载动态网页
- **实时通信**：WebSocket实时传输提取请求和结果
- **自动保存**：提取结果自动保存到本地文件
- **跨平台**：支持Windows、Linux和MacOS

## 系统架构

```
用户打开网页 → 浏览器扩展获取URL → 通过WebSocket发送 → 本地应用接收 → 启动文本提取
最终架构：
用户输入URL → 无头浏览器加载页面 →
    ├─ 提取DOM文本 → 内容提取库 → 过滤后文本
    └─ 检测重要图片 → 截图 → OCR → 图片文本
→ 合并输出
```

## 项目结构

```
web-text-extractor/
├── extension/              # 浏览器扩展
│   ├── manifest.json       # 扩展配置
│   ├── background.js       # 后台脚本
│   └── content.js          # 内容脚本
├── local_app/              # 本地应用
│   ├── local_app.py        # 本地应用主文件
│   ├── requirements.txt    # 依赖包
│   └── start_extractor.bat/sh  # 启动脚本
├── extracted/              # 保存提取的文本
└── README.md               # 项目说明
```

## 安装步骤

### 1. 安装Python依赖

1. 下载并安装Python 3.6+：[https://www.python.org/downloads/](https://www.python.org/downloads/)
2. 进入 `local_app` 目录
3. 运行启动脚本：
   - Windows: `start_extractor.bat`
   - Linux/Mac: `chmod +x start_extractor.sh && ./start_extractor.sh`

### 2. 安装浏览器扩展

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 启用 "开发者模式"
4. 点击 "加载已解压的扩展程序"
5. 选择 `extension` 文件夹

### 3. 启动本地应用

1. 运行 `start_extractor.bat`（Windows）或 `start_extractor.sh`（Linux/Mac）
2. 看到 "WebSocket服务器启动在 ws://localhost:8765" 表示启动成功

## 使用方法

1. 打开任何网页
2. 点击浏览器工具栏中的扩展图标
3. 扩展会自动提取网页内容
4. 提取结果会保存在 `extracted` 文件夹中
5. 查看提取的文本文件

## 技术原理

1. **浏览器扩展**：
   - 监听扩展图标点击事件
   - 获取当前网页URL
   - 通过WebSocket发送提取请求

2. **本地应用**：
   - 启动WebSocket服务器
   - 接收提取请求
   - 使用无头浏览器加载页面
   - 使用trafilatura提取内容
   - 保存提取结果
   - 返回提取状态

3. **内容提取**：
   - 优先使用trafilatura库进行智能提取
   - 备用方案：使用BeautifulSoup提取
   - 过滤广告、导航等无关内容

## 系统要求

- **操作系统**：Windows 10/11, Linux, MacOS
- **浏览器**：Chrome 80+
- **Python**：3.6+ 
- **依赖**：
  - websockets
  - selenium
  - trafilatura
  - requests
  - beautifulsoup4

## 故障排除

### 常见问题

1. **无法连接到本地服务器**
   - 检查本地应用是否正在运行
   - 检查WebSocket服务器是否启动
   - 检查端口8765是否被占用

2. **提取失败**
   - 检查网络连接
   - 检查URL是否正确
   - 查看本地应用日志

3. **依赖安装失败**
   - 确保Python已正确安装
   - 尝试手动安装依赖：`pip install -r requirements.txt`

### 查看日志

- **扩展日志**：右键点击扩展图标 → 管理扩展程序 → 背景页
- **本地应用日志**：查看启动脚本的输出

## 扩展功能（可选）

### 图片OCR

要启用图片OCR功能，需要安装额外的依赖：

1. 安装Tesseract OCR：
   - Windows: [https://github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki)
   - Linux: `sudo apt install tesseract-ocr`
   - Mac: `brew install tesseract`

2. 安装Python依赖：
   ```bash
   pip install pytesseract Pillow
   ```

## 未来计划

- [ ] 支持更多浏览器（Firefox, Edge）
- [ ] 添加GUI界面
- [ ] 支持批量提取
- [ ] 提供API接口
- [ ] 增强OCR功能

## 许可证

MIT License
