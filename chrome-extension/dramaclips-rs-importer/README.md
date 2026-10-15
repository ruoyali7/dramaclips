# DramaClips RS Importer

Private, user-triggered Chrome extension for importing one RS Boost drama detail page into the DramaClips admin form.

## Install once

1. Open `chrome://extensions` in the Chrome profile that is signed in to RS Boost.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this `chrome-extension/dramaclips-rs-importer` directory.
5. Refresh the DramaClips admin page. Add Drama should show **Extension connected**.

## Use

Paste one `cps.reelshort.com/resource-square/detail/...` link into Add Drama and click **Import details & free videos**. The extension opens that page, reads its promotion metadata and the MP4 URLs behind **Download Free Contents**, closes it, returns to DramaClips, fills the form, and transfers those free videos directly to R2 for review.

The RS login token stays inside the signed-in RS tab. Only the requested drama metadata and free video URLs are returned to DramaClips.

The extension reads the existing RS login token only to request the selected drama from RS; it never sends that token to DramaClips.

## Connect Instagram Stories

1. Open the DramaClips **Poster Publisher** page.
2. Click **Open Instagram login** and sign in on Instagram's official page.
3. Return to Poster Publisher and click **Connect signed-in account**.

Only after that click, the extension reads Instagram's `sessionid` cookie and sends it to the authenticated DramaClips admin endpoint. DramaClips stores it as an encrypted Supabase Vault secret for the Story worker. The page never receives or displays the cookie, and the extension never reads the Instagram password.
