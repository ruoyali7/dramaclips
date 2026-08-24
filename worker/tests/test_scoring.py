import unittest
from hook_worker.scoring import candidate_title,lexical_components,select_ranked,snap_windows
from hook_worker.direction import parse_direction,score_direction

class ScoringTests(unittest.TestCase):
 def test_windows_snap_to_scene_endings(self):
  windows=snap_windows([], [{"start":0,"end":12},{"start":12,"end":34},{"start":34,"end":61}],61)
  self.assertIn((12.0,34.0),windows)
 def test_conflict_and_tension_raise_components(self):
  parts,risk=lexical_components("you liar I hate you but I love you kiss me".split(),30,58,60)
  self.assertGreater(parts["conflict"],0);self.assertGreater(parts["tension"],0);self.assertEqual(risk,"low")
 def test_deduplicates_overlapping_ranges(self):
  base={"episodeNumber":1,"text":"you lied to me and now I know the truth","score":80}
  ranked=select_ranked([{**base,"start":0,"end":30},{**base,"start":5,"end":34,"score":79},{**base,"episodeNumber":2,"text":"kiss me before your brother learns my secret","start":0,"end":30,"score":70}],2)
  self.assertEqual(len(ranked),2);self.assertEqual(ranked[1]["episodeNumber"],2)
 def test_quality_gate_matches_weighted_score_scale(self):
  raw=[{"episodeNumber":1,"text":"ordinary dialogue","start":0,"end":30,"score":21.9},{"episodeNumber":2,"text":"the truth is I love you","start":0,"end":30,"score":22.0}]
  ranked=select_ranked(raw,2)
  self.assertEqual([item["episodeNumber"] for item in ranked],[2])
 def test_direction_parser_supports_natural_language_and_exclusions(self):
  schema=parse_direction("Focus on romantic jealousy and a cliffhanger. Must include tutor. Avoid kiss.")
  self.assertIn("tension",schema["signals"]);self.assertIn("cliffhanger",schema["signals"])
  self.assertEqual(schema["mustInclude"],["tutor"]);self.assertEqual(schema["avoid"],["kiss"])
 def test_direction_match_rejects_missing_required_or_avoided_content(self):
  schema=parse_direction("Romantic tension. Must include tutor. Avoid kiss.")
  good=score_direction(schema,"the tutor says I want you",{"tension":80})
  bad=score_direction(schema,"the tutor says kiss me",{"tension":80})
  self.assertTrue(good["eligible"]);self.assertFalse(bad["eligible"]);self.assertEqual(bad["evidence"]["excluded"],["kiss"])
 def test_blank_direction_preserves_default_path(self):
  result=score_direction(parse_direction(""),"ordinary dialogue",{"tension":0})
  self.assertTrue(result["eligible"]);self.assertIsNone(result["score"])
 def test_direction_supports_starting_timestamp(self):
  schema=parse_direction("从 02:15 开始后面的剧情")
  self.assertEqual(schema["timeRange"],{"start":135,"end":None})
  self.assertFalse(score_direction(schema,"dialogue",{},100,120)["eligible"])
  self.assertTrue(score_direction(schema,"dialogue",{},140,160)["eligible"])
 def test_direction_supports_bounded_timestamp(self):
  schema=parse_direction("只看 02:15-03:10 内的剧情")
  self.assertEqual(schema["timeRange"],{"start":135,"end":190})
  self.assertTrue(score_direction(schema,"dialogue",{},145,165)["eligible"])
  self.assertFalse(score_direction(schema,"dialogue",{},195,215)["eligible"])
 def test_candidate_title_uses_selected_clip_dialogue(self):
  title=candidate_title("you sent that maid to me but I never betrayed you the truth is different","cliffhanger")
  self.assertIn("betrayed",title.lower());self.assertNotEqual(title,"What happens next is shocking")
 def test_candidate_title_falls_back_without_dialogue(self):
  self.assertEqual(candidate_title("visual-scene-episode-1-0-20","cliffhanger"),"A secret is about to come out")

if __name__=="__main__":unittest.main()
