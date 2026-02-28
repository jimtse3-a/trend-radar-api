// 用户相关API
const supabase = require('../utils/supabase');
const { success, error } = require('../utils/response');

module.exports = async (req, res) => {
  const { method } = req;
  const path = req.url.split('?')[0];
  
  // POST /api/users/login - 用户登录
  if (method === 'POST' && path === '/api/users/login') {
    try {
      const { code } = req.body;
      
      // 这里需要调用微信登录接口获取openid
      // 简化处理，实际项目中需要调用微信 auth.code2Session 接口
      const openid = 'mock_openid_' + code;
      
      // 查询或创建用户
      let { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('openid', openid)
        .single();
      
      if (!user) {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([{
            openid,
            user_type: 'buyer'
          }])
          .select()
          .single();
        
        if (createError) throw createError;
        user = newUser;
      }
      
      // 生成token（简化处理）
      const token = 'mock_token_' + user.id;
      
      return res.status(200).json(success({
        user,
        token
      }));
    } catch (err) {
      throw err;
    }
  }
  
  return res.status(404).json(error('Not found', 404));
};
