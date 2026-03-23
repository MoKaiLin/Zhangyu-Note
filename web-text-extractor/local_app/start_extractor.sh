#!/bin/bash

# 启动网页文字提取器本地应用

echo "启动网页文字提取器..."
echo "===================================="

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python。请先安装Python 3.6或更高版本。"
    echo "建议从 https://www.python.org/downloads/ 下载安装"
    read -p "按任意键退出..."
    exit 1
fi

echo "Python版本检测成功"

# 安装依赖
echo "检查并安装依赖..."
pip3 install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "错误: 依赖安装失败"
    echo "请尝试手动运行: pip3 install -r requirements.txt"
    read -p "按任意键退出..."
    exit 1
fi

echo "依赖安装成功"

# 启动应用
echo "启动本地应用..."
python3 local_app.py

read -p "按任意键退出..."
