#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试百度百科页面提取
"""

import asyncio
import websockets
import json

async def test_baike_extraction():
    """测试百度百科页面提取"""
    url = "https://baike.baidu.com/item/%E5%93%88%E5%B8%8C%E5%87%BD%E6%95%B0"
    print(f'测试百度百科页面: {url}')
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
            
            # 显示提取的内容（前1000字符）
            content = result.get('content')
            if content:
                print('\n提取内容（前1000字符）:')
                print('=' * 80)
                print(content[:1000] + '...')
                print('=' * 80)
        else:
            print(f'错误: {result.get("error")}')

if __name__ == '__main__':
    print('测试百度百科页面提取...')
    asyncio.run(test_baike_extraction())