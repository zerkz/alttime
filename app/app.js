var SCRIPT_PATH = '/var/lib/webosbrew/init.d/set-time';

var APP_DIR = '/media/developer/apps/usr/palm/applications/org.zdware.alttime';

// Startup script uses NTP via node to fetch time, then luna-send to set it
var SCRIPT_CONTENT =
  '#!/bin/sh\n' +
  '# alttime: sync system clock on boot via NTP\n' +
  'DEADLINE=${ALTTIME_DEADLINE:-$(($(date +%s) + 300))}\n' +
  'TS=$(node ' + APP_DIR + '/ntp-sync.js)\n' +
  'if [ -n "$TS" ] && [ "$TS" -gt 1577836800 ]; then\n' +
  '    luna-send -a webosbrew -n 1 luna://com.webos.service.systemservice/time/setSystemTime "{\\"utc\\":$TS}"\n' +
  'elif [ "$(date +%s)" -lt "$DEADLINE" ]; then\n' +
  '    (sleep 20 && ALTTIME_DEADLINE="$DEADLINE" /var/lib/webosbrew/init.d/set-time) &\n' +
  'fi\n';

// NTP server definitions
var PROVIDERS = [
  { id: 'google', name: 'Google NTP', server: 'time.google.com' },
  { id: 'cloudflare', name: 'Cloudflare NTP', server: 'time.cloudflare.com' },
  { id: 'pool', name: 'NTP Pool', server: 'pool.ntp.org' }
];

var selectedProvider = 0; // index into PROVIDERS

// ── Luna service bridge ───────────────────────────────────────────────────
function lunaCall(uri, params, onSuccess, onError) {
  try {
    var bridge = new WebOSServiceBridge();
    var done = false;
    bridge.onservicecallback = function(msg) {
      if (done) return;
      done = true;
      var r = JSON.parse(msg);
      if (r.returnValue === false) {
        if (onError) onError(r);
      } else {
        if (onSuccess) onSuccess(r);
      }
    };
    bridge.call(uri, JSON.stringify(params || {}));
  } catch (e) {
    if (onError) onError({ errorText: e.message });
  }
}

function execCommand(cmd, onSuccess, onError) {
  lunaCall('luna://org.webosbrew.hbchannel.service/exec', { command: cmd }, onSuccess, onError);
}

// ── UI helpers ────────────────────────────────────────────────────────────
var logEl = document.getElementById('log');
function setLog(msg, cls) {
  logEl.textContent = msg;
  logEl.className = 'log' + (cls ? ' log-' + cls : '');
}

// ── Provider selection ────────────────────────────────────────────────────
function selectProvider(idx) {
  selectedProvider = idx;
  var btns = document.getElementById('provider-row').querySelectorAll('button');
  for (var i = 0; i < btns.length; i++) {
    if (i === idx) {
      btns[i].className = 'provider selected';
    } else {
      btns[i].className = 'provider';
    }
  }
}

document.getElementById('prov-google').addEventListener('click',     function() { selectProvider(0); });
document.getElementById('prov-cloudflare').addEventListener('click', function() { selectProvider(1); });
document.getElementById('prov-pool').addEventListener('click',       function() { selectProvider(2); });

// ── Clock display ─────────────────────────────────────────────────────────
function pad(n) { return n < 10 ? '0' + n : '' + n; }

function updateClock() {
  var now = new Date();
  document.getElementById('time-display').textContent =
    pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  document.getElementById('date-display').textContent =
    days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
}
setInterval(updateClock, 1000);
updateClock();

// ── Script install status ─────────────────────────────────────────────────
function checkScriptInstalled(callback) {
  execCommand('test -x ' + SCRIPT_PATH,
    function() {
      document.getElementById('script-status').textContent = 'Installed';
      document.getElementById('script-dot').className = 'dot dot-green';
      document.getElementById('btn-install').style.display = 'none';
      document.getElementById('btn-remove').style.display = '';
      if (callback) callback(true);
    },
    function() {
      document.getElementById('script-status').textContent = 'Not installed';
      document.getElementById('script-dot').className = 'dot dot-red';
      document.getElementById('btn-install').style.display = '';
      document.getElementById('btn-remove').style.display = 'none';
      if (callback) callback(false);
    }
  );
}
// ── Root check ────────────────────────────────────────────────────────────
function checkRoot(callback) {
  execCommand('id -u',
    function(result) {
      var uid = parseInt((result.stdoutString || '').trim(), 10);
      if (uid === 0) {
        document.getElementById('root-dot').className = 'dot dot-green';
        document.getElementById('root-status').textContent = 'Root access OK';
        callback(true);
      } else {
        document.getElementById('root-dot').className = 'dot dot-red';
        document.getElementById('root-status').textContent = 'Not root (uid ' + uid + ')';
        setLog('Root access required (running as uid ' + uid + '). Is Homebrew Channel installed?', 'err');
        disableUI();
        callback(false);
      }
    },
    function() {
      document.getElementById('root-dot').className = 'dot dot-red';
      document.getElementById('root-status').textContent = 'Root check failed';
      setLog('Could not verify root access. Is Homebrew Channel installed and elevated?', 'err');
      disableUI();
      callback(false);
    }
  );
}

function disableUI() {
  var btns = document.querySelectorAll('button');
  for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
}

checkRoot(function(isRoot) {
  if (isRoot) checkScriptInstalled(null);
});

// ── Sync time now ─────────────────────────────────────────────────────────
document.getElementById('btn-sync').addEventListener('click', function() {
  var prov = PROVIDERS[selectedProvider];
  setLog('Fetching time from ' + prov.name + '...', 'busy');
  execCommand('node ' + APP_DIR + '/ntp-sync.js ' + prov.server,
    function(result) {
      var ts = parseInt((result.stdoutString || '').trim(), 10);
      if (!ts || ts < 1577836800) {
        setLog('Invalid timestamp from ' + prov.name + ': "' + (result.stdoutString || '').trim() + '"', 'err');
        return;
      }
      execCommand('luna-send -a webosbrew -n 1 luna://com.webos.service.systemservice/time/setSystemTime \'{"utc":' + ts + '}\'',
        function() {
          var now = new Date();
          document.getElementById('last-sync').textContent =
            prov.name + ' at ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
          setLog('Time synced via ' + prov.name + '.', 'ok');
        },
        function(e) { setLog('setSystemTime failed: ' + (e.errorText || e.stderrString || ''), 'err'); }
      );
    },
    function(e) { setLog('Fetch failed (' + prov.name + '): ' + (e.errorText || e.stderrString || ''), 'err'); }
  );
});

// ── Install startup script ────────────────────────────────────────────────
document.getElementById('btn-install').addEventListener('click', function() {
  setLog('Installing startup script...', 'busy');
  var b64 = btoa(SCRIPT_CONTENT);
  execCommand("printf '%s' '" + b64 + "' | base64 -d > " + SCRIPT_PATH + " && chmod +x " + SCRIPT_PATH,
    function() {
      checkScriptInstalled(null);
      setLog('Startup script installed. Time will sync on every boot.', 'ok');
    },
    function(e) { setLog('Install failed: ' + (e.errorText || e.stderrString || ''), 'err'); }
  );
});

// ── Remove startup script ─────────────────────────────────────────────────
document.getElementById('btn-remove').addEventListener('click', function() {
  setLog('Removing startup script...', 'busy');
  execCommand('rm -f ' + SCRIPT_PATH,
    function() {
      checkScriptInstalled(null);
      setLog('Startup script removed.', 'ok');
    },
    function(e) { setLog('Remove failed: ' + (e.errorText || ''), 'err'); }
  );
});

// ── Remote control navigation ─────────────────────────────────────────────
function getFocusable() {
  var all = document.querySelectorAll('button');
  var visible = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].style.display !== 'none') visible.push(all[i]);
  }
  return visible;
}

document.addEventListener('keydown', function(e) {
  var code = e.keyCode;
  if (code === 461 || code === 27) {
    if (typeof webOSSystem !== 'undefined') webOSSystem.back();
    return;
  }
  if (code === 13) {
    if (document.activeElement) document.activeElement.click();
    return;
  }
  if (code === 37 || code === 39) {
    var items = getFocusable();
    var idx = -1;
    for (var i = 0; i < items.length; i++) {
      if (items[i] === document.activeElement) { idx = i; break; }
    }
    if (idx === -1) { if (items[0]) items[0].focus(); return; }
    var next = code === 39 ? items[idx + 1] : items[idx - 1];
    if (next) next.focus();
  }
});

window.addEventListener('load', function() {
  var items = getFocusable();
  if (items.length) items[0].focus();
});
