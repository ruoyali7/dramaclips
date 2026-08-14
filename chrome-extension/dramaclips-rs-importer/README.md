# DramaClips RS Importer

Private, user-triggered Chrome extension for importing one RS Boost drama detail page into the DramaClips admin form.

## Install once

1. Open `chrome://extensions` in the Chrome profile that is signed in to RS Boost.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this `chrome-extension/dramaclips-rs-importer` directory.
5. Refresh the DramaClips Add Drama page. It should show **Extension connected**.

## Use

Paste one `cps.reelshort.com/resource-square/detail/...` link into Add Drama and click **Import & autofill**. The extension opens that page, reads only visible promotion metadata, closes it, returns to DramaClips, and fills the form for review.

The extension does not read cookies, passwords, browser storage, earnings, or unrelated account pages. It does not run bulk or unattended imports.
