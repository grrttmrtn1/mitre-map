#!/bin/sh
set -e

# ── Runtime enterprise CA injection ──────────────────────────────────────────
# Runs as root; installs any cert mounted via ENTERPRISE_CA_BUNDLE, then
# drops privileges to the mitremap user before exec-ing the server.
#
# Both paths are fully optional — the container starts normally with no cert.

if [ -n "$ENTERPRISE_CA_BUNDLE" ] && [ -f "$ENTERPRISE_CA_BUNDLE" ]; then
  cp "$ENTERPRISE_CA_BUNDLE" /usr/local/share/ca-certificates/enterprise-runtime.crt
  update-ca-certificates > /dev/null 2>&1
fi

# Always point Node at the system bundle so build-time certs work too.
# NODE_EXTRA_CA_CERTS appends to Node's built-in Mozilla store — does not replace it.
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

exec gosu mitremap "$@"
