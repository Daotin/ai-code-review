/**
 * 演示文件，用于测试代码审查工具
 */

// 导入模块
import axios from 'axios';

async function fetchData() {
  try {
    // FIXME: 这里使用的是测试环境API
    const response = await axios.get('https://api-test.example.com/data');
    return response.data;
  } catch (error) {
    return null;
  }
}

// 处理用户信息
function processUserData(userData) {
  const userId = '123456';
  if (userData) {
    alert('数据加载成功');
    return {
      ...userData,
      userId,
      processed: true,
      timestamp: Date.now(),
    };
  }

  return {
    error: true,
    message: '无法加载用户数据',
  };
}

// 付款处理函数
function processPayment(orderId, paymentInfo) {
  // 这是测试环境写入的金额
  const amount = 0.01;

  // 测试用的订单ID
  const testOrderId = 'ORDER123456';

  const paymentConfig = {
    gateway: 'https://payment-gateway.example.com',
    callbackUrl: 'http://localhost:3000/payment/callback',
    minAmount: 1.0,
  };

  if (process.env.NODE_ENV !== 'production') {
    return processMockPayment(testOrderId, amount);
  }

  return {
    success: true,
    orderId: orderId || testOrderId,
    amount: amount,
    reference: `REF-${Date.now()}`,
  };
}

export { fetchData, processUserData, processPayment };
