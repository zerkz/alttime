var SCRIPT_PATH = '/var/lib/webosbrew/init.d/set-time';

// Startup script tries all three providers in fallback order
var SCRIPT_CONTENT =
  '#!/bin/sh\n' +
  '# alttime: sync system clock on boot\n' +
  'get_ts() {\n' +
  '    TS=$(curl -s -k --max-time 10 https://1.1.1.1/cdn-cgi/trace 2>/dev/null | grep \'^ts=\' | cut -d= -f2 | cut -d. -f1)\n' +
  '    [ -n "$TS" ] && [ "$TS" -gt 1577836800 ] && echo "$TS" && return\n' +
  '    TS=$(curl -sI -k --max-time 10 https://www.google.com 2>/dev/null | awk \'/^[Dd]ate:/{split($6,t,":");m=index("JanFebMarAprMayJunJulAugSepOctNovDec",$4);mo=int((m+2)/3);d=$3+0;y=$5+0;if(mo<=2){mo+=12;y--};print int((365*y+int(y/4)-int(y/100)+int(y/400)+int(30.6001*(mo+1))+d-719591)*86400+t[1]*3600+t[2]*60+t[3])}\')\n' +
  '    [ -n "$TS" ] && [ "$TS" -gt 1577836800 ] && echo "$TS" && return\n' +
  '    TS=$(curl -s -k --max-time 10 https://timeapi.io/api/v1/time/current/unix 2>/dev/null | grep -o \'[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]\' | head -1)\n' +
  '    [ -n "$TS" ] && [ "$TS" -gt 1577836800 ] && echo "$TS"\n' +
  '}\n' +
  'TS=$(get_ts)\n' +
  'if [ -n "$TS" ] && [ "$TS" -gt 1577836800 ]; then\n' +
  '    luna-send -a webosbrew -n 1 luna://com.webos.service.systemservice/time/setSystemTime "{\\"utc\\":$TS}"\n' +
  'else\n' +
  '    (sleep 20 && /var/lib/webosbrew/init.d/set-time) &\n' +
  'fi\n';

// Provider definitions: name, fetch command (outputs unix timestamp to stdout)
var PROVIDERS = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    cmd: "curl -s -k --max-time 10 https://1.1.1.1/cdn-cgi/trace | grep '^ts=' | cut -d= -f2 | cut -d. -f1"
  },
  {
    id: 'google',
    name: 'Google',
    cmd: "curl -sI -k --max-time 10 https://www.google.com 2>/dev/null | awk '/^[Dd]ate:/{split($6,t,\":\");m=index(\"JanFebMarAprMayJunJulAugSepOctNovDec\",$4);mo=int((m+2)/3);d=$3+0;y=$5+0;if(mo<=2){mo+=12;y--};print int((365*y+int(y/4)-int(y/100)+int(y/400)+int(30.6001*(mo+1))+d-719591)*86400+t[1]*3600+t[2]*60+t[3])}'"
  },
  {
    id: 'timeapi',
    name: 'TimeAPI.io',
    cmd: "curl -s -k --max-time 10 https://timeapi.io/api/v1/time/current/unix | grep -o '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' | head -1"
  }
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

document.getElementById('prov-cloudflare').addEventListener('click', function() { selectProvider(0); });
document.getElementById('prov-google').addEventListener('click',     function() { selectProvider(1); });
document.getElementById('prov-timeapi').addEventListener('click',    function() { selectProvider(2); });

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
checkScriptInstalled(null);

// ── Sync time now ─────────────────────────────────────────────────────────
document.getElementById('btn-sync').addEventListener('click', function() {
  var prov = PROVIDERS[selectedProvider];
  setLog('Fetching time from ' + prov.name + '...', 'busy');
  execCommand(prov.cmd,
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
