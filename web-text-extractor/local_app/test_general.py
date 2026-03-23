#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试普通网页提取
"""

import asyncio
import websockets
import json

async def test_general_extraction():
    """测试普通网页提取"""
    # 测试一个普通的非百度网页
    url = "https://www.example.com"
    print(f'测试普通网页: {url}')
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
                print(content[:500] + '...')
                print('=' * 80)
        else:
            print(f'错误: {result.get("error")}')

if __name__ == '__main__':
    print('测试普通网页提取...')
    asyncio.run(test_general_extraction())