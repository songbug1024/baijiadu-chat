var request = require('request');

var http_request = function (options, data, callback) {
  options = options || {};
  data = data || {};

  var method = options.method || 'GET';

  switch (method) {
    case 'GET':
    case 'get':
      options.qs = data;
      options.useQuerystring = true;
      break;
    case 'POST':
    case 'post':
    case 'PUT':
    case 'put':
    case 'PATCH':
    case 'patch':
      options.body = JSON.stringify(data);
      break;
  }

  request(options, callback);
}

var http_request_api = function (data, path, method, callback) {
  data = data || {};
  method = method || 'GET';

  var options = {
    url: 'http://www.baijiadu.com' + path,
    method: method,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    }
  };

  console.log('http_request_api', options, data);
  http_request(options, data, callback);
}

exports.pushWeChatMsg = function (data, callback) {
  if (!data) return callback(new Error('PushWeChatMsg data is invalid.'));
  var msg, content;

  if (data.contentType === 'text') {
    content = data.content;
    msg = data.senderName + ' 给你发送了一条消息：' + (content.length > 10 ? content.substring(0, 10) + '...' : content);
  } else if (data.contentType === 'picture') {
    msg = data.senderName + ' 给你发送了一张图片';
  }

  if (msg) {
    http_request_api({
      openid: data.userId,
      msg: msg
    }, '/WeiXinClientMsg/ChatSendMsg', 'GET', callback || function () {});
  }
}