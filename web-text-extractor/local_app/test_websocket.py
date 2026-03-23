#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocket服务器测试脚本
"""

import asyncio
import websockets
import json

async def handle_connection(websocket, path):
    print('新的连接已建立')
    try:
        async for message in websocket:
            print(f'收到消息: {message}')
            await websocket.send(json.dumps({'type': 'test', 'message': 'Hello from server'}))
    except websockets.exceptions.ConnectionClosedError:
        print('连接已关闭')

async def main():
    print('正在启动WebSocket测试服务器...')
    try:
        async with websockets.serve(handle_connection, 'localhost', 8765):
            print('✅ WebSocket服务器启动成功！运行在 ws://localhost:8765')
            print('服务器已准备就绪，等待连接...')
            await asyncio.Future()
    except Exception as e:
        print(f'❌ WebSocket服务器启动失败: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('应用已停止')
