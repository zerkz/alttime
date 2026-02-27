APP_ID      := org.zdware.alttime
VERSION     := $(shell python3 -c "import json; print(json.load(open('app/appinfo.json'))['version'])")
ARCH        := all
IPK         := $(APP_ID)_$(VERSION)_$(ARCH).ipk

BUILD_DIR   := build
DATA_DIR    := $(BUILD_DIR)/data

.PHONY: all clean

all: $(IPK)

$(IPK): app/appinfo.json app/index.html app/app.js app/icon.png app/largeIcon.png
	rm -rf $(BUILD_DIR)
	mkdir -p $(DATA_DIR)/usr/palm/applications/$(APP_ID)

	# Copy app files
	cp app/appinfo.json app/index.html app/app.js app/icon.png app/largeIcon.png \
	   $(DATA_DIR)/usr/palm/applications/$(APP_ID)/

	# control archive (metadata for opkg)
	mkdir -p $(BUILD_DIR)/control
	printf 'Package: %s\nVersion: %s\nArchitecture: %s\nMaintainer: zdware\nDescription: Fixes LG webOS system clock on boot via HTTPS time sync\n' \
	  $(APP_ID) $(VERSION) $(ARCH) > $(BUILD_DIR)/control/control
	cd $(BUILD_DIR)/control && tar czf $(CURDIR)/$(BUILD_DIR)/control.tar.gz .

	# data archive
	cd $(DATA_DIR) && tar czf $(CURDIR)/$(BUILD_DIR)/data.tar.gz .

	# assemble .ipk  (GNU ar archive: debian-binary, control.tar.gz, data.tar.gz)
	# macOS ar produces BSD format with a __.SYMDEF header that breaks webOS,
	# so we use make_ar.py to write a clean GNU ar archive.
	printf '2.0\n' > $(BUILD_DIR)/debian-binary
	python3 make_ar.py $(IPK) \
	  $(BUILD_DIR)/debian-binary \
	  $(BUILD_DIR)/control.tar.gz \
	  $(BUILD_DIR)/data.tar.gz

	rm -rf $(BUILD_DIR)
	@echo "Built: $(IPK)"

clean:
	rm -rf $(BUILD_DIR) $(IPK)
