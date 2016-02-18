/**
 * @Description:
 * @Author: fuwensong
 * @Date: 2015/6/6
 */
var loopback = require('loopback');
var async = require('async');
var _ = require('underscore');
var config = require('../config.json');
var Service = {};

Service.login = function (memberId, callback) {
  if (!memberId) return callback(new Error('Login memberId is invalid.'));
  var ChatMember = loopback.getModel('ChatMember');

  async.auto({
    loadMember: function (callback) {
      ChatMember.findById(memberId, callback);
    }
  }, function (err, results) {
    if (err) return callback(err);

    callback(null, results.loadMember);
  })
}

Service.loadRelationOnlineMemberIds = function (memberId, callback) {
  if (!memberId) return callback(new Error('loadRelationOnlineMemberIds memberId is invalid.'));

  var ChatRecord = loopback.getModel('ChatRecord');
  var ChatMember = loopback.getModel('ChatMember');
  var allStatus = ChatMember.allStatus;

  ChatRecord.find({
    fields: {
      receiverId: true
    },
    where: {
      senderId: memberId
    },
    include: {
      relation: 'receiver',
      scope: {
        where: {
          status: {
            inq: [allStatus.online, allStatus.busy, allStatus.leave, allStatus.invisible]
          }
        }
      }
    }
  }, function (err, records) {
    if (err) return callback(err);

    callback(null, _.map(records, function (record) {return record.receiverId;}));
  })
}

Service.loadMemberIdByUserId = function (userId, callback) {
  if (!userId) return callback(new Error('loadMemberIdByUserId userId is invalid.'));

  var ChatMember = loopback.getModel('ChatMember');

  ChatMember.findOne({
    where: {
      userId: userId
    }
  }, callback);
}

module.exports = Service;
