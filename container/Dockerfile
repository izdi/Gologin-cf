FROM ubuntu:20.04
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV DISPLAY=:0

#======================
# Locale Configuration
#======================
RUN apt-get update && \
    apt-get install -y --no-install-recommends tzdata locales && \
    sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && \
    locale-gen
ENV TZ=America/New_York
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
RUN echo "LC_ALL=en_US.UTF-8" >> /etc/environment && \
    echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen && \
    echo "LANG=en_US.UTF-8" > /etc/locale.conf && \
    locale-gen en_US.UTF-8

#===========================
# Fingerprint Fonts
#===========================
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      fonts-liberation \
      fonts-noto \
      fonts-noto-cjk \
      fonts-noto-color-emoji \
      fonts-freefont-ttf \
      fonts-dejavu-core \
      fonts-ubuntu \
      fonts-roboto \
      fonts-droid-fallback \
      libvulkan1

#======================
# Common Fonts
#======================
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      fonts-font-awesome \
      fonts-terminus \
      fonts-powerline \
      fonts-open-sans \
      fonts-lato

#============================
# Linux Dependencies (Chromium / Orbita)
#============================
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      dbus-x11 \
      gconf-service \
      libasound2 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libatspi2.0-0 \
      libc6 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libexpat1 \
      libfontconfig1 \
      libgbm-dev \
      libgcc1 \
      libgconf-2-4 \
      libgdk-pixbuf2.0-0 \
      libglib2.0-0 \
      libgtk-3-0 \
      libgtk-3-bin \
      libnspr4 \
      libnss3 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libstdc++6 \
      libu2f-udev \
      libwayland-client0 \
      libx11-6 \
      libx11-xcb1 \
      libxcb1 \
      libxcomposite1 \
      libxcursor1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxi6 \
      libxkbcommon0 \
      libxrandr2 \
      libxrender1 \
      libxss1 \
      libxtst6 \
      libappindicator1

#==========================
# Utilities & tools
#==========================
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      lsb-release \
      libcurl3-gnutls \
      psmisc \
      sudo \
      unzip \
      wget \
      x11-utils \
      x11vnc \
      xdg-utils \
      xvfb \
      zip

#================
# Python 3 + pip
#================
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 python3-pip && \
    fc-cache -f -v

#================
# Orbita browser
#================
RUN wget -q \
      https://orbita-browser-linux.gologin.com/orbita-browser-latest.tar.gz \
      -O /tmp/orbita-browser.tar.gz && \
    tar -xzf /tmp/orbita-browser.tar.gz -C /usr/bin && \
    rm -f /tmp/orbita-browser.tar.gz

#===============
# Cleanup
#===============
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

#================
# GoLogin Python SDK
#================
COPY requirements.txt /opt/orbita/requirements.txt
RUN pip3 install --no-cache-dir -r /opt/orbita/requirements.txt

#================
# Non-root user
#================
RUN groupadd -r orbita && \
    useradd -r -g orbita -s /bin/bash \
      -G audio,video,sudo \
      -p "$(echo 1 | openssl passwd -1 -stdin)" orbita && \
    mkdir -p /home/orbita/Downloads && \
    chown -R orbita:orbita /home/orbita && \
    echo 'orbita ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

RUN mkdir -p /home/orbita/.gologin/browser/fonts && \
    chown -R orbita:orbita /home/orbita/.gologin

EXPOSE 3500

COPY main.py /opt/orbita/main.py
COPY entrypoint.sh /entrypoint.sh

RUN chmod 755 /entrypoint.sh && \
    mkdir -p /tmp/.X11-unix && \
    chmod 1777 /tmp/.X11-unix

USER orbita
ENTRYPOINT ["/entrypoint.sh"]
