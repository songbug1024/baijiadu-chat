var http = require('http');
var sticky = require('./sticky-session');
var loopback = require('loopback');
var boot = require('loopback-boot');
var path = require('path');
var redis = require('socket.io-redis');
var bodyParser = require('body-parser');
var socketIO = require('socket.io');
var socketServer = require('./socket-server');
var app = loopback();

app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/uploads', loopback.static(path.resolve(__dirname, '../uploads')));
app.use(loopback.static(path.resolve(__dirname, '../client/chat')));

boot(app, __dirname, function(err) {
  if (err) throw err;
});

function startSocketServer (server) {
  var io = socketIO(server, {
    adapter: redis({ host: 'localhost', port: 6379 })
  });

  io.on('connection', socketServer.connect);
}

var __server = http.createServer(app);

__server.__start = function (server) {
  startSocketServer(server);
}

sticky(__server).listen(3000, function() {
  console.log('server started on 3000 port');
});
