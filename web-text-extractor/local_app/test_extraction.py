#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试提取功能
"""

import asyncio
import websockets
import json

async def test_extraction():
    """测试提取功能"""
    # 测试多个不同的网页
    urls = [
        "https://www.baidu.com",
        "https://news.baidu.com"
    ]
    
    for url in urls:
        print(f'\n\n测试网页: {url}')
        print('=' * 100)
        
        async with websockets.connect('ws://localhost:8765') as websocket:
            # 发送提取请求
            message = {
                'type': 'extract',
                'url': url
            }
            await websocket.send(json.dumps(message))
            print(f'发送提取请求: {url}')
            
            # 接收响应
            response = await websocket.recv()
            result = json.loads(response)
            
            print('\n提取结果:')
            print(f'成功: {result.get("success")}')
            
            if result.get('success'):
                print(f'文件名: {result.get("filename")}')
                print(f'内容长度: {result.get("length")} 字符')
                
                # 显示提取的内容（前500字符）
                content = result.get('content')
                if content:
                    print('\n提取内容（前500字符）:')
                    print('=' * 80)
                    # 确保换行符被正确显示
                    print(content[:500] + '...')
                    print('=' * 80)
                    
                    # 同时显示原始内容，用于调试
                    print('\n原始内容（前500字符）:')
                    print('=' * 80)
                    print(repr(content[:500]) + '...')
                    print('=' * 80)
            else:
                print(f'错误: {result.get("error")}')
            
            # 等待一段时间，避免请求过快
            await asyncio.sleep(2)

if __name__ == '__main__':
    print('测试百度百科页面提取...')
    asyncio.run(test_extraction())
