PI_ENV ?= config/pi-image.env
PI_DEV_IMAGE ?= telegram-test-one-pi-dev:bookworm

.PHONY: help pi-dev-shell pi-image pi-validate clean

help:
	@printf '%s\n' 'Targets:'
	@printf '%s\n' '  make pi-dev-shell  Build and open an ARM64 Raspberry Pi-like shell'
	@printf '%s\n' '  make pi-image      Build a customized Raspberry Pi OS image'
	@printf '%s\n' '  make pi-validate   Validate shell scripts and config examples'
	@printf '%s\n' '  make clean         Remove local generated build artifacts'

pi-dev-shell:
	docker build --platform linux/arm64/v8 -f docker/pi-dev/Dockerfile -t $(PI_DEV_IMAGE) .
	docker run --rm -it --platform linux/arm64/v8 \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		$(PI_DEV_IMAGE)

pi-image:
	sudo ./scripts/build-pi-sd-image.sh "$(PI_ENV)"

pi-validate:
	./scripts/validate-pi-environment.sh

clean:
	rm -rf .pi-build dist
