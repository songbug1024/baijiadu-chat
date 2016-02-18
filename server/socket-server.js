/**
 * @Description: Socket
 * @Author: fuwensong
 * @Date: 2015/6/4
 */
var Socket = {};
var loopback = require('loopback');
var _ = require('underscore');
var ChatService = require('./services/chat');
var ChatMessageService = require('./services/chat-message');
var config = require('./config.json');
var tuiSongService = require('./services/tuisong');

Socket.connect = function (socket) {
  console.log('Socket connect, socket is ' + socket.id);

  socket.on('login', Socket.login(socket));
  socket.on('relogin', Socket.relogin(socket));
  socket.on('new msg', Socket.publicMsg(socket));
  socket.on('delete msg', Socket.deleteMsg(socket));
  socket.on('forward msg', Socket.forwardMsg(socket));
  socket.on('disconnect', Socket.disconnect(socket));
//  socket.on('bind user', Socket.bindUser(socket));
//  socket.on('bind user msg', Socket.bindUserMsg(socket));
}

Socket.disconnect = function (socket) {
  return function (reason) {
    console.log('Socket disconnect, reason is ' + reason);

    /*
    if (socket.memberId) {
      ChatService.loadRelationOnlineMemberIds(socket.memberId, function (err, onlineMemberIds) {
        _.each(onlineMemberIds, function (onlineId) {
          var toSocket = __getSocketByMemberId(socket, onlineId);

          toSocket && toSocket.emit('member left', {
            id: socket.memberId,
            displayName: socket.displayName,
            avatar: socket.avatar
          });
        })
      })
      socket.userLogged = false;
    }
    */
  }
}

Socket.login = function (socket) {
  return function (data, callback) {
//    console.log('Socket send login request, data is ', data);

    callback = callback || function (err, data) {
      if (err) {
        console.error(err);
        return socket.emit('login err', err);
      }

      socket.emit('ready', data);
    }

    if (!data || !data.memberId) return callback(new Error('Login data is invalid.'));

    ChatService.login(data.memberId, function (err, member) {
      console.log('Socket.login', err);

      if (err) return callback(err);
      if (!member || !member.id) return callback(new Error('Login data is invalid.'));

      var memberId = member.id;
      memberId = _.isObject(memberId) ? memberId.toString() : memberId;

      var existedSocket = __getSocketByMemberId(socket, memberId);
      if (existedSocket) {
        console.log('User has logged at other place.');
        existedSocket.disconnect();
      }

      callback(null, {memberId: memberId});

      socket.memberId = _.isObject(memberId) ? memberId.toString() : memberId;
    });
  }
}

Socket.relogin = function (socket) {
  return function (data, callback) {
    callback = callback || function (err, data) {
      if (err) {
        console.error(err);
        return socket.emit('error', err);
      }

      socket.emit('relogin ready', data);
    }

    if (!data || !data.memberId) {
      return callback(new Error('Relogin data is invalid.'));
    }

    var memberId = data.memberId;
    socket.memberId = _.isObject(memberId) ? memberId.toString() : memberId;
  }
}

Socket.publicMsg = function (socket) {
  return function (msg, callback) {
//    console.log('Socket send publicMsg request, msg is ', msg);

    ChatMessageService.saveMessage(msg, function (err, msg) {
      console.log('Socket.publicMsg saveMessage', err);
      if (err) return callback(err);

      callback(null, msg);

      // broadcast receiver
      if (msg.receiverId) {
        var receiverSocket = __getSocketByMemberId(socket, msg.receiverId);
//        var bindingSocket = __getSocketByBindUserId(socket, msg.receiverId);

        if (receiverSocket) {
          receiverSocket.emit('new msg', msg);
        } else {
//          !bindingSocket && __handelMsg(msg);
          __handelMsg(msg);
        }

        //bind Msg
//        if (bindingSocket) {
//          bindingSocket.emit('bind user msg', 'noticeMsg');
//        }
      }
    });
  }
}

Socket.deleteMsg = function (socket) {
  return function (data, callback) {
//    console.log('Socket send deleteMsg request, data id is ', data);

    ChatMessageService.deleteMessage(data, function (err, data) {
      console.log('Socket.deleteMsg deleteMessage', err);
      if (err) return callback(err);

      callback(null, data);
    });
  }
}

Socket.forwardMsg = function (socket) {
  return function (data, callback) {
//    console.log('Socket send forwardMsg request, data id is ', data);

    ChatMessageService.forwardMessage(data, function (err, msg) {
      console.log('Socket.forwardMsg forwardMessage', err);
      if (err) return callback(err);

      callback(null, msg);

      // broadcast receiver
      if (msg.receiverId) {
        var receiverSocket = __getSocketByMemberId(socket, msg.receiverId);
//        var bindingSocket = __getSocketByBindUserId(socket, msg.receiverId);

        if (receiverSocket) {
          receiverSocket.emit('new msg', msg);
        } else {
//          !bindingSocket && __handelMsg(msg);
          __handelMsg(msg);
        }

        //bind Msg
//        if (bindingSocket) {
//          bindingSocket.emit('bind user msg', 'noticeMsg');
//        }
      }
    });
  }
}

/*
Socket.bindUser = function (socket) {
  return function (data, callback) {
    if (!data.userId) {
      return socket.disconnect();
    }

    ChatService.loadMemberIdByUserId(data.userId, function (err, member) {
      if (err) return callback(err);
      if (!member || !member.id) return callback && callback('user does not existed.');

      var memberId = member.id;
      memberId = _.isObject(memberId) ? memberId.toString() : memberId;
      callback && callback(null, memberId);

      socket.bindUserId = memberId;
    })
  }
}
*/

/*
Socket.bindUserMsg = function (socket) {
  return function (msg) {
    if (!msg) return;

    var bindingSocket = __getSocketByBindUserId(socket, socket.memberId);

    if (bindingSocket) {
      bindingSocket.emit('bind user msg', msg);
    }
  }
}
*/

function __getSocketByMemberId (socket, memberId) {
  memberId = _.isObject(memberId) ? memberId.toString() : memberId;
  return _.findWhere(_.values(socket.server.sockets.connected), {memberId: memberId});
}

/*
function __getSocketByBindUserId (socket, bindUserId) {
  bindUserId = _.isObject(bindUserId) ? bindUserId.toString() : bindUserId;
  return _.findWhere(_.values(socket.server.sockets.connected), {bindUserId: bindUserId});
}
*/

function __handelMsg (msg) {
  var ChatMember = loopback.getModel('ChatMember');

  ChatMember.findById(msg.receiverId, function (err, receiver) {
    if (err) return console.error('__handelMsg find receiver err, ', err);

    if (receiver) {
      tuiSongService.pushWeChatMsg({
        userId: receiver.userId,
        content: msg.content,
        senderName: msg.displayName,
        contentType: msg.contentType
      }, function () {
        console.log('pushWeChatMsg over, err is ', arguments[0]);
      });
    }
  });
}

module.exports = Socket;
