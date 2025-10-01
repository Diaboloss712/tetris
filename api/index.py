import sys
import os

# 서버 디렉토리를 Python 경로에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'server'))

from main import app

# Vercel serverless function handler
handler = app
