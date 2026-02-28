// 统一响应格式
function success(data, message = 'success') {
  return {
    code: 0,
    message,
    data
  };
}

function error(message = 'error', code = 500) {
  return {
    code,
    message,
    data: null
  };
}

// 错误处理中间件
function errorHandler(err, req, res) {
  console.error('API Error:', err);
  
  if (err.code === 'PGRST301') {
    return res.status(401).json(error('Unauthorized', 401));
  }
  
  if (err.code === '23505') {
    return res.status(409).json(error('Data already exists', 409));
  }
  
  return res.status(500).json(error(err.message || 'Internal Server Error'));
}

module.exports = {
  success,
  error,
  errorHandler
};
