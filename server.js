// server.js - 你原有的百度AI服务器 + 新增树莓派WebSocket中转

const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');          // 新增
const http = require('http');              // 新增（为了同时支持HTTP和WebSocket）
const config = require('./config');
const path = require('path');

const app = express();

// ===== 你原有的中间件设置（完全不动） =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 跨域支持（你本来就设了 *，完美）
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===== 你原有的百度AI相关代码（完全不动） =====
let accessToken = 'Bearer BAIDU_API_KEY';
let tokenExpiry = Date.now();

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }
  if (!config.apiKey) {
    throw new Error('百度AI API密钥未配置，请检查环境变量');
  }
  try {
    console.log('正在获取百度AI API访问令牌...');
    const response = await axios.get(`http://120.48.71.34:18789/token`, {
      params: {
        grant_type: 'client_credentials',
        client_id: config.apiKey,
      }
    });
    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (29 * 24 * 60 * 60 * 1000);
    console.log('✅ 成功获取百度AI API访问令牌');
    return accessToken;
  } catch (error) {
    console.error('❌ 获取百度AI API访问令牌失败:', error.response?.data || error.message);
    throw new Error('获取百度AI API访问令牌失败');
  }
}

async function callBaiduAI(endpoint, params, method = 'GET', data = null) {
  try {
    const token = await getAccessToken();
    const url = `${config.baseUrl}${endpoint}?access_token=${token}`;
    const options = {
      url,
      method,
      params: method === 'GET' ? params : undefined,
      data: method === 'POST' ? (data || params) : undefined,
      headers: {
        'Content-Type': method === 'POST' ? 'application/x-www-form-urlencoded' : 'application/json'
      }
    };
    console.log(`📡 调用百度AI API: ${method} ${endpoint}`);
    const response = await axios(options);
    console.log(`✅ 百度AI API调用成功: ${method} ${endpoint}`);
    return response.data;
  } catch (error) {
    console.error(`❌ 百度AI API调用失败: ${method} ${endpoint}`, error.response?.data || error.message);
    throw error;
  }
}

// 你原有的所有API接口（完全不动）
app.post('/chat', async (req, res) => {
  try {
    const { message, language_type, detect_direction, detect_language, vertexes_location, probability } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: '缺少必要参数：image' });
    }
    const result = await callBaiduAI(config.services.nlp, {
      message,
      language_type: language_type || 'CHN_ENG',
      detect_direction: detect_direction || 'false',
      detect_language: detect_language || 'false',
      vertexes_location: vertexes_location || 'false',
      probability: probability || 'false'
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { tex, lan, spd, pit, vol, per, aue } = req.body;
    if (!tex) {
      return res.status(400).json({ success: false, error: '缺少必要参数：tex' });
    }
    const result = await callBaiduAI(config.services.tts, {
      tex,
      lan: lan || 'zh',
      spd: spd || '5',
      pit: pit || '5',
      vol: vol || '5',
      per: per || '0',
      aue: aue || '3'
    }, 'GET');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: '缺少必要参数：text' });
    }
    const result = await callBaiduAI(config.services.nlp+'/sentiment-classify', {
      message
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/image-classify/advanced_general', async (req, res) => {
  try {
    const { image, baike_num } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: '缺少必要参数：image' });
    }
    const result = await callBaiduAI(config.services.imageClassify + '/advanced_general', {
      image,
      baike_num: baike_num || '0'
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '百度AI服务器运行正常' });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '百度AI服务器运行正常' });
});

app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    message: '百度AI服务器',
    version: '1.0.0',
    services: Object.keys(config.services),
    env: process.env.NODE_ENV || 'development'
  });
});

// ===== ✨ 新增：WebSocket 树莓派中转（在你原有代码后面加） =====

// 创建 HTTP 服务器（兼容原有 express）
const server = http.createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 存储所有在线的树莓派
const raspberryDevices = new Map();  // key: 设备ID, value: WebSocket连接

wss.on('connection', (ws) => {
  console.log(`🌲 新树莓派连接，当前在线: ${raspberryDevices.size + 1}`);
  
  // 给这个连接分配一个临时ID（等树莓派发注册消息再替换）
  let deviceId = null;
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      console.log('📨 收到树莓派消息:', msg);
      
      // 处理注册
      if (msg.type === 'register') {
        deviceId = msg.deviceId || `dino-${Date.now()}`;
        raspberryDevices.set(deviceId, ws);
        console.log(`✅ 树莓派注册成功: ${deviceId}`);
        ws.send(JSON.stringify({ 
          type: 'registered', 
          deviceId: deviceId,
          status: 'ok'
        }));
      }
      
      // 处理心跳
      if (msg.type === 'heartbeat') {
        // 可以不做任何事，知道设备在线就行
      }
      
    } catch (e) {
      console.error('❌ 解析树莓派消息失败:', e.message);
    }
  });
  
  ws.on('close', () => {
    if (deviceId) {
      raspberryDevices.delete(deviceId);
      console.log(`❌ 树莓派断开: ${deviceId}，剩余在线: ${raspberryDevices.size}`);
    }
  });
});

// 新增：给树莓派发指令的接口
app.post('/api/dino/command', express.json(), (req, res) => {
  const { deviceId, action, motor, duration } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ error: '缺少 deviceId' });
  }
  
  const device = raspberryDevices.get(deviceId);
  if (!device) {
    return res.status(404).json({ error: '设备不在线' });
  }
  
  try {
    device.send(JSON.stringify({ action, motor, duration }));
    res.json({ 
      success: true, 
      message: '指令已发送',
      deviceId: deviceId
    });
  } catch (e) {
    res.status(500).json({ error: '发送失败', detail: e.message });
  }
});

// 新增：查看所有在线树莓派
app.get('/api/dino/devices', (req, res) => {
  res.json({
    success: true,
    online: Array.from(raspberryDevices.keys()),
    count: raspberryDevices.size
  });
});

// 新增：广播给所有树莓派
app.post('/api/dino/broadcast', express.json(), (req, res) => {
  const { action, motor, duration } = req.body;
  let count = 0;
  
  raspberryDevices.forEach((ws) => {
    ws.send(JSON.stringify({ action, motor, duration }));
    count++;
  });
  
  res.json({
    success: true,
    message: `已广播给 ${count} 个设备`
  });
});

// ===== 原有的404和错误处理（放在最后） =====
app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error('全局错误:', err);
  res.status(500).json({ success: false, error: err.message || '服务器内部错误' });
});

// ===== 修改启动方式（用 server 而不是 app.listen） =====
const PORT = config.port || 3000;

server.listen(PORT, () => {
  console.log('\n🚀 百度AI服务器 + 树莓派中转站已启动');
  console.log(`📡 服务器地址: http://localhost:${PORT}`);
  console.log('🔧 环境:', process.env.NODE_ENV || 'development');
  
  console.log('\n📋 你原有的百度AI接口：');
  console.log('  GET  /health - 健康检查');
  console.log('  GET  /api/health - 健康检查');
  console.log('  GET  /api/info - 服务器信息');
  console.log('  POST /chat - 通用文字识别');
  console.log('  POST /api/tts - 语音合成');
  console.log('  POST /api - 情感分析');
  console.log('  POST /api/image-classify/advanced_general - 通用物体识别');
  
  console.log('\n🤖 新增的树莓派控制接口：');
  console.log(`  📡 WebSocket: wss://你的项目.railway.app （树莓派连这个）`);
  console.log('  POST /api/dino/command - 给指定树莓派发指令');
  console.log('  GET  /api/dino/devices - 查看在线树莓派');
  console.log('  POST /api/dino/broadcast - 广播给所有树莓派');
  
  console.log('\n⚠️  注意：');
  if (!config.apiKey) {
    console.log('  - 百度AI API密钥未配置');
  } else {
    console.log('  - 百度AI API密钥已配置');
  }
  console.log('  - 跨域已设为 *，所有接口都可访问');
  console.log('\n📝 日志将显示所有请求和树莓派消息\n');
});

// 优雅关闭（保持原有）
process.on('SIGINT', () => {
  console.log('\n📡 正在关闭服务器...');
  // 关闭所有树莓派连接
  raspberryDevices.forEach((ws) => {
    ws.close();
  });
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n📡 收到终止信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});
 
  
