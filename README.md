# AltTime

A webOS app that syncs the system clock via alternate HTTPS sources. This is useful if your network environment is blocking whatever WebOS was using to set time.

<img width="1236" height="694" alt="image" src="https://github.com/user-attachments/assets/b704cf9e-6a75-4be4-92b7-4f0c1348c820" />

## TV Requirements

- Rooted webOS TV (via RootMyTV or similar)
- [Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel) installed and elevated

> **Note:** Root is required. The app relies on Homebrew Channel's exec service, writing to `/var/lib/webosbrew/init.d/`, and `setSystemTime` — all of which need root privileges.

## Build Requirements

- `make`
- `python3`

## Build

```sh
make
```
This will generate the `.ipk.`

## Install

Side-load the `.ipk` onto your rooted webOS TV using SSH and `opkg install`, or via Homebrew Channel's package manager.

## Clean

```sh
make clean
```

# Disclaimer
While I make every attempt to test this software on my own LG device and aim for no bad side effects/bugs, you are installing this software at your own risk. 