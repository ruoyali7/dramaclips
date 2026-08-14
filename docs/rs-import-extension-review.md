# RS import extension engineering review

- **Information accessed:** One operator-selected RS Boost drama detail page: title, description, language, tags, cover URL, episode counts, Content Referral Code, and Content Promotion Link.
- **Purpose:** Populate the private DramaClips onboarding form for a drama the operator is authorized to promote.
- **Automation scope:** One foreground, user-triggered page at a time. No bulk, recurring, background, speculative, or account-wide collection.
- **Account access:** The extension never reads or persists passwords, cookies, browser storage, session tokens, earnings, or unrelated account information.
- **Third-party access:** None. The extension is loaded unpacked in the operator's own Chrome profile and the imported fields remain in the protected admin workspace until separately reviewed and published.
- **Promotion link:** The Content Promotion Link is imported into the encrypted CPS destination field and remains paired with the corresponding drama and Watch Full action.
- **Operator decision:** The operator explicitly directed development to proceed for their own private extension use on 2026-08-12.
