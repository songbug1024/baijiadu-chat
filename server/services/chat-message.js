/**
 * @Description:
 * @Author: fuwensong
 * @Date: 2015/6/6
 */
var async = require('async');
var loopback = require('loopback');
var config = require('../config.json');
var Service = {};

Service.saveMessage = function (msg, callback) {
  var ChatMessage = loopback.getModel('ChatMessage');
  var ChatMember = loopback.getModel('ChatMember');
  var ChatMemberRel = loopback.getModel('ChatMemberRel');

  // TODO verify
  ChatMessage.create(msg, function (err, msg) {
    if (err) return callback(err);

    callback(null, msg);

    async.auto({
      loadSenderRel: function (callback) {
        ChatMemberRel.findOne({
          where: {
            memberId: msg.senderId,
            friendId: msg.receiverId
          }
        }, callback);
      },
      updateSenderRel: ['loadSenderRel', function (callback, results) {
        var senderRel = results.loadSenderRel;

        if (senderRel && senderRel.id) {
          senderRel.updateAttributes({
            lastMsgId: msg.id
          }, callback);
        } else {
          ChatMemberRel.create({
            memberId: msg.senderId,
            friendId: msg.receiverId,
            lastMsgId: msg.id
          }, callback);
        }
      }],
      prepareReceiverRel: function (callback) {
        ChatMemberRel.findOrCreate({
          where: {
            memberId: msg.receiverId,
            friendId: msg.senderId
          }
        }, {
          memberId: msg.receiverId,
          friendId: msg.senderId
        }, callback);
      }
    }, function (err, results) {
      console.log('update member rel: ', err);
    });
  });
}

Service.deleteMessage = function (data, callback) {
  if (!data || !data.msgId || !data.userId) return callback(new Error('DeleteMessage userId is invalid.'));
  var msgId = data.msgId;
  var userId = data.userId;
  var ChatMessage = loopback.getModel('ChatMessage');
  var ChatMemberRel = loopback.getModel('ChatMemberRel');

  async.auto({
    verifyMsg: function (callback) {
      ChatMessage.findById(msgId, function (err, msg) {
        if (err) return callback(err);
        if (!msg || !msg.id) return callback(new Error('msg does not existed.'));
        if ((msg.senderId == userId && msg.status === ChatMessage.allStatus.senderDeleted)
          || (msg.receiverId == userId && msg.status === ChatMessage.allStatus.receiverDeleted)
          || msg.status === ChatMessage.allStatus.bothDeleted)
          return callback(new Error('msg has been deleted.'));

        callback(null, msg);
      });
    },
    doDelete: ['verifyMsg', function (callback, results) {
      var msg = results.verifyMsg;
      var status = msg.status;
      var isReceiver = msg.receiverId == userId;

      if (isReceiver) {
        status = status === ChatMessage.allStatus.senderDeleted
          ? ChatMessage.allStatus.bothDeleted
          : ChatMessage.allStatus.receiverDeleted;
      } else {
        status = status === ChatMessage.allStatus.receiverDeleted
          ? ChatMessage.allStatus.bothDeleted
          : ChatMessage.allStatus.senderDeleted;
      }
      msg.updateAttributes({
        status: status,
        modified: Date.now()
      }, function (err, msg) {
        if (err) return callback(err);

        callback(null, msg);
      });
    }],
    loadPrevMsg: ['doDelete', function (callback, results) {
      var msg = results.doDelete;
      var senderId = msg.senderId;
      var receiverId = msg.receiverId;

      ChatMessage.findOne({
        order: 'id DESC',
        where: {
          and: [
            {
              or: [
                {
                  and: [{senderId: senderId}, {receiverId: receiverId}]
                },
                {
                  and: [{senderId: receiverId}, {receiverId: senderId}]
                }
              ]
            },
            {
              or: [
                {
                  status: ChatMessage.allStatus.normal
                },
                {
                  and: [{senderId: {neq: senderId}}, {status: ChatMessage.allStatus.senderDeleted}]
                },
                {
                  and: [{receiverId: {neq: senderId}}, {status: ChatMessage.allStatus.receiverDeleted}]
                }
              ]
            }
          ],
          id: {lt: msg.id}
        }
      }, callback)
    }],
    loadSenderRel: ['doDelete', function (callback, results) {
      var msg = results.doDelete;
      var isReceiver = msg.receiverId == userId;

      ChatMemberRel.findOne({
        where: {
          memberId: isReceiver ? msg.receiverId : msg.senderId,
          friendId: isReceiver ? msg.senderId : msg.receiverId
        }
      }, callback);
    }],
    updateSenderRel: ['doDelete', 'loadSenderRel', 'loadPrevMsg', function (callback, results) {
      var msg = results.doDelete;
      var isReceiver = msg.receiverId == userId;
      var senderRel = results.loadSenderRel;
      var prevMsg = results.loadPrevMsg;

      if (senderRel && senderRel.id) {
        senderRel.updateAttributes({
          lastMsgId: prevMsg && prevMsg.id
        }, callback);
      } else {
        ChatMemberRel.create({
          memberId: isReceiver ? msg.receiverId : msg.senderId,
          friendId: isReceiver ? msg.senderId : msg.receiverId,
          lastMsgId: prevMsg && prevMsg.id
        }, callback);
      }
    }]
  }, function (err, results) {
    if (err) return callback(err);

    callback(null,  {
//      msg: results.doDelete,
      lastMsg: results.loadPrevMsg
    });
  })
}

Service.forwardMessage = function (data, callback) {
  data = data || {};
  var msgId = data.msgId;
  var senderId = data.senderId;
  var receiverId = data.receiverId;
  if (!msgId || !senderId || !receiverId) return callback(new Error('ForwardMessage data is invalid.'));

  var ChatMessage = loopback.getModel('ChatMessage');
  var ChatMember = loopback.getModel('ChatMember');
  var ChatMemberRel = loopback.getModel('ChatMemberRel');

  async.auto({
    loadMsg: function (callback) {
      ChatMessage.findById(msgId, callback);
    },
    loadSender: function (callback) {
      ChatMember.findById(senderId, callback);
    },
    loadReceiver: function (callback) {
      ChatMember.findById(receiverId, callback);
    },
    doForward: ['loadMsg', 'loadSender', 'loadReceiver', function (callback, results) {
      var msg = results.loadMsg;
      var sender = results.loadSender;
      var receiver = results.loadReceiver;

      if (!msg || !sender || !receiver) return callback(new Error('ForwardMessage data is invalid.'));

      var newMsg = {
        displayName: sender.displayName,
        avatar: sender.avatar,
        roleName: sender.roleName,
        senderId: sender.id,
        receiverId: receiver.id,
        content: msg.content,
        contentType: msg.contentType
      }

      ChatMessage.create(newMsg, function (err, msg) {
        if (err) return callback(err);

        callback(null, msg);

        async.auto({
          loadSenderRel: function (callback) {
            ChatMemberRel.findOne({
              where: {
                memberId: msg.senderId,
                friendId: msg.receiverId
              }
            }, callback);
          },
          updateSenderRel: ['loadSenderRel', function (callback, results) {
            var senderRel = results.loadSenderRel;

            if (senderRel && senderRel.id) {
              senderRel.updateAttributes({
                lastMsgId: msg.id
              }, callback);
            } else {
              ChatMemberRel.create({
                memberId: msg.senderId,
                friendId: msg.receiverId,
                lastMsgId: msg.id
              }, callback);
            }
          }],
          prepareReceiverRel: function (callback) {
            ChatMemberRel.findOrCreate({
              where: {
                memberId: msg.receiverId,
                friendId: msg.senderId
              }
            }, {
              memberId: msg.receiverId,
              friendId: msg.senderId
            }, callback);
          }
        }, function (err, results) {
          console.log('update member rel: ', err);
        });
      });
    }]
  }, function (err, results) {
    if (err) return callback(err);

    callback(null, results.doForward);
  })
}

module.exports = Service;