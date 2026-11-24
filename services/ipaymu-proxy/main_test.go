package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

const testSecret = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

func signEgress(secret, method, path, mode, ts, nonce string, body []byte) string {
	sum := sha256.Sum256(body)
	canonical := strings.Join([]string{
		method,
		path,
		mode,
		ts,
		nonce,
		hex.EncodeToString(sum[:]),
	}, "\n")
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(canonical))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestEgressSuccessAndReplayProtection(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v2/payment" {
			t.Fatalf("unexpected upstream path: %s", r.URL.Path)
		}
		if r.Header.Get("va") != "1179000899" {
			t.Fatalf("missing va header")
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"Status":200,"Success":true}`))
	}))
	defer upstream.Close()

	srv := newProxyServer()
	srv.secretProvider = func() string { return testSecret }
	srv.upstreamBase = func(string) string { return upstream.URL }
	fixedTime := time.Unix(1700000000, 0)
	srv.now = func() time.Time { return fixedTime }

	body := []byte(`{"amount":29900}`)
	ts := strconv.FormatInt(fixedTime.Unix(), 10)
	nonce := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	sig := signEgress(testSecret, "POST", "/api/v2/payment", "production", ts, nonce, body)

	makeReq := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/ipaymu-egress", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-ipaymu-method", "POST")
		req.Header.Set("x-ipaymu-path", "/api/v2/payment")
		req.Header.Set("x-ipaymu-mode", "production")
		req.Header.Set("x-vivreplay-timestamp", ts)
		req.Header.Set("x-vivreplay-nonce", nonce)
		req.Header.Set("x-vivreplay-signature", sig)
		req.Header.Set("x-ipaymu-va", "1179000899")
		req.Header.Set("x-ipaymu-timestamp", "20261124120000")
		req.Header.Set("x-ipaymu-signature", strings.Repeat("b", 64))
		rr := httptest.NewRecorder()
		srv.routes().ServeHTTP(rr, req)
		return rr
	}

	first := makeReq()
	if first.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", first.Code, first.Body.String())
	}
	if !strings.Contains(first.Body.String(), `"Success":true`) {
		t.Fatalf("unexpected upstream body: %s", first.Body.String())
	}

	replay := makeReq()
	if replay.Code != http.StatusConflict {
		t.Fatalf("expected 409 on replay, got %d", replay.Code)
	}
}

func TestEgressRejectsInvalidSignatureAndDisallowedRoute(t *testing.T) {
	srv := newProxyServer()
	srv.secretProvider = func() string { return testSecret }
	fixedTime := time.Unix(1700000000, 0)
	srv.now = func() time.Time { return fixedTime }

	req := httptest.NewRequest(http.MethodPost, "/api/ipaymu-egress", nil)
	req.Header.Set("x-ipaymu-method", "DELETE")
	req.Header.Set("x-ipaymu-path", "/api/v2/unknown")
	req.Header.Set("x-ipaymu-mode", "production")
	rr := httptest.NewRecorder()
	srv.routes().ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for disallowed route, got %d", rr.Code)
	}

	ts := strconv.FormatInt(fixedTime.Unix(), 10)
	req2 := httptest.NewRequest(http.MethodPost, "/api/ipaymu-egress", nil)
	req2.Header.Set("x-ipaymu-method", "GET")
	req2.Header.Set("x-ipaymu-path", "/api/v2/payment-channels")
	req2.Header.Set("x-ipaymu-mode", "production")
	req2.Header.Set("x-vivreplay-timestamp", ts)
	req2.Header.Set("x-vivreplay-nonce", strings.Repeat("c", 32))
	req2.Header.Set("x-vivreplay-signature", strings.Repeat("d", 64))
	rr2 := httptest.NewRecorder()
	srv.routes().ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for bad signature, got %d", rr2.Code)
	}
}
