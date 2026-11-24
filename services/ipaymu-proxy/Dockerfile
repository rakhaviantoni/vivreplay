FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /ipaymu-proxy .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /ipaymu-proxy /ipaymu-proxy
ENV IPAYMU_PROXY_ADDR=:8081
EXPOSE 8081
ENTRYPOINT ["/ipaymu-proxy"]
