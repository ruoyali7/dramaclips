import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from hook_worker.media import ending_frame_timestamps, extract_ending_frame, video_timing


class MediaTests(unittest.TestCase):
    def test_video_timing_prefers_video_stream_over_longer_container(self):
        info = {
            "streams": [{"codec_type": "video", "duration": "238.500000", "avg_frame_rate": "24/1"}],
            "format": {"duration": "238.507007"},
        }
        self.assertEqual(video_timing(info), (238.5, 24.0))

    def test_ending_timestamp_stays_before_last_video_frame(self):
        stamps = ending_frame_timestamps(200, 238.507007, 238.5, 24)
        self.assertLessEqual(stamps[0], 238.5 - 2 / 24)
        self.assertEqual(stamps[-1], stamps[0] - 1)

    @patch("hook_worker.media.subprocess.run")
    def test_extraction_retries_earlier_timestamp(self, run):
        with TemporaryDirectory() as directory:
            target = Path(directory) / "ending.jpg"

            def attempt(command, **kwargs):
                stamp = float(command[command.index("-ss") + 1])
                if stamp < 238.4:
                    target.write_bytes(b"frame")
                    return type("Result", (), {"returncode": 0, "stderr": ""})()
                return type("Result", (), {"returncode": 234, "stderr": "no frame"})()

            run.side_effect = attempt
            stamp = extract_ending_frame("episode.mp4", target, 200, 238.507007, 238.5, 24)
            self.assertLess(stamp, 238.4)
            self.assertGreater(run.call_count, 1)


if __name__ == "__main__":
    unittest.main()
