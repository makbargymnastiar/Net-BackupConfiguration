"""
Tests for SECRET_KEY configuration hardening.

Covers app._resolve_secret_key: empty/blank/None must fail fast with a clear
config error, valid values must be used (stripped), and the app must start
with a non-empty key. No production secret lives in source; these use
throwaway literals only.
"""

import pytest


class TestResolveSecretKey:
    def _resolve(self, raw):
        from app import _resolve_secret_key

        return _resolve_secret_key(raw)

    def test_empty_string_raises(self):
        with pytest.raises(RuntimeError):
            self._resolve("")

    def test_whitespace_only_raises(self):
        with pytest.raises(RuntimeError):
            self._resolve("   \t\n  ")

    def test_none_raises(self):
        # os.getenv(..., "") never yields None in practice, but the helper is
        # defensive and must not accept a falsy value.
        with pytest.raises(RuntimeError):
            self._resolve(None)

    def test_valid_value_is_used_and_stripped(self):
        assert self._resolve("  a-long-random-secret-value  ") == "a-long-random-secret-value"

    def test_error_message_is_actionable(self):
        with pytest.raises(RuntimeError) as excinfo:
            self._resolve("")
        msg = str(excinfo.value)
        assert "SECRET_KEY" in msg
        assert "openssl rand -hex 32" in msg

    def test_app_starts_with_non_empty_key(self):
        # conftest provides a test SECRET_KEY before import, so the module-level
        # fail-fast must have accepted it and app.secret_key is non-empty.
        import app as app_module

        assert app_module.app.secret_key
