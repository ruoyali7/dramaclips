# Instagram Story publishing

Poster Publisher can queue its Instagram poster as a Story. The worker recreates the saved 1080 × 1350 poster with its Content Code and calls `instagrapi` with the direct `reelslink.com` URL extracted from the Instagram caption:

```python
client.photo_upload_to_story(
    poster_path,
    links=[StoryLink(webUri=reelshort_url)],
)
```

The worker places the existing 1080 × 1350 Poster Publisher artwork on a 1080 × 1920 Story canvas before upload, so the Content Code is not cropped.

The worker image installs instagrapi 2.4.5 without dependency resolution because that release contains the Link Sticker fix but declares a Requests version that its current package index does not publish. The runtime dependencies are pinned separately in `worker/requirements.txt`.

Apply `202610140001_instagram_story_publishing.sql`, then configure the scheduled Railway publishing services with:

- `ENABLE_INSTAGRAM_STORY_WORKER=true`
- `INSTAGRAM_USERNAME`
- `INSTAGRAM_PASSWORD`
- optionally `INSTAGRAM_SESSION_JSON` for the first run

After login, refreshed instagrapi session settings are stored in Supabase Vault as `dramaclips_instagram_story_session`. If Instagram requires a login challenge, complete it outside the unattended worker and provide the resulting session JSON before enabling the worker.

An upload-stage exception is recorded as `outcome_unknown` and is not automatically retried. Check the Instagram account before scheduling another Story.
