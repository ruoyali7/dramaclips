import json
import os
import tempfile
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont


class StoryUploadStarted(RuntimeError):
    pass


def _font(size):
    path = os.getenv("HOOK_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def render_poster(source_url, content_code, target):
    response = requests.get(source_url, timeout=(30, 120))
    response.raise_for_status()
    source_path = target.with_suffix(".source")
    source_path.write_bytes(response.content)
    with Image.open(source_path) as source:
        image = source.convert("RGB")
        width, height = 1080, 1350
        scale = max(width / image.width, height / image.height)
        resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
        left = (resized.width - width) // 2
        top = (resized.height - height) // 2
        poster = resized.crop((left, top, left + width, top + height))
        draw = ImageDraw.Draw(poster)
        label = f"CONTENT CODE · {content_code}"
        font = _font(30)
        bounds = draw.textbbox((0, 0), label, font=font)
        label_width = bounds[2] - bounds[0] + 48
        draw.rectangle((34, 34, 34 + label_width, 100), fill=(0, 0, 0, 194))
        draw.text((58, 52), label, font=font, fill="white")
        background = poster.resize((1080, 1920), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(32))
        shade = Image.new("RGBA", background.size, (0, 0, 0, 105))
        background = Image.alpha_composite(background.convert("RGBA"), shade).convert("RGB")
        background.paste(poster, (0, (1920 - height) // 2))
        background.save(target, "JPEG", quality=94, optimize=True)
    return target


def _session(supabase):
    stored = supabase("rpc/get_instagram_story_session", method="POST", payload={})
    if isinstance(stored, dict):
        return stored
    raw = os.getenv("INSTAGRAM_SESSION_JSON", "").strip()
    if raw:
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise RuntimeError("INSTAGRAM_SESSION_JSON must be a JSON object")
        return value
    return None


def _story_links(story):
    links = getattr(story, "links", None) or []
    return [str(getattr(link, "webUri", "")) for link in links if getattr(link, "webUri", None)]


def login_story_client(supabase):
    from instagrapi import Client

    username = os.getenv("INSTAGRAM_USERNAME", "").strip()
    password = os.getenv("INSTAGRAM_PASSWORD", "").strip()
    if not username or not password:
        raise RuntimeError("INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD are required")

    client = Client()
    session = _session(supabase)
    if session:
        client.set_settings(session)
    client.login(username, password)
    supabase("rpc/save_instagram_story_session", method="POST", payload={"p_session": client.get_settings()})
    return client


def publish_story(job, supabase, client=None):
    from instagrapi.types import StoryLink

    client = client or login_story_client(supabase)
    username = os.getenv("INSTAGRAM_USERNAME", "").strip()

    root = Path(tempfile.mkdtemp(prefix="drama-story-", dir=os.getenv("WORK_DIR", "/tmp")))
    poster = render_poster(job["image_url"], job["content_code"], root / f"story-{job['id']}.jpg")
    try:
        story = client.photo_upload_to_story(
            poster,
            links=[StoryLink(webUri=job["target_url"])],
        )
    except Exception as error:
        raise StoryUploadStarted(str(error)) from error
    story_pk = str(getattr(story, "pk", None) or getattr(story, "id", ""))
    if not story_pk:
        raise StoryUploadStarted("Instagram accepted the Story but returned no Story id")

    result = {
        "storyPk": story_pk,
        "storyUrl": f"https://www.instagram.com/stories/{username}/{story_pk}/",
        "targetUrl": job["target_url"],
        "linkVerified": False,
    }
    try:
        fetched = client.story_info(story_pk)
        result["linkVerified"] = job["target_url"].rstrip("/") in {value.rstrip("/") for value in _story_links(fetched)}
    except Exception as error:
        result["verificationError"] = str(error)[:500]
    return result
