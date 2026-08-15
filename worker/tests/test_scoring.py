import unittest
from hook_worker.scoring import lexical_components,select_ranked,snap_windows

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
  raw=[{"episodeNumber":1,"text":"ordinary dialogue","start":0,"end":30,"score":26.9},{"episodeNumber":2,"text":"the truth is I love you","start":0,"end":30,"score":27.0}]
  ranked=select_ranked(raw,2)
  self.assertEqual([item["episodeNumber"] for item in ranked],[2])

if __name__=="__main__":unittest.main()
