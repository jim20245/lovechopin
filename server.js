const express = require('express');
const axios = require('axios');
const config = require ('./config');
const path = require ('path');

const app = express();

// 中间件设置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// 跨域支持
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

// 存储访问令牌的变量
let accessToken = '';
let tokenExpiry = Date.now();

// 获取百度AI API访问令牌
async function getAccessToken() {
  // 检查令牌是否已过期
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  // 检查API密钥是否已配置
  if (!config.apiKey) {
    throw new Error('百度AI API密钥未配置，请检查环境变量');
  }

  try {
    console.log('正在获取百度AI API访问令牌...');
    const response = await axios.get(`${config.baseUrl}/oauth/2.0/token`, {
      params: {
        grant_type: 'client_credentials',
        client_id: config.apiKey,
        
      }
    });

    accessToken = response.data.access_token;
    // 令牌有效期通常为30天，我们设置为29天以确保安全
    tokenExpiry = Date.now() + (29 * 24 * 60 * 60 * 1000);
    
    console.log('✅ 成功获取百度AI API访问令牌');
    return accessToken;
  } catch (error) {
    console.error('❌ 获取百度AI API访问令牌失败:', error.response?.data || error.message);
    throw new Error('获取百度AI API访问令牌失败');
  }
}

// 通用的百度AI API调用函数
async function callBaiduAI(endpoint, params, method = 'POST', data = null) {
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

// 示例API接口：文本识别（通用文字识别）
app.post('/api/ocr/general_basic', async (req, res) => {
  try {
    const { image, language_type, detect_direction, detect_language, vertexes_location, probability } = req.body;
    
    // 验证必要参数
    if (!image) {
      return res.status(400).json({ success: false, error: '缺少必要参数：image' });
    }
    
    const result = await callBaiduAI(config.services.ocr + '/general_basic', {
      image,
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

// 示例API接口：语音合成
app.post('/api/tts', async (req, res) => {
  try {
    const { tex, lan, spd, pit, vol, per, aue } = req.body;
    
    // 验证必要参数
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

// 示例API接口：自然语言处理（情感分析）
app.post('/api/nlp/sentiment_classify', async (req, res) => {
  try {
    const { text } = req.body;
    
    // 验证必要参数
    if (!text) {
      return res.status(400).json({ success: false, error: '缺少必要参数：text' });
    }
    
    const result = await callBaiduAI(config.services.nlp + '/sentiment_classify', {
      text
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 示例API接口：图像识别（通用物体识别）
app.post('/api/image-classify/advanced_general', async (req, res) => {
  try {
    const { image, baike_num } = req.body;
    
    // 验证必要参数
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

// 健康检查接口（Railway需要此接口用于健康检查）
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '百度AI服务器运行正常' });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '百度AI服务器运行正常' });
});

// 服务器信息接口
app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    message: '百度AI服务器',
    version: '1.0.0',
    services: Object.keys(config.services),
    env: process.env.NODE_ENV || 'development'
  });
});


// 404错误处理
app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('全局错误:', err);
  res.status(500).json({ success: false, error: err.message || '服务器内部错误' });
});



// 启动服务器
const server = app.listen(config.port, () => {
  console.log('\n🚀 百度AI服务器已启动');
  console.log(`📡 服务器地址: http://localhost:${config.port}`);
  console.log('🔧 环境:', process.env.NODE_ENV || 'development');
  console.log('\n📋 可用接口：');
  console.log('  GET  /health - 健康检查（Railway使用）');
  console.log('  GET  /api/health - 健康检查');
  console.log('  GET  /api/info - 服务器信息');
  console.log('  POST /api/ocr/general_basic - 通用文字识别');
  console.log('  POST /api/tts - 语音合成');
  console.log('  POST /api/nlp/sentiment_classify - 情感分析');
  console.log('  POST /api/image-classify/advanced_general - 通用物体识别');
  console.log('\n⚠️  注意：');
  if (!config.apiKey) {
    console.log('  - 百度AI API密钥未配置，请在环境变量中设置BAIDU_API_KEY');
  } else {
    console.log('  - 百度AI API密钥已配置');
  }
  console.log('  - 更多API接口可以根据需要添加');
  console.log('\n📝 日志将显示API调用情况和错误信息\n');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n📡 正在关闭服务器...');
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
