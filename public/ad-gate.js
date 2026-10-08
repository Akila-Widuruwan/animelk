/**
 * Loads the Monetag tag for this site, and keeps it off for MUTE_MS after the
 * visitor clicks an ad.
 *
 * The layout loads this file from <head> instead of pasting Monetag's snippet,
 * for two reasons. Next.js never writes inline script markup into the server
 * HTML, so the snippet has nowhere to live there; and a file can make the
 * cooldown decision before a single ad request leaves the browser, which is the
 * only way to actually keep ads off rather than hide them after the fact.
 *
 * An ad click is assumed to have happened when
 *   1. the ad unit itself was clicked, recognised by the absurd z-index
 *      Monetag pins its overlays at, or
 *   2. something called window.open, which is how a pop-under is opened, or
 *   3. the page lost focus or became hidden within CLICK_GRACE_MS of a click,
 *      which is what a pop-under does to the page behind it.
 * All three are heuristics: the ad runs in code we do not control.
 */
(function () {
  var ZONE = "292661";
  var TAG_SRC = "https://quge5.com/88/tag.min.js";
  var STORE_KEY = "animelk:ads-muted-until";
  var MUTE_MS = 10 * 60 * 1000;
  var AD_Z = 2e9; // Monetag pins its overlays above everything else.
  var CLICK_GRACE_MS = 1500; // A pop-under steals focus right after the click.

  function readMuteUntil() {
    try {
      return Number(window.localStorage.getItem(STORE_KEY)) || 0;
    } catch (e) {
      return 0; // Private mode without storage: never mute.
    }
  }

  function muted() {
    return Date.now() < readMuteUntil();
  }

  /**
   * The site's own video player portals at z-index 2147483647 as well, so its
   * menu portal and its player frame are excluded before any z-index test.
   */
  function isOurs(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hasAttribute && n.hasAttribute("data-movi-menu-portal")) return true;
      if (n.tagName === "IFRAME" && /abyssplayer\.com/.test(n.src || "")) {
        return true;
      }
    }
    return false;
  }

  function adUnit(el) {
    if (!el || el.nodeType !== 1 || isOurs(el)) return null;
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var style;
      try {
        style = window.getComputedStyle(n);
      } catch (e) {
        continue;
      }
      if (style.position === "fixed" && parseInt(style.zIndex, 10) >= AD_Z) {
        return n;
      }
    }
    return null;
  }

  /** Hides the units already on the page. Only direct children are inspected. */
  function hideUnits() {
    var parents = [document.documentElement, document.body];
    for (var i = 0; i < parents.length; i++) {
      var parent = parents[i];
      if (!parent) continue;
      for (var kids = parent.children, j = 0; j < kids.length; j++) {
        var unit = adUnit(kids[j]);
        if (unit) unit.style.setProperty("display", "none", "important");
      }
    }
  }

  function startMute() {
    try {
      window.localStorage.setItem(STORE_KEY, String(Date.now() + MUTE_MS));
    } catch (e) {
      /* nothing to persist to */
    }
    hideUnits();
  }

  // --- telling an ad click apart from a normal one ------------------------
  var clickedAt = 0;
  document.addEventListener(
    "click",
    function (event) {
      clickedAt = Date.now();
      if (adUnit(event.target)) startMute();
    },
    true
  );

  document.addEventListener("visibilitychange", function () {
    if (
      document.visibilityState === "hidden" &&
      clickedAt &&
      Date.now() - clickedAt < CLICK_GRACE_MS
    ) {
      startMute();
    }
  });

  window.addEventListener("blur", function () {
    if (clickedAt && Date.now() - clickedAt < CLICK_GRACE_MS) startMute();
  });

  var nativeOpen = window.open;
  window.open = function () {
    startMute();
    return nativeOpen.apply(this, arguments);
  };

  // --- load, or don't ----------------------------------------------------
  if (muted()) {
    hideUnits();
    // Late units still get hidden; only direct children are watched.
    if (window.MutationObserver) {
      var observer = new MutationObserver(hideUnits);
      observer.observe(document.documentElement, { childList: true });
      if (document.body) observer.observe(document.body, { childList: true });
    }
  } else {
    var tag = document.createElement("script");
    tag.id = "monetag-tag";
    tag.async = true;
    tag.src = TAG_SRC;
    tag.setAttribute("data-zone", ZONE);
    tag.setAttribute("data-cfasync", "false");
    (document.head || document.documentElement).appendChild(tag);
  }

  // Handy from the console, and used by the site's own checks.
  window.__adGate = {
    muted: muted,
    mutedUntil: readMuteUntil,
    clear: function () {
      try {
        window.localStorage.removeItem(STORE_KEY);
      } catch (e) {
        /* nothing to clear */
      }
    },
  };
})();
