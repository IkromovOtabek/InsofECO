# MinIO — eski (x86-64-v1) protsessorli VPS uchun.
#
# Rasmiy image (UBI9 bazasi) glibc orqali x86-64-v2 talab qiladi: QEMU virtual CPU'da konteyner
# "Fatal glibc error: CPU does not support x86-64-v2" bilan ishga tushmaydi. minio va mc esa statik Go
# binarlari (GOAMD64=v1) — ular istalgan bazada ishlaydi. Rasmiy image'lar endi registry'da tarqatilmaydi,
# shuning uchun binarlar serverda keshlangan image'dan olinadi (MINIO_IMAGE bilan boshqasini berish mumkin).
ARG MINIO_IMAGE=quay.io/minio/minio:latest
FROM ${MINIO_IMAGE} AS src

FROM debian:12-slim
COPY --from=src /usr/bin/minio /usr/bin/minio
COPY --from=src /usr/bin/mc /usr/bin/mc
EXPOSE 9000 9001
ENTRYPOINT ["/usr/bin/minio"]
