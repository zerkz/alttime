var dgram = require('dgram');

var NTP_EPOCH_OFFSET = 2208988800;

function ntpFetch(server, callback) {
  var socket = dgram.createSocket('udp4');
  var packet = Buffer.alloc(48);
  packet[0] = 0x1B; // LI=0, VN=3, Mode=3

  var done = false;
  var timer = setTimeout(function() {
    if (done) return;
    done = true;
    socket.close();
    callback(new Error('NTP request timed out'));
  }, 10000);

  socket.on('message', function(msg) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    socket.close();

    if (msg.length < 48) {
      callback(new Error('NTP response too short'));
      return;
    }

    var seconds = msg.readUInt32BE(40);
    var fraction = msg.readUInt32BE(44);
    var unix = seconds - NTP_EPOCH_OFFSET + fraction / 4294967296;
    callback(null, Math.floor(unix));
  });

  socket.on('error', function(err) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    socket.close();
    callback(err);
  });

  socket.send(packet, 0, 48, 123, server, function(err) {
    if (err && !done) {
      done = true;
      clearTimeout(timer);
      socket.close();
      callback(err);
    }
  });
}

module.exports = { ntpFetch: ntpFetch };
