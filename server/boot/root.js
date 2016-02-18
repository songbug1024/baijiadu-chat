var loopback = require('loopback');
var _ = require('underscore');
var async = require('async');
var path = require('path');
var fs = require('fs');
var multiparty = require('multiparty');
var gm = require('gm').subClass({imageMagick: true});
var config = require('../config.json');

module.exports = function(server) {
  var router = server.loopback.Router();

  /*
  router.get('/select-user', function(req, res) {
    var users = [{
      openid: 'aaaaaa',
      username: '用户1',
      avatar: 'http://58.221.58.153:81/upload/icon/1_1399532627.png'
    }, {
      openid: 'bbbbbb',
      username: '用户2',
      avatar: 'http://58.221.58.153:81/upload/icon/2_1399532734.png'
    }, {
      openid: 'cccccc',
      username: '用户3',
      avatar: 'http://58.221.58.153:81/upload/icon/3_1399532850.png'
    }, {
      openid: 'dddddd',
      username: '用户4',
      avatar: 'http://58.221.58.153:81/upload/icon/3_1399532850.png'
    }];

    res.render('chat/select-user', {users: users});
  });
  */

  router.get('/chat/my', function(req, res) {
    var seller = req.query.seller;
    if (!seller) return res.json({error: '参数错误'});

    seller = JSON.parse(decodeURIComponent(seller));
    if (seller && seller.openid && seller.username) {
      var ChatMember = loopback.getModel('ChatMember');

      ChatMember.findOrCreate({
        where: {
          userId: seller.openid
        }
      }, {
        userId: seller.openid,
        displayName: seller.username,
        avatar: seller.avatar
      }, function (err, results) {
        if (err) return res.json({error: '内部错误，请稍后再试'});

        res.render('chat/index', {
          member: results.id ? results : results[0]
        });
      });
    } else {
      res.json({error: '参数错误'});
    }
  });

  router.get('/chat/to', function(req, res) {
    var consumer = req.query.consumer;
    var seller = req.query.seller;
    if (!seller || !consumer) return res.json({error: '参数错误'});

    seller = JSON.parse(decodeURIComponent(seller));
    consumer = JSON.parse(decodeURIComponent(consumer));
    if (seller && consumer) {
      var ChatMember = loopback.getModel('ChatMember');
      var ChatMemberRel = loopback.getModel('ChatMemberRel');

      async.auto({
        prepareConsumer: function (callback) {
          ChatMember.findOrCreate({
            where: {
              userId: consumer.openid
            }
          }, {
            userId: consumer.openid,
            displayName: consumer.username,
            avatar: seller.avatar
          }, callback);
        },
        prepareSeller: function (callback) {
          ChatMember.findOrCreate({
            where: {
              userId: seller.openid
            }
          }, {
            userId: seller.openid,
            displayName: seller.username,
            avatar: seller.avatar
          }, callback);
        },
        prepareConsumerRel: ['prepareConsumer', 'prepareSeller', function (callback, results) {
          var member = results.prepareConsumer;
          var seller = results.prepareSeller;

          if (member && seller) {
            member = member.id ? member : member[0];
            seller = seller.id ? seller : seller[0];

            ChatMemberRel.findOrCreate({
              where: {
                memberId: member.id,
                friendId: seller.id
              }
            }, {
              memberId: member.id,
              friendId: seller.id
            }, callback);
          } else {
            callback('member or seller is invalid.');
          }
        }],
        prepareSellerRel: ['prepareConsumer', 'prepareSeller', function (callback, results) {
          var member = results.prepareConsumer;
          var seller = results.prepareSeller;

          if (member && seller) {
            member = member.id ? member : member[0];
            seller = seller.id ? seller : seller[0];

            ChatMemberRel.findOrCreate({
              where: {
                memberId: seller.id,
                friendId: member.id
              }
            }, {
              memberId: seller.id,
              friendId: member.id
            }, callback);
          } else {
            callback('member or seller is invalid.');
          }
        }]
      }, function (err, results) {
        if (err) return res.json({error: '内部错误，请稍后再试'});

        var member = results.prepareConsumer;
        var seller = results.prepareSeller;
        member = member.id ? member : member[0];
        seller = seller.id ? seller : seller[0];

        res.render('chat/index', {
          member: member,
          to: seller
        });
      });
    } else {
      res.json({error: '参数错误'});
    }
  });

  router.get('/records', function(req, res) {
    res.render('chat/index', {initRoute: 'records'});
  });

  router.get('/chat-to/:to', function(req, res) {
    res.render('chat/index', {initRoute: 'chat-to/' + req.params['to']});
  });

  router.get('/chat-to/:to/:opts', function(req, res) {
    res.render('chat/index', {initRoute: 'chat-to/' + req.params['to'] + '/' + req.params['opts']});
  });

  router.get('/member-info/:id', function(req, res) {
    res.render('chat/index', {initRoute: 'member-info/' + req.params['id']});
  });

  router.post('/upload-image', function (req, res, next) {
    var uploadDir = path.join(__dirname, '../../uploads/');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    var now = new Date();
    uploadDir += '' + now.getFullYear() + (now.getMonth() + 1) + now.getDate();

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    var form = new multiparty.Form({uploadDir: uploadDir});
    form.parse(req, function(err, fields, files) {
      if (err) {
        return next(err);
      }
      req.files = files;
      req.fields = fields;
      next();
    });
  }, function(req, res) {
    var files = req.files;
    var results = {};
    var tasks = [];

    _.mapObject(files, function (val, name) {
      results[name] = [];
      _.map(val, function (file) {
        var url = file.path;
        var size = file.size;

        tasks.push(function (callback) {
          var lastIndex = url.lastIndexOf('\\');
          lastIndex === -1 && (lastIndex = url.lastIndexOf('/'));

          if (lastIndex === -1) {
            return callback(new Error('Invalid path.'));
          }

          var dir = url.substr(0, lastIndex + 1);
          var fileName = url.substr(lastIndex + 1, url.length - 1);
          var _dir = dir + '/yasuo/';
          var _url = _dir + fileName;

          if (!fs.existsSync(_dir)) {
            fs.mkdirSync(_dir);
          }
          gm(url)
            .resize(240, 240)     //设置压缩后的w/h
            .setFormat('JPEG')
            .quality(80)       //设置压缩质量: 0-100
            .strip()
            .autoOrient()
            .write(_url, function(err) {
              if (err) {
                return callback(err);
              }
              gm(_url).size(function (err, box) {
                if (err) {
                  return callback(err);
                }
                callback(null, results[name].push({
                  width: box.width,
                  height: box.height,
                  normal: '/uploads' + url.split('uploads')[1],
                  yasuo: '/uploads' + _url.split('uploads')[1],
                  size: size
                }))
              });
            })
        });
      });
    });

    async.parallelLimit(tasks, 5, function (err) {
      if (err)
        return res.json({err: err, code: 400});
      res.json({err: null, code: 200, results: results});
    })
  });

  server.use(router);
};
