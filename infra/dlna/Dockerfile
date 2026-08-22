ARG IMMICH_DLNA_VERSION
FROM ghcr.io/semaicze/immich-dlna:${IMMICH_DLNA_VERSION}

COPY patch-preview-jpeg.py /tmp/
RUN python /tmp/patch-preview-jpeg.py && rm /tmp/patch-preview-jpeg.py
