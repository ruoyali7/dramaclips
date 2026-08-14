# RS Boost compliance guardrails

This document is a mandatory product and engineering checklist for every feature that uses RS Boost data, links, Works, or Advertising Materials. It summarizes the RS Boost Terms of Services updated October 16, 2025 and effective October 23, 2025. It is not legal advice and does not replace the current terms or written permission from RS Boost.

## Core rule

DramaClips must remain a private promotion-management tool and preview funnel for the account owner's authorized RS Boost campaigns. It must not become an RS Boost substitute, a public RS content database, a general scraping service, or a way for third parties to reuse RS content.

## Allowed baseline

- Use only an account owned and controlled by the operator.
- Read or enter the minimum metadata needed to manage an authorized promotion.
- Use only Advertising Materials made available to that account for promotion.
- Reproduce, crop, rearrange, edit, compile, or transmit Advertising Materials only to attract users to the relevant Work and Promoted Product.
- Keep the applicable RS Content Promotion Link visibly and functionally connected to the related material and Watch Full action.
- Store CPS destinations securely and avoid logging credentials, private account data, or destination URLs.
- Keep imported RS information inside the operator's private admin workspace unless its public display is necessary for the authorized promotion.

## Prohibited or high-risk behavior

Do not implement or operate any of the following without specific written authorization from RS Boost:

- Bulk, recurring, unattended, or platform-wide crawling or scraping.
- Scraping or deep-linking that creates a service the same as or similar to RS Boost.
- Circumventing authentication, access controls, rate limits, anti-bot controls, or other technical restrictions.
- Sharing an RS account, password, cookie, session token, API token, or authenticated access with another person or third-party user.
- Making an import or scraping capability available to customers, collaborators, or the public.
- Selling, licensing, syndicating, or otherwise commercially exploiting RS information or materials outside the promotion expressly authorized by the terms.
- Publishing RS materials as a standalone streaming library or using them separately from the corresponding promoted link.
- Extracting or independently using audio, video clips, still images, trademarks, or other components in isolation from the integral Advertising Materials.
- Removing, blurring, covering, or changing trademarks, copyright notices, or other rights markings.
- Adding unrelated visual/audio content or unrelated commercial marks and links.
- Creating misleading, fraudulent, distorted, degraded, defamatory, or materially altered promotions.
- Re-dubbing, narrating, or spoiling Works or Advertising Materials without prior consent.
- Fraudulent, compulsory, inductive, automated, or otherwise dishonest clicks or traffic manipulation.
- Publishing to illegal, restricted-content, or minor-oriented destinations contrary to the terms.
- Importing earnings, payment information, account details, other creators' data, or unrelated platform data.

## Automation rules

Automation is not automatically authorized merely because the operator can view a page while signed in.

Before shipping any RS import, browser-control, API, crawler, downloader, or synchronization feature:

1. Define exactly which fields and assets it accesses.
2. Confirm each field is necessary for an authorized promotion.
3. Confirm the feature does not expose authenticated access or imported content to a third party.
4. Confirm materials remain paired with their Content Promotion Link.
5. Use the least access and lowest frequency required; do not perform speculative or bulk collection.
6. Do not read or persist passwords, cookies, browser storage, session tokens, or unrelated browsing/account data.
7. Obtain written RS Boost permission if the feature performs repeatable scraping, downloads content outside the normal provided workflow, uses a private API, or presents any ambiguity under these rules.
8. Record the permission and its scope in this document before enabling the feature in production.

## Content publication checklist

Every drama must satisfy all of these checks before publication:

- The drama and materials are currently available to the operator in RS Boost.
- The uploaded videos/images are the authorized Advertising Materials, not independently extracted components.
- The material has not been misleadingly altered and retains required marks.
- The correct Content Promotion Link is attached to the corresponding drama and Watch Full action.
- The promotion does not use dark patterns, forced clicks, fake claims, or misleading calls to action.
- The destination platform and audience comply with applicable law and age restrictions.
- Access to admin data and source materials remains private.

If any answer is uncertain, do not publish until RS Boost confirms permission in writing.

## Engineering review requirement

Any pull request or deployment that changes RS ingestion, media processing, public presentation, referral links, attribution, or account access must explicitly answer:

- What RS information or material does this change access?
- Is it necessary for an authorized promotion?
- Does it introduce scraping, third-party access, standalone use, or new commercial reuse?
- Is the corresponding Content Promotion Link preserved?
- Does this require written permission?

A reviewer must block deployment when these questions are unanswered or when the implementation conflicts with this document.

## Incident response

If unauthorized access, accidental public exposure, account sharing, unapproved scraping, or misuse of Advertising Materials is suspected:

1. Disable the affected feature or publication.
2. Preserve minimal diagnostic evidence without copying credentials or additional RS content.
3. Rotate any exposed credentials or tokens.
4. Document the scope and affected materials.
5. Contact RS Boost when notification or clarification is appropriate.

## Source and clarification

- Governing source reviewed: RS Boost Terms of Services, updated October 16, 2025, effective October 23, 2025.
- Particularly relevant provisions: Account II(1)–(3); Code of promotion conduct III(1)–(5).
- RS Boost support listed in the terms: `rsboostsupport@crazymaplestudio.com` and `reelshort.support@crazymaplestudio.com`.

Because the terms use broad language around scraping, third-party use, and commercial exploitation, written authorization is the required fallback whenever a planned feature is not clearly covered by the promotion license.
