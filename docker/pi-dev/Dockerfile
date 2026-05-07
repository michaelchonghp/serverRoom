FROM --platform=linux/arm64/v8 debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
        iputils-ping \
        less \
        nano \
        openssh-client \
        python3 \
        python3-pip \
        python3-venv \
        sudo \
        tini \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash pi \
    && echo 'pi ALL=(ALL) NOPASSWD:ALL' >/etc/sudoers.d/pi \
    && chmod 0440 /etc/sudoers.d/pi

USER pi
WORKDIR /workspace

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/bin/bash"]
