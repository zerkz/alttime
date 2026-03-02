var ntp = require(__dirname + '/ntp');

var SERVERS = ['time.google.com', 'time.cloudflare.com', 'pool.ntp.org'];

var server = process.argv[2];

if (server) {
  ntp.ntpFetch(server, function(err, ts) {
    if (err) {
      process.exit(1);
    }
    process.stdout.write(String(ts));
    process.exit(0);
  });
} else {
  tryNext(0);
}

function tryNext(i) {
  if (i >= SERVERS.length) {
    process.exit(1);
  }
  ntp.ntpFetch(SERVERS[i], function(err, ts) {
    if (err) {
      tryNext(i + 1);
    } else {
      process.stdout.write(String(ts));
      process.exit(0);
    }
  });
}
