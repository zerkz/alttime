# AltTime

webOS TV app that syncs the system clock via NTP.

## Build

`make` produces an `.ipk` in the project root. Version is read from `app/appinfo.json`.

## Install to TV

SCP the ipk to `/tmp/` on the TV, then install via luna-send:

```
scp *.ipk lgtv:/tmp/
ssh -tt lgtv 'luna-send -a webosbrew -i luna://com.webos.appInstallService/dev/install '"'"'{"id":"org.zdware.alttime","ipkUrl":"/tmp/<ipk-file>","subscribe":true}'"'"''
```

Apps install to `/media/developer/apps/usr/palm/applications/`.

## Debugging

`luna-send` requires a TTY to produce output. When running via SSH, use `ssh -tt` to force pseudo-terminal allocation.
