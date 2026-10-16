import json
import os
import tempfile
from pathlib import Path
from urllib.parse import parse_qsl, parse_qs, urlparse

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont


class StoryUploadStarted(RuntimeError):
    pass


def _font(size):
    paths = [
        os.getenv("HOOK_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]
    for path in paths:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _cta_font(size):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf",
        os.getenv("HOOK_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ]
    for path in paths:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _draw_link_icon(image, left, top):
    icon = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    draw = ImageDraw.Draw(icon)
    draw.rounded_rectangle((9, 37, 59, 63), radius=13, outline=(255, 39, 174, 255), width=8)
    draw.rounded_rectangle((41, 37, 91, 63), radius=13, outline=(255, 126, 24, 255), width=8)
    icon = icon.rotate(-42, resample=Image.Resampling.BICUBIC)
    image.alpha_composite(icon, (left, top))


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
        background = background.convert("RGBA")
        cta = "TAP TO WATCH"
        cta_font = _cta_font(52)
        bounds = ImageDraw.Draw(background).textbbox((0, 0), cta, font=cta_font)
        text_width = bounds[2] - bounds[0]
        button_width = 112 + text_width + 24
        left, top = round((1080 - button_width) / 2), 970
        right, bottom = left + button_width, top + 104
        shadow = Image.new("RGBA", background.size, (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((left + 5, top + 9, right + 5, bottom + 9), radius=28, fill=(0, 0, 0, 110))
        background = Image.alpha_composite(background, shadow.filter(ImageFilter.GaussianBlur(10)))
        draw = ImageDraw.Draw(background, "RGBA")
        draw.rounded_rectangle((left, top, right, bottom), radius=28, fill="white")
        _draw_link_icon(background, left + 12, top + 2)
        text_top = top + ((bottom - top) - (bounds[3] - bounds[1])) / 2 - bounds[1]
        draw.text((left + 112, text_top), cta, font=cta_font, fill=(24, 24, 24, 255))
        background.convert("RGB").save(target, "JPEG", quality=94, optimize=True)
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


def _session_id(supabase):
    stored = supabase("rpc/get_instagram_story_session_id", method="POST", payload={})
    if isinstance(stored, str) and stored.strip():
        return stored.strip()
    return os.getenv("INSTAGRAM_SESSION_ID", "").strip()


def _story_links(story):
    links = getattr(story, "links", None) or []
    return [str(getattr(link, "webUri", "")) for link in links if getattr(link, "webUri", None)]


def _link_matches(expected, actual):
    actual_url = urlparse(actual)
    if actual_url.hostname in {"l.instagram.com", "lm.instagram.com"}:
        wrapped = parse_qs(actual_url.query).get("u", [])
        if wrapped:
            actual_url = urlparse(wrapped[0])
    expected_url = urlparse(expected)
    if (expected_url.scheme.lower(), expected_url.hostname, expected_url.path.rstrip("/")) != (
        actual_url.scheme.lower(), actual_url.hostname, actual_url.path.rstrip("/")
    ):
        return False
    return set(parse_qsl(expected_url.query)).issubset(set(parse_qsl(actual_url.query)))


def login_story_client(supabase):
    from instagrapi import Client

    username = os.getenv("INSTAGRAM_USERNAME", "").strip()
    password = os.getenv("INSTAGRAM_PASSWORD", "").strip()
    client = Client()
    session = _session(supabase)
    if session:
        client.set_settings(session)
        if username and password:
            client.login(username, password)
        else:
            client.get_timeline_feed()
    elif session_id := _session_id(supabase):
        client.login_by_sessionid(session_id)
    elif username and password:
        client.login(username, password)
    else:
        raise RuntimeError("Connect Instagram in Poster Publisher before starting the Story worker")
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
            links=[StoryLink(webUri=job["target_url"], x=0.5, y=0.532292, width=0.48, height=0.054167)],
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
        result["linkVerified"] = any(_link_matches(job["target_url"], value) for value in _story_links(fetched))
        story_username = getattr(getattr(fetched, "user", None), "username", None)
        if story_username:
            result["storyUrl"] = f"https://www.instagram.com/stories/{story_username}/{story_pk}/"
    except Exception as error:
        result["verificationError"] = str(error)[:500]
    return result
