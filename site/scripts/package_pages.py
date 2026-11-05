"""Packages the static export (out/) as Cloudflare Workers static assets, with security and cache headers.

The site is built locally because it reads the paper from ../research. Deploy with (config in wrangler.jsonc):
    npm run build && python scripts/package_pages.py && npx wrangler@4.157.0 deploy
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
TARGET = ROOT / ".pages"

# Next's static export inlines its bootstrap scripts and styles, so 'unsafe-inline' is needed there;
# everything else (fonts, data, images) is self-hosted.
CSP = "; ".join([
    "default-src 'self'",
    # Cloudflare Web Analytics is injected by the adetayo.dev zone.
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://cloudflareinsights.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
])

HEADERS = f"""/*
  Content-Security-Policy: {CSP}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
"""


def main() -> None:
    if not (OUT / "index.html").exists() or not (OUT / "fr" / "index.html").exists():
        raise SystemExit("out/ is missing or incomplete: run `npm run build` first.")
    if TARGET.exists():
        shutil.rmtree(TARGET)
    shutil.copytree(OUT, TARGET)
    (TARGET / "_headers").write_text(HEADERS, encoding="utf-8")
    files = sum(1 for p in TARGET.rglob("*") if p.is_file())
    print(f"packaged {files} files -> {TARGET}")


if __name__ == "__main__":
    main()
