// 百度AI API配置文件
// 优先从环境变量读取配置，适用于Railway部署
// 注意：不要将敏感信息直接硬编码在此文件中

require('dotenv').config();

module.exports = {
  // 百度AI开放平台控制台中的API Key
  apiKey: process.env.BAIDU_API_KEY || '',
  
  
  
  
  // 百度AI API的基础URL
  baseUrl: 'https://qianfan.baidubce.com/v2/chat/completions',
  
  // 服务器端口（Railway会自动设置PORT环境变量）
  port: process.env.PORT || 3000,
  
  // 支持的AI服务列表
  services: {
    // 文本识别
    ocr: '/rest/2.0/ocr/v1',
    // 语音识别
    asr: '/pro-api/v1/asr',
    // 语音合成
    tts: '/rest/2.0/tts/v1',
    // 自然语言处理
    nlp: '/rpc/2.0/nlp/v1',
    // 图像识别
    imageClassify: '/rest/2.0/image-classify/v1'
  }
};

// 使用说明：
// 1. 访问百度AI开放平台 (https://ai.baidu.com/) 注册账号
// 2. 创建应用并获取API Key和Secret Key
// 3. 在本地开发时：复制.env.example为.env并填入密钥
// 4. 在Railway部署时：在环境变量设置中配置以下变量：
//    - BAIDU_API_KEY: 您的百度AI API Key
//    - BAIDU_SECRET_KEY: 您的百度AI Secret Key
//    - PORT: Railway会自动分配端口，无需手动设置

// 5. 根据需要启用或禁用不同的AI服务













