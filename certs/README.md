# Enterprise CA Certificates

Drop your enterprise root CA certificate here as a PEM-encoded `.crt` file.

## Build-time injection (cert baked into image)

Place your cert at `certs/enterprise-root-ca.crt` before running `docker build`.
The build will install it into the system CA store and it will be available to
both system tools (curl, wget) and Node.js (via `NODE_EXTRA_CA_CERTS`).

## Runtime injection (no rebuild required)

Mount this directory into the container and set `ENTERPRISE_CA_BUNDLE` to the
path of the cert file inside the container:

```yaml
volumes:
  - ./certs:/app/certs:ro
environment:
  ENTERPRISE_CA_BUNDLE: /app/certs/enterprise-root-ca.crt
```

The entrypoint installs the cert before the Node process starts.

## No certificate needed?

Leave this directory empty. Both injection paths are fully optional — the
container starts normally without any cert present.

## Notes

- `*.crt` files in this directory are gitignored but included in the Docker build context.
- The cert is appended to Node's built-in Mozilla bundle (`NODE_EXTRA_CA_CERTS`),
  so public internet TLS continues to work unchanged.
