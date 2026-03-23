#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试客户端：测试网页文字提取功能
"""

import asyncio
import websockets
import json

async def test_extraction():
    """测试提取功能"""
    try:
        # 连接到WebSocket服务器
        async with websockets.connect('ws://localhost:8765') as websocket:
            print('已连接到服务器')
            
            # 发送提取请求
            test_url = 'https://baike.baidu.com/item/%E5%93%88%E5%B8%8C%E5%87%BD%E6%95%B0?fromModule=lemma_search-box'
            request = {
                'type': 'extract',
                'url': test_url
            }
            
            print(f'发送提取请求: {test_url}')
            await websocket.send(json.dumps(request))
            
            # 接收响应
            response = await websocket.recv()
            result = json.loads(response)
            
            print('\n=== 提取结果 ===')
            if result['success']:
                print(f'成功提取！')
                print(f'文件名: {result["filename"]}')
                print(f'内容长度: {result["length"]} 字符')
                print(f'前500字符: {result["content"][:500]}...')
            else:
                print(f'提取失败: {result["error"]}')
                
    except Exception as e:
        print(f'测试失败: {e}')

if __name__ == '__main__':
    print('启动测试客户端...')
    asyncio.run(test_extraction())
