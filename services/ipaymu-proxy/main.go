package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	maxBodyBytes      = 65536
	maxClockSkewSec   = 120
	nonceTTLSec       = 600
	defaultListenAddr = "127.0.0.1:8081"
)

var (
	reTimestamp10 = regexp.MustCompile(`^\d{10}$`)
	reTimestamp14 = regexp.MustCompile(`^\d{14}$`)
	reHex32       = regexp.MustCompile(`^[a-f0-9]{32}$`)
	reHex64Lower  = regexp.MustCompile(`^[a-f0-9]{64}$`)
	reHex64Any    = regexp.MustCompile(`^[a-fA-F0-9]{64}$`)
)

var allowedRoutes = map[string]struct{}{
	"GET /api/v2/payment-channels": {},
	"POST /api/v2/payment":         {},
	"POST /api/v2/payment/direct":  {},
	"POST /api/v2/balance":         {},
	"POST /api/v2/history":         {},
	"POST /api/v2/transaction":     {},
}

type nonceStore struct {
	mu   sync.Mutex
	used map[string]int64
}

func newNonceStore() *nonceStore {
	return &nonceStore{used: make(map[string]int64)}
}

func (s *nonceStore) consume(nonce string, issuedAt int64, now int64) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	cutoff := now - nonceTTLSec
	for key, ts := range s.used {
		if ts < cutoff {
			delete(s.used, key)
		}
	}
	if _, exists := s.used[nonce]; exists {
		return false
	}
	s.used[nonce] = issuedAt
	return true
}

type proxyServer struct {
	secretProvider func() string
	upstreamBase   func(mode string) string
	client         *http.Client
	nonces         *nonceStore
	now            func() time.Time
}

func newProxyServer() *proxyServer {
	transport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   8 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   8 * time.Second,
		ResponseHeaderTimeout: 45 * time.Second,
		MaxIdleConns:          64,
		IdleConnTimeout:       90 * time.Second,
	}
	client := &http.Client{
		Transport: transport,
		Timeout:   45 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	return &proxyServer{
		secretProvider: func() string {
			return strings.TrimSpace(os.Getenv("IPAYMU_PROXY_SECRET"))
		},
		upstreamBase: func(mode string) string {
			if mode == "production" {
				return "https://my.ipaymu.com"
			}
			return "https://sandbox.ipaymu.com"
		},
		client: client,
		nonces: newNonceStore(),
		now:    time.Now,
	}
}

func writeJSONError(w http.ResponseWriter, status int, detail string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"detail": detail})
}

func (s *proxyServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	configured := len(s.secretProvider()) >= 64
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":     "ok",
		"service":    "ipaymu-proxy",
		"configured": configured,
	})
}

func (s *proxyServer) handleEgress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	secret := s.secretProvider()
	if len(secret) < 64 {
		writeJSONError(w, http.StatusServiceUnavailable, "Payment relay is not configured")
		return
	}

	method := strings.ToUpper(r.Header.Get("x-ipaymu-method"))
	path := r.Header.Get("x-ipaymu-path")
	mode := r.Header.Get("x-ipaymu-mode")
	timestampHeader := r.Header.Get("x-vivreplay-timestamp")
	nonce := r.Header.Get("x-vivreplay-nonce")
	suppliedSig := strings.ToLower(r.Header.Get("x-vivreplay-signature"))

	if _, ok := allowedRoutes[method+" "+path]; !ok || (mode != "production" && mode != "sandbox") {
		writeJSONError(w, http.StatusBadRequest, "Unsupported payment request")
		return
	}
	if !reTimestamp10.MatchString(timestampHeader) || !reHex32.MatchString(nonce) || !reHex64Lower.MatchString(suppliedSig) {
		writeJSONError(w, http.StatusUnauthorized, "Invalid request")
		return
	}
	issuedAt, err := strconv.ParseInt(timestampHeader, 10, 64)
	if err != nil {
		writeJSONError(w, http.StatusUnauthorized, "Invalid request")
		return
	}
	nowUnix := s.now().Unix()
	diff := nowUnix - issuedAt
	if diff < 0 {
		diff = -diff
	}
	if diff > maxClockSkewSec {
		writeJSONError(w, http.StatusUnauthorized, "Expired request")
		return
	}

	limited := io.LimitReader(r.Body, maxBodyBytes+1)
	body, err := io.ReadAll(limited)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if len(body) > maxBodyBytes || (method == http.MethodGet && len(body) > 0) {
		writeJSONError(w, http.StatusRequestEntityTooLarge, "Request is too large")
		return
	}

	bodyDigest := sha256.Sum256(body)
	canonical := strings.Join([]string{
		method,
		path,
		mode,
		timestampHeader,
		nonce,
		hex.EncodeToString(bodyDigest[:]),
	}, "\n")
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(canonical))
	expectedSig := mac.Sum(nil)

	suppliedBytes, err := hex.DecodeString(suppliedSig)
	if err != nil || !hmac.Equal(expectedSig, suppliedBytes) {
		writeJSONError(w, http.StatusUnauthorized, "Invalid request")
		return
	}

	if !s.nonces.consume(nonce, issuedAt, nowUnix) {
		writeJSONError(w, http.StatusConflict, "Request already used")
		return
	}

	va := r.Header.Get("x-ipaymu-va")
	ipaymuTimestamp := r.Header.Get("x-ipaymu-timestamp")
	ipaymuSignature := r.Header.Get("x-ipaymu-signature")
	if va == "" || !reTimestamp14.MatchString(ipaymuTimestamp) || !reHex64Any.MatchString(ipaymuSignature) {
		writeJSONError(w, http.StatusBadRequest, "Payment request is incomplete")
		return
	}

	var reqBody io.Reader
	if len(body) > 0 {
		reqBody = bytes.NewReader(body)
	}
	upstreamURL := strings.TrimRight(s.upstreamBase(mode), "/") + path
	upReq, err := http.NewRequestWithContext(r.Context(), method, upstreamURL, reqBody)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "Payment provider could not be reached")
		return
	}
	contentType := r.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/json"
	}
	upReq.Header.Set("Content-Type", contentType)
	upReq.Header.Set("va", va)
	upReq.Header.Set("timestamp", ipaymuTimestamp)
	upReq.Header.Set("signature", ipaymuSignature)

	resp, err := s.client.Do(upReq)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "Payment provider could not be reached")
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024))
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "Payment provider could not be reached")
		return
	}

	respType := resp.Header.Get("Content-Type")
	if respType == "" {
		respType = "application/json"
	}
	w.Header().Set("Content-Type", respType)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(respBody)
}

func (s *proxyServer) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/api/ipaymu-egress", s.handleEgress)
	return mux
}

func main() {
	addr := strings.TrimSpace(os.Getenv("IPAYMU_PROXY_ADDR"))
	if addr == "" {
		addr = defaultListenAddr
	}
	srv := newProxyServer()
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           srv.routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("ipaymu-proxy listening on %s", addr)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}
