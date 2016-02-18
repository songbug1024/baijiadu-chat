var loopback = require('loopback');
var boot = require('loopback-boot');
var path = require('path');
var socketIO = require('socket.io');
var app = module.exports = loopback();
var socketServer = require('./socket-server');

app.start = function() {
  var server = app.listen(function() {
    app.emit('started');
    console.log('Web server listening at: %s', app.get('url'));
  });

  startSocketServer(server);
};

app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'jade');

app.use('/uploads', loopback.static(path.resolve(__dirname, '../uploads')));
app.use(loopback.static(path.resolve(__dirname, '../client/chat')));

boot(app, __dirname, function(err) {
  if (err) throw err;

  if (require.main === module) {
    app.start();
  }
});

function startSocketServer(server) {
  var io = socketIO(server);

  io.on('connection', socketServer.connect);
}