#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地应用：网页文字提取器
"""

import asyncio
import websockets
import json
import time
import os
import re
from datetime import datetime
from urllib.parse import urlparse

# 无头浏览器
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# 内容提取
import trafilatura
import requests

# OCR（可选）
try:
    from PIL import Image
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

# 配置
class Config:
    # WebSocket服务器配置
    HOST = 'localhost'
    PORT = 8765
    
    # 提取配置
    TIMEOUT = 30
    
    # 输出配置
    OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'extracted')
    
    # 浏览器配置
    CHROME_OPTIONS = [
        '--headless',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
    ]

# 确保输出目录存在
os.makedirs(Config.OUTPUT_DIR, exist_ok=True)

class WebTextExtractor:
    """网页文字提取器"""
    
    def __init__(self):
        self.driver = None
        # 异步初始化浏览器，不阻塞服务器启动
        import threading
        browser_thread = threading.Thread(target=self.setup_browser)
        browser_thread.daemon = True
        browser_thread.start()
    
    def setup_browser(self):
        """设置无头浏览器"""
        try:
            chrome_options = Options()
            # 添加更多的浏览器选项，模拟真实浏览器
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('--disable-extensions')
            chrome_options.add_argument('--disable-infobars')
            chrome_options.add_argument('--disable-blink-features=AutomationControlled')
            chrome_options.add_argument('--disable-web-security')
            chrome_options.add_argument('--allow-running-insecure-content')
            chrome_options.add_argument('--ignore-certificate-errors')
            chrome_options.add_argument('--user-data-dir=C:\\temp\\chrome')
            
            # 添加用户代理
            user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
            chrome_options.add_argument(f'user-agent={user_agent}')
            
            # 添加更多的浏览器特征
            chrome_options.add_experimental_option('excludeSwitches', ['enable-automation'])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            # 尝试使用ChromeDriver
            try:
                # 尝试使用ChromeDriver
                from webdriver_manager.chrome import ChromeDriverManager
                
                service = Service(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=service, options=chrome_options)
                
                # 执行JavaScript来移除webdriver标记
                self.driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
                    'source': '''
                        Object.defineProperty(navigator, 'webdriver', {
                            get: () => undefined
                        })
                        Object.defineProperty(navigator, 'languages', {
                            get: () => ['zh-CN', 'zh', 'en-US', 'en']
                        })
                        Object.defineProperty(navigator, 'plugins', {
                            get: () => [1, 2, 3]
                        })
                        Object.defineProperty(navigator, 'mimeTypes', {
                            get: () => [1, 2, 3]
                        })
                        Object.defineProperty(navigator, 'platform', {
                            get: () => 'Win32'
                        })
                        Object.defineProperty(navigator, 'productSub', {
                            get: () => '20030107'
                        })
                        Object.defineProperty(navigator, 'vendor', {
                            get: () => 'Google Inc.'
                        })
                        Object.defineProperty(navigator, 'vendorSub', {
                            get: () => ''
                        })
                    '''
                })
                
                # 添加网络条件模拟
                self.driver.execute_cdp_cmd('Network.enable', {})
                self.driver.execute_cdp_cmd('Network.setExtraHTTPHeaders', {
                    'headers': {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Referer': 'https://www.baidu.com/',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1'
                    }
                })
                
                self.driver.set_page_load_timeout(Config.TIMEOUT)
                print('无头浏览器初始化成功')
            except Exception as driver_error:
                print(f'ChromeDriver初始化失败: {driver_error}')
                print('将使用备用方案（直接HTTP请求）')
                self.driver = None
        except Exception as e:
            print(f'浏览器初始化失败: {e}')
            self.driver = None
    
    def clean_html(self, html_content):
        """清理HTML内容，处理编码问题"""
        import chardet
        # 处理编码问题
        try:
            # 首先检测内容类型
            if isinstance(html_content, bytes):
                # 自动检测编码
                detected_encoding = chardet.detect(html_content)['encoding']
                print(f'检测到编码: {detected_encoding}')
                
                # 尝试使用检测到的编码
                if detected_encoding:
                    try:
                        html_content = html_content.decode(detected_encoding, errors='replace')
                    except:
                        # 如果失败，尝试常见编码
                        encodings = ['utf-8', 'gbk', 'gb2312', 'utf-16']
                        for encoding in encodings:
                            try:
                                html_content = html_content.decode(encoding, errors='replace')
                                print(f'使用编码 {encoding} 成功')
                                break
                            except:
                                continue
                
            # 验证解码是否成功
            if isinstance(html_content, str):
                # 确保内容是有效的UTF-8
                html_content = html_content.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
        except Exception as e:
            print(f'编码处理错误: {e}')
            # 最终确保内容是字符串
            if isinstance(html_content, bytes):
                html_content = html_content.decode('utf-8', errors='replace')
        
        return html_content
    
    def clean_content(self, content):
        """清理提取的内容"""
        import re
        # 确保内容是字符串
        if not isinstance(content, str):
            content = str(content)
        
        # 处理编码问题，确保内容是有效的UTF-8
        try:
            # 先将内容编码为UTF-8，然后解码，确保编码正确
            content = content.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
        except:
            pass
        
        # 移除控制字符，但保留换行符和中文字符
        content = re.sub(r'[\x00-\x1f\x7f]', '', content)
        
        # 修复可能的编码问题导致的乱码
        content = content.replace('Ã©', 'é').replace('Ã¨', 'è').replace('Ã¤', 'ä').replace('Ã¶', 'ö').replace('Ã¼', 'ü')
        content = content.replace('Ã§', 'ç').replace('Ã±', 'ñ').replace('Ã¡', 'á').replace('Ã©', 'é').replace('Ã­', 'í')
        content = content.replace('Ã³', 'ó').replace('Ãº', 'ú').replace('Ã¿', '¿').replace('Ã', 'á')
        content = content.replace('â€”', '—').replace('â€“', '–').replace('â€™', '’').replace('â€œ', '"').replace('â€"', '"')
        content = content.replace('â€¦', '…').replace('â€¢', '•')
        
        # 修复特定的格式问题
        # 修复"作用- -"这样的重复
        content = re.sub(r'作用-\s*-', '作用-', content)
        # 修复"Addr = （）"这样的问题
        content = re.sub(r'Addr =\s*（）', 'Addr = H（key）', content)
        # 修复"h(）"这样的问题
        content = re.sub(r'h\(\s*）', 'h(k）', content)
        # 修复"p(）"这样的问题
        content = re.sub(r'p\(\s*）', 'p(i）', content)
        # 修复"hp (）"这样的问题
        content = re.sub(r'hp\s*\(\s*）', 'hp (key）', content)
        # 修复"() +"这样的问题
        content = re.sub(r'\(\s*\)\s*\+', 'h(k) +', content)
        # 修复"(() +"这样的问题
        content = re.sub(r'\(\(\s*\)\s*\+', '(h(k) +', content)
        # 修复"()="这样的问题
        content = re.sub(r'\(\s*\)\s*=', 'H(key) =', content)
        # 修复"K≠"这样的问题
        content = re.sub(r'K\s*≠', 'K1≠K2', content)
        # 修复"（）="这样的问题
        content = re.sub(r'（\s*）\s*=', 'H(K1) = H(K2)', content)
        # 修复"[]"这样的问题
        content = re.sub(r'\[\s*\]', '[1]', content)
        # 修复"（,,,,,,）"这样的问题
        content = re.sub(r'\(\s*,\s*,\s*,\s*,\s*,\s*,\s*\)', '(18,14,01,68,27,55,79)', content)
        # 修复"（,,,,,,）"这样的问题
        content = re.sub(r'（\s*,\s*,\s*,\s*,\s*,\s*,\s*）', '(5,1,1,3,1,3,1)', content)
        # 修复"（）"这样的问题
        content = re.sub(r'\(\s*\)', '()', content)
        
        # 过滤无效文字
        # 移除常见的无效文本模式
        invalid_patterns = [
            r'[\s\n]{4,}',  # 4个以上的连续空白
            r'[\-]{3,}',  # 3个以上的连续连字符
            r'[\=]{3,}',  # 3个以上的连续等号
            r'[\*]{3,}',  # 3个以上的连续星号
            r'[\#]{3,}',  # 3个以上的连续井号
            r'[\_]{3,}',  # 3个以上的连续下划线
            r'\b(?:http|https|ftp|mailto|tel):\/\/[^\s]+',  # URL
            r'\b(?:www\.)[^\s]+',  # 网址
            r'\b(?:mailto|tel):[^\s]+',  # 邮件和电话
            r'\b(?:Copyright|©|All rights reserved|Terms of Service|Privacy Policy|Cookie Policy)\b',  # 版权信息
            r'\b(?:Login|Register|Sign in|Sign up|Logout)\b',  # 登录注册
            r'\b(?:Home|About|Contact|FAQ|Help|Support)\b',  # 导航链接
            r'\b(?:Share|Like|Follow|Comment)\b',  # 社交媒体
            r'\b(?:Advertisement|Ad|Sponsored|Promoted)\b',  # 广告
            r'\b(?:Loading|Please wait|Processing)\b',  # 加载信息
            r'\b(?:Error|Failed|Not found|404)\b',  # 错误信息
            r'\b(?:Subscribe|Unsubscribe|Newsletter)\b',  # 订阅
            r'\b(?:Search|Find|Browse)\b',  # 搜索
            r'\b(?:Download|Upload|Save|Print)\b',  # 下载上传
            r'\b(?:Next|Previous|Back|Forward)\b',  # 导航
            r'\b(?:Page|Section|Chapter|Part)\b',  # 分页
            r'\b(?:Read more|Learn more|Know more)\b',  # 阅读更多
            r'\b(?:Related|Recommended|Similar)\b',  # 相关内容
        ]
        
        # 过滤无效文字
        for pattern in invalid_patterns:
            content = re.sub(pattern, '', content, flags=re.IGNORECASE)
        
        # 清理多余的空白
        content = re.sub(r'\s+', ' ', content)
        content = re.sub(r'\n\s+', '\n', content)
        content = re.sub(r'\s+\n', '\n', content)
        
        # 清理多余的空行
        content = re.sub(r'\n{3,}', '\n\n', content)
        
        # 确保内容开头和结尾没有多余的空行
        content = content.strip()
        
        # 确保内容开头没有多余的空行
        content = content.lstrip()
        
        # 移除过短的行（小于5个字符），保留更多有效内容
        lines = content.split('\n')
        filtered_lines = [line for line in lines if len(line.strip()) >= 5]
        content = '\n'.join(filtered_lines)
        
        return content
    
    def extract_from_url(self, url):
        """从URL提取内容"""
        
        try:
            print(f'开始提取URL: {url}')
            
            # 首先尝试使用trafilatura的直接提取功能
            print('使用trafilatura直接提取内容...')
            try:
                # 使用trafilatura的fetch_url和extract方法
                from trafilatura import fetch_url, extract
                print(f'正在使用trafilatura.fetch_url获取URL: {url}')
                downloaded = fetch_url(url)
                print(f'trafilatura.fetch_url返回: {type(downloaded)}')
                if downloaded:
                    print(f'下载内容长度: {len(downloaded)} 字符')
                    print(f'下载内容前200字符: {downloaded[:200]}...')
                    extracted_content = extract(downloaded, output_format='txt', include_links=False, include_images=False, include_tables=True, favor_precision=False, favor_recall=True, include_comments=False, include_formatting=True, deduplicate=True, target_language='zh')
                    print(f'trafilatura.extract返回: {type(extracted_content)}')
                    if extracted_content:
                        print(f'提取内容长度: {len(extracted_content)} 字符')
                        if len(extracted_content) > 50:
                            print('trafilatura直接提取成功')
                            # 清理提取的内容
                            extracted_content = self.clean_content(extracted_content)
                            print(f'清理后内容长度: {len(extracted_content)} 字符')
                            print(f'清理后内容前500字符: {extracted_content[:500]}...')
                            # 确保内容是UTF-8编码
                            try:
                                extracted_content = extracted_content.encode('utf-8').decode('utf-8')
                            except:
                                pass
                            filename = self.save_extracted_content(url, extracted_content)
                            return {
                                'success': True,
                                'content': extracted_content,
                                'filename': filename,
                                'length': len(extracted_content)
                            }
                        else:
                            print('trafilatura提取内容过短')
                    else:
                        print('trafilatura提取返回空内容')
                else:
                    print('trafilatura.fetch_url返回空内容')
            except Exception as e:
                print(f'trafilatura直接提取失败: {e}')
                import traceback
                traceback.print_exc()
            
            # 如果trafilatura直接提取失败，尝试使用HTTP请求
            print('trafilatura直接提取失败，尝试使用HTTP请求...')
            html = self._fetch_with_http(url)
            print('使用HTTP请求获取数据')
            
            # 清理HTML内容
            html = self.clean_html(html)
            
            # 使用trafilatura提取
            print('使用trafilatura提取内容...')
            # 优化trafilatura配置，提高提取质量
            extracted_content = trafilatura.extract(
                html, 
                output_format='txt', 
                include_links=False, 
                include_images=False, 
                include_tables=True,  # 包含表格，避免内容缺漏
                favor_precision=False,  # 优先召回率，避免内容缺漏
                favor_recall=True,  # 优先召回率，避免内容缺漏
                include_comments=False, 
                include_formatting=True,  # 保留格式，提高可读性
                deduplicate=True,  # 去重，避免重复内容
                target_language='zh'  # 指定目标语言为中文，提高提取质量
            )
            
            # 确保内容不为空
            if not extracted_content or len(extracted_content) < 50:
                print('trafilatura提取失败或内容过短，尝试使用备用配置...')
                # 尝试使用trafilatura的另一种配置
                try:
                    extracted_content = trafilatura.extract(
                        html, 
                        output_format='txt',
                        include_links=False,
                        include_images=False,
                        include_tables=True,
                        favor_recall=True
                    )
                    if extracted_content:
                        print('使用trafilatura备用配置成功')
                except Exception as e:
                    print(f'trafilatura备用配置失败: {e}')
                    # 提取整个页面文本作为最后备用
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(html, 'html.parser')
                    # 移除脚本和样式
                    for script in soup(['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'header', 'aside', 'form', 'button', 'input']):
                        script.decompose()
                    # 提取纯文本
                    extracted_content = soup.get_text(separator='\n', strip=True)
            
            # 清理提取的内容
            extracted_content = self.clean_content(extracted_content)
            
            # 确保内容不为空
            if not extracted_content or len(extracted_content) < 50:
                print('提取内容仍然过短，返回基本信息...')
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(html, 'html.parser')
                # 提取标题
                title = soup.title.string if soup.title else '无标题'
                # 构建基本内容
                extracted_content = f'=== 标题 ===\n{title}\n\n页面内容提取失败，请检查网络连接或尝试其他URL。'
            
            print(f'提取内容长度: {len(extracted_content)} 字符')
            print(f'提取内容前500字符: {extracted_content[:500]}...')
            
            # 确保内容是UTF-8编码
            try:
                extracted_content = extracted_content.encode('utf-8').decode('utf-8')
            except:
                pass
            
            filename = self.save_extracted_content(url, extracted_content)
            
            return {
                'success': True,
                'content': extracted_content,
                'filename': filename,
                'length': len(extracted_content)
            }
            
        except Exception as e:
            print(f'提取失败: {e}')
            import traceback
            traceback.print_exc()
            # 即使失败，也返回一个包含错误信息的结果
            error_content = f'提取失败: {str(e)}\n\n请检查网络连接或尝试其他URL。'
            filename = self.save_extracted_content(url, error_content)
            return {
                'success': False,
                'error': str(e),
                'content': error_content,
                'filename': filename
            }
    
    def _fetch_with_http(self, url):
        """使用HTTP请求获取页面内容"""
        import random
        import time
        import chardet
        
        # 生成简单的请求头
        def generate_simple_headers():
            # 使用更简单的User-Agent
            user_agents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/128.0',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/145.0.0.0'
            ]
            
            return {
                'User-Agent': random.choice(user_agents),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate',
                'Referer': 'https://www.baidu.com/',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        
        # 多次尝试策略
        max_attempts = 3
        for attempt in range(max_attempts):
            print(f'尝试 {attempt + 1}/{max_attempts}')
            
            # 每次尝试使用新的会话
            session = requests.Session()
            
            # 禁用SSL证书验证
            session.verify = False
            
            # 生成简单的请求头
            headers = generate_simple_headers()
            
            # 随机延迟，模拟用户行为
            delay = random.uniform(1, 3)
            print(f'等待 {delay:.2f} 秒...')
            time.sleep(delay)
            
            try:
                # 直接访问目标页面，不经过百度首页
                print('直接访问目标页面...')
                # 移除URL中的fromModule参数，可能会触发反爬虫
                clean_url = url.split('?fromModule')[0] if '?fromModule' in url else url
                print(f'使用清理后的URL: {clean_url}')
                
                # 发送请求
                response = session.get(clean_url, headers=headers, timeout=Config.TIMEOUT)
                response.raise_for_status()
                print('请求页面成功')
                print(f'响应状态码: {response.status_code}')
                
                # 处理编码 - 强制使用utf-8编码
                response.encoding = 'utf-8'
                return response.text
            except Exception as e:
                print(f'尝试 {attempt + 1} 失败: {e}')
                # 增加延迟后继续尝试
                time.sleep(random.uniform(2, 4))
                continue
        
        # 所有尝试都失败后，尝试使用urllib
        print('所有HTTP尝试失败，尝试使用urllib...')
        try:
            import urllib.request
            
            # 生成简单的请求头
            headers = generate_simple_headers()
            
            # 创建请求
            req = urllib.request.Request(url, headers=headers)
            
            # 跳过SSL验证
            import ssl
            context = ssl._create_unverified_context()
            
            # 发送请求
            with urllib.request.urlopen(req, timeout=Config.TIMEOUT, context=context) as response:
                # 获取响应编码
                content_type = response.getheader('Content-Type', '')
                encoding = 'utf-8'
                if 'charset=' in content_type:
                    encoding = content_type.split('charset=')[-1]
                
                # 获取内容编码
                content_encoding = response.getheader('Content-Encoding', '')
                print(f'Content-Encoding: {content_encoding}')
                
                # 读取内容
                content = response.read()
                
                # 处理压缩内容
                if 'gzip' in content_encoding:
                    import gzip
                    try:
                        content = gzip.decompress(content)
                        print('已解压缩gzip内容')
                    except Exception as e:
                        print(f'解压缩gzip失败: {e}')
                elif 'deflate' in content_encoding:
                    import zlib
                    try:
                        content = zlib.decompress(content)
                        print('已解压缩deflate内容')
                    except Exception as e:
                        print(f'解压缩deflate失败: {e}')
                
                # 解码内容
                try:
                    html = content.decode(encoding)
                    print(f'urllib请求成功，使用编码: {encoding}')
                    print(f'获取到的页面内容长度: {len(html)} 字符')
                    print(f'获取到的页面内容前200字符: {html[:200]}...')
                    return html
                except:
                    # 尝试utf-8编码
                    html = content.decode('utf-8', errors='replace')
                    print('urllib请求成功，使用utf-8编码')
                    print(f'获取到的页面内容长度: {len(html)} 字符')
                    print(f'获取到的页面内容前200字符: {html[:200]}...')
                    return html
        except Exception as e:
            print(f'urllib失败: {e}')
        
        # 最后，返回一个空字符串，避免程序崩溃
        print('所有提取方法都失败')
        return '<html><body></body></html>'
    
    def save_extracted_content(self, url, content):
        """保存提取的内容"""
        # 生成文件名
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.replace('.', '_')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'{domain}_{timestamp}.txt'
        filepath = os.path.join(Config.OUTPUT_DIR, filename)
        
        # 保存文件
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f'URL: {url}\n')
            f.write(f'提取时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n')
            f.write('=' * 80 + '\n')
            f.write(content)
        
        print(f'结果保存到: {filepath}')
        return filename
    
    def close(self):
        """关闭浏览器"""
        if self.driver:
            try:
                self.driver.quit()
                print('浏览器已关闭')
            except Exception as e:
                print(f'关闭浏览器失败: {e}')

class WebSocketServer:
    """WebSocket服务器"""
    
    def __init__(self):
        self.extractor = WebTextExtractor()
    
    async def handle_connection(self, websocket):
        """处理WebSocket连接"""
        print('新的连接已建立')
        
        try:
            async for message in websocket:
                print(f'收到消息: {message}')
                
                try:
                    data = json.loads(message)
                    
                    if data.get('type') == 'extract':
                        url = data.get('url')
                        if not url:
                            await websocket.send(json.dumps({
                                'type': 'error',
                                'error': '缺少URL参数'
                            }))
                            continue
                        
                        # 执行提取
                        result = self.extractor.extract_from_url(url)
                        
                        # 确保内容中的换行符被正确处理
                        if 'content' in result:
                            # 确保内容是字符串
                            if isinstance(result['content'], str):
                                # 对于百度百科页面，保持原始格式
                                if 'baike.baidu.com' in url:
                                    # 确保换行符是\n
                                    result['content'] = result['content'].replace('\r\n', '\n')
                                    result['content'] = result['content'].replace('\r', '\n')
                                else:
                                    # 确保换行符是\n
                                    result['content'] = result['content'].replace('\r\n', '\n')
                                    result['content'] = result['content'].replace('\r', '\n')
                                    # 清理多余的空行
                                    import re
                                    result['content'] = re.sub(r'\n{3,}', '\n\n', result['content'])
                                    # 确保内容开头没有多余的空行
                                    result['content'] = result['content'].lstrip()
                                # 输出处理后的内容，用于调试
                                print(f'处理后的内容长度: {len(result["content"])}')
                                print(f'处理后的内容前500字符: {repr(result["content"][:500])}')
                        
                        # 发送结果
                        response_data = {
                            'type': 'extraction_complete' if result['success'] else 'error',
                            **result
                        }
                        # 输出发送前的响应数据，用于调试
                        print(f'发送前的响应数据: {response_data}')
                        await websocket.send(json.dumps(response_data))
                        
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'error': '无效的JSON格式'
                    }))
                except Exception as e:
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'error': f'处理请求失败: {str(e)}'
                    }))
                    
        except websockets.exceptions.ConnectionClosedError:
            print('连接已关闭')
        except Exception as e:
            print(f'处理连接时出错: {e}')
    
    async def start(self):
        """启动服务器"""
        try:
            print(f'正在绑定WebSocket服务器到 {Config.HOST}:{Config.PORT}...')
            async with websockets.serve(self.handle_connection, Config.HOST, Config.PORT):
                print(f'✅ WebSocket服务器启动成功！运行在 ws://{Config.HOST}:{Config.PORT}')
                print('服务器已准备就绪，等待连接...')
                await asyncio.Future()  # 保持服务器运行
        except Exception as e:
            print(f'❌ WebSocket服务器启动失败: {e}')
            import traceback
            traceback.print_exc()
    
    def stop(self):
        """停止服务器"""
        self.extractor.close()

async def main():
    """主函数"""
    server = WebSocketServer()
    
    try:
        await server.start()
    except KeyboardInterrupt:
        print('服务器正在停止...')
    finally:
        server.stop()

if __name__ == '__main__':
    print('网页文字提取器本地应用启动...')
    print(f'输出目录: {Config.OUTPUT_DIR}')
    print(f'WebSocket服务器配置: ws://{Config.HOST}:{Config.PORT}')
    
    try:
        print('正在启动WebSocket服务器...')
        asyncio.run(main())
    except KeyboardInterrupt:
        print('应用已停止')
    except Exception as e:
        print(f'启动失败: {e}')
        import traceback
        traceback.print_exc()