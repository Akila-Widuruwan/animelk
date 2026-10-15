/**
 * Episode-number rules.
 *
 * Run: node scripts/check-episode-numbers.mjs
 *
 * Episodes are not always whole: a split cour has 12, 12.5, 13, 13.5, and a
 * part 2 continues at 13 instead of restarting at 1. These checks cover the
 * helpers the admin panel and the public pages rely on.
 */
import {
  episodeLabel,
  episodeNeighbours,
  episodeNumbers,
  halfEpisodeAfter,
  nextEpisodeNumber,
  parseEpisodeNumberText,
  resolveEpisodeNumber,
  sanitizeEpisodeNumberText,
  tidyEpisodeNumberText,
} from "../src/lib/episode-number.ts";

let failed = 0;

function is(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failed++;
    console.log(`✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${label}`);
  }
}

// What an admin types into the episode box.
is(parseEpisodeNumberText("13"), 13, 'parses "13"');
is(parseEpisodeNumberText("13.5"), 13.5, 'parses "13.5"');
is(parseEpisodeNumberText("1.5"), 1.5, 'parses "1.5"');
is(parseEpisodeNumberText("13."), 13, 'parses the half-typed "13."');
is(parseEpisodeNumberText(" 2.5 "), 2.5, 'ignores surrounding spaces');
is(parseEpisodeNumberText(""), null, "rejects an empty box");
is(parseEpisodeNumberText("abc"), null, "rejects letters");
is(parseEpisodeNumberText("-1"), null, "rejects a negative number");
is(parseEpisodeNumberText("1.2.3"), null, "rejects two decimal points");

// Stray characters never reach the parser.
is(sanitizeEpisodeNumberText("1a.5b"), "1.5", "drops letters");
is(sanitizeEpisodeNumberText("1.2.3"), "1.23", "keeps a single decimal point");
is(sanitizeEpisodeNumberText("13"), "13", "keeps whole numbers");

// The box tidies itself when the admin clicks away.
is(tidyEpisodeNumberText("13.50"), "13.5", 'tidies "13.50" to "13.5"');
is(tidyEpisodeNumberText("13."), "13", 'tidies "13." to "13"');
is(tidyEpisodeNumberText("13.0"), "13", 'tidies "13.0" to "13"');

// Which number to offer next.
is(nextEpisodeNumber([]), 1, "the first episode is 1");
is(nextEpisodeNumber([1, 2, 3, 4]), 5, "a whole run continues at 5");
is(nextEpisodeNumber([12.5]), 13, "a half episode continues at 13");
is(nextEpisodeNumber([1, 1.5, 2, 2.5]), 3, "a split cour continues at 3");
is(halfEpisodeAfter(1), 1.5, "the half episode after 1 is 1.5");
is(halfEpisodeAfter(1.5), 2, "the half episode after 1.5 is 2");

// Labels.
is(episodeLabel(13), "13", "labels a whole number");
is(episodeLabel(13.5), "13.5", "labels a half episode");
is(episodeLabel("13.5"), "13.5", "labels a half episode from the database");

// The list of episodes that exist.
is(
  episodeNumbers([{ episode_number: 2 }, { episode_number: "1.5" }, { episode_number: 1 }]),
  [1, 1.5, 2],
  "sorts and de-duplicates the numbers that exist"
);
is(
  episodeNumbers([{ episode_number: "13" }, { episode_number: "13.5" }]),
  [13, 13.5],
  "keeps a part 2 and its half episode"
);

// Opening an episode.
is(resolveEpisodeNumber("1.5", [1, 1.5, 2]), 1.5, "opens the requested half episode");
is(resolveEpisodeNumber(null, [13, 14]), 13, "opens the first episode that exists");
is(
  episodeNeighbours([1, 1.5, 2], 1.5),
  { prev: 1, next: 2 },
  "steps through the list, not through ep ± 1"
);

if (failed > 0) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll episode-number checks passed");
