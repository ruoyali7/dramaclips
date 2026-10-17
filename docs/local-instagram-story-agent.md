# Local Instagram Story agent

Instagram Story publishing runs from the operator's home Mac so the account keeps one network location, device profile, and complete instagrapi session. Railway must keep `ENABLE_INSTAGRAM_STORY_WORKER=false`.

The installed LaunchAgent is `com.dramaclips.instagram-story`. It runs once per minute, leases work from Supabase, and exits. With no request or due Story it does not contact Instagram.

## One-time login

Run this only when Instagram requires local verification:

```bash
"$HOME/Library/Application Support/DramaClips/agent/login.zsh"
```

The command prompts locally for the password and verification code. It saves only the resulting device session to Supabase Vault. The password is not saved.

After login, open `/admin/posters` on iPhone and select **Start today's Stories**. The Mac validates the saved session. The page then creates the five-Story schedule.

## Safety behavior

If session validation fails, the agent creates `~/Library/Application Support/DramaClips/instagram-story-auth-blocked` and stops contacting Instagram. A successful one-time login removes that file.

Logs:

- `~/Library/Logs/DramaClips/instagram-story.log`
- `~/Library/Logs/DramaClips/instagram-story-error.log`
