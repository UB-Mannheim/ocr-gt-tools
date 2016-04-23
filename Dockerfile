FROM debian
RUN apt-get update && apt-get install -y \
        curl \
        git \
        libconfig-inifiles-perl \
        libjson-perl \
        libplack-perl \
        make \
        npm \
        python-matplotlib \
        python-numpy \
        python-scipy
ADD . /home/ocr-gt-tools
WORKDIR /home/ocr-gt-tools
EXPOSE 9090
CMD ["/usr/bin/make", "dev-server"]
