# Tracking specification

Short parameters take precedence over UTMs: `s/utm_source`, `m/utm_medium`, `c/utm_campaign`, `cl/utm_content`, `a/account`, `v/variant`, and `h/utm_term`. Values are lowercased, limited to 100 characters, and restricted to letters, digits, `.`, `_`, and `-`. Unknown master-data values remain raw normalized dimensions; they never create records automatically.

The redirect click is the financial source of truth. Each request receives a random public click ID and records route, drama, selected destination, session, normalized dimensions, device family, outcome, and latency. Raw IP, full user agent, destination URL, promo code, and PII must never be written to application logs.

Preview funnel events are `episode_start`, `episode_complete`, `next_episode`, `promo_code_copy`, and `watch_full_click`. They use schema version 1 and include internal drama/episode identifiers; they never include the video URL or CPS destination.
