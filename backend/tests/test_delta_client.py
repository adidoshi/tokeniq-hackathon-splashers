import hashlib
import hmac

from app.delta.client import sign


def test_sign_matches_delta_spec():
    # Docs example prehash: GET1542110948/v2/orders?product_id=1&state=open
    expected = hmac.new(b"secret", b"GET1542110948/v2/orders?product_id=1&state=open", hashlib.sha256).hexdigest()
    assert sign("secret", "GET", "1542110948", "/v2/orders", "?product_id=1&state=open") == expected


def test_sign_includes_body():
    body = '{"product_id":84,"side":"buy","size":1}'
    assert sign("s", "POST", "1", "/v2/orders", "", body) != sign("s", "POST", "1", "/v2/orders")
