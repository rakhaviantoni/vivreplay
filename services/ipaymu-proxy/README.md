# VivrePlay iPaymu Egress Proxy (Go)

Standalone, zero-dependency Go reverse proxy for `POST /api/ipaymu-egress` and `GET /health`.
Isolates payment gateway requests from the Python OpenCV/PyTorch card-scanner workers so heavy image scans never block checkout or QRIS requests.

## Running locally / on VPS

```bash
export IPAYMU_PROXY_SECRET="<64+ char hex secret matching IPAYMU_EGRESS_PROXY_SECRET>"
export IPAYMU_PROXY_ADDR="127.0.0.1:8081"
go run .
```

## Build static binary

```bash
CGO_ENABLED=0 go build -ldflags="-s -w" -o ipaymu-proxy .
```

## Cutover on VPS (Nginx example)

Point `/api/ipaymu-egress` to `http://127.0.0.1:8081` while keeping `/api/scan` and `/health` routed to `http://127.0.0.1:8000`:

```nginx
location = /api/ipaymu-egress {
    proxy_pass http://127.0.0.1:8081;
    proxy_set_header Host $host;
}
```
