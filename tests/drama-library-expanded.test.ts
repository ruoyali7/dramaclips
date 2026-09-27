import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DramaLibraryExpanded } from "@/components/admin/drama-library-expanded";

describe("publish library cart state", () => {
  it("uses the same visible added state for original episodes and hooks", () => {
    vi.stubGlobal("React", React);
    const html = renderToStaticMarkup(React.createElement(DramaLibraryExpanded, {
      episodes: [{ id: "original:drama:1", episodeNumber: 1, videoUrl: "https://video.test/1.mp4", generated: false, inCart: true }],
      hooks: [{ id: "hook-1", title: "Hook 1", episodes: [1], generator: "Vizard", status: "Saved", inCart: true }],
      onPreviewEpisode: () => {},
      onAddEpisodeToCart: () => {},
      onAddHookToCart: () => {},
    }));

    expect(html).toContain('class="episode-cart-button library-cart-button added" disabled="">Added</button>');
    expect(html).toContain('class="hook-cart-button library-cart-button added" disabled="">Added</button>');
    expect(html).toContain('class="in-cart"');
    expect(html).toContain('class="drama-hook-row in-cart"');
    vi.unstubAllGlobals();
  });
});
