/**
 * Loads the Monetag tag for this site, keeps it off for MUTE_MS after the
 * visitor clicks an ad, and keeps it off for the site owner's own account.
 *
 * The layout loads this file from <head> instead of pasting Monetag's snippet,
 * for two reasons. Next.js never writes inline script markup into the server
 * HTML, so the snippet has nowhere to live there; and a file can make the
 * cooldown decision before a single ad request leaves the browser, which is the
 * only way to actually keep ads off rather than hide them after the fact.
 *
 * The owner's account is read straight out of the Supabase session that the
 * site already stores in localStorage, because this file runs long before any
 * React component — and therefore before the signed-in visitor is known to the
 * app. That is the point: the decision has to be made before the tag loads, so
 * the owner never even requests an ad.
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
  // Written by the site's own React code (see @/lib/ad-free) after it asks
  // Supabase whether the signed-in viewer is on the ad-free list. It lives in
  // localStorage because this file runs before React does, and having the
  // answer here is what lets the tag be stopped instead of hidden afterwards.
  var AD_OFF_KEY = "animelk:ads-off";
  var MUTE_MS = 10 * 60 * 1000;
  var AD_Z = 2e9; // Monetag pins its overlays above everything else.
  var CLICK_GRACE_MS = 1500; // A pop-under steals focus right after the click.

  // No ads at all for these accounts. Matched case-insensitively.
  var AD_FREE_EMAILS = ["akilawiduruwan@gmail.com"];

  // Supabase's client keeps the signed-in session in localStorage under
  // `sb-<project-ref>-auth-token` (its default derivation, from the Supabase
  // URL's first host label). Oversized values are split into `.<n>` chunks.
  var AUTH_KEY_RE = /^sb-.*-auth-token(?:\.\d+)?$/;
  var SESSION_EMAIL_RE = /"email"\s*:\s*"([^"\\]+)"/;
  var WAIT_STEP_MS = 100;
  var WAIT_MS = 4000; // Upper bound on the OAuth-return wait only.

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

  /**
   * The signed-in address, read from the session Supabase persists locally —
   * the only synchronous way to know who this browser belongs to this early.
   * Returns null when nobody is signed in, or when storage is unavailable.
   */
  function sessionEmail() {
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var key = window.localStorage.key(i);
        if (!key || !AUTH_KEY_RE.test(key)) continue;
        var raw = window.localStorage.getItem(key);
        if (!raw) continue;
        // The owner check doubles as the fallback: whatever the stored shape
        // is, the address is in there verbatim.
        if (isAdFree(raw)) return ownerEmail();
        var match = SESSION_EMAIL_RE.exec(raw);
        if (match) return match[1];
      }
    } catch (e) {
      /* no storage to read (private mode, blocked cookies) */
    }
    return null;
  }

  function ownerEmail() {
    return AD_FREE_EMAILS[0];
  }

  function isAdFree(value) {
    if (!value) return false;
    var haystack = String(value).toLowerCase();
    for (var i = 0; i < AD_FREE_EMAILS.length; i++) {
      if (haystack.indexOf(AD_FREE_EMAILS[i]) !== -1) return true;
    }
    return false;
  }

  /** The ad-free answer the site cached for the signed-in viewer, if still fresh. */
  function cachedAdFreeEmail() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(AD_OFF_KEY) || "null");
      var email = parsed && parsed.email;
      var until = Number(parsed && parsed.until) || 0;
      if (typeof email !== "string" || until <= Date.now()) return null;
      return email;
    } catch (e) {
      return null;
    }
  }

  /**
   * True when this address never gets ads: either it is listed in this file (the
   * owner's own account, which is never at the mercy of a network call), or the
   * admin panel has added it and the site has cached that answer.
   */
  function adFreeFor(email) {
    if (!email) return false;
    if (isAdFree(email)) return true;
    var cached = cachedAdFreeEmail();
    return !!cached && cached.toLowerCase() === email.toLowerCase();
  }

  /**
   * True on the page Google sends the visitor back to. Supabase redeems the
   * `code` (or reads the implicit-flow tokens out of the hash) after the
   * document has started loading, so the session lands in storage a moment
   * after this file runs.
   */
  function oauthReturn() {
    var search = window.location.search || "";
    var hash = window.location.hash || "";
    return (
      /[?&](code|error|error_description)=/.test(search) ||
      /(^|[#&])(access_token|error|error_description)=/.test(hash)
    );
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

  /** Watches for units that arrive after this file has run. */
  function watchUnits() {
    if (!window.MutationObserver) return;
    var observer = new MutationObserver(hideUnits);
    observer.observe(document.documentElement, { childList: true });
    var body = function () {
      if (!document.body) return;
      hideUnits();
      observer.observe(document.body, { childList: true });
    };
    if (document.body) body();
    else document.addEventListener("DOMContentLoaded", body);
  }

  /**
   * The tag registers Monetag's push worker from /sw.js. When the tag is not
   * loaded nothing new is registered, but a registration left behind by an
   * earlier visit (or by the same browser before signing in) keeps delivering
   * push ads, so it is dropped along with the tag.
   */
  function dropPushWorker() {
    var sw = navigator.serviceWorker;
    if (!sw || !sw.getRegistrations) return;
    sw.getRegistrations()
      .then(function (registrations) {
        for (var i = 0; i < registrations.length; i++) {
          var workers = [
            registrations[i].active,
            registrations[i].installing,
            registrations[i].waiting,
          ];
          for (var j = 0; j < workers.length; j++) {
            var url = workers[j] && workers[j].scriptURL;
            if (url && /\/sw\.js(\?|$)/.test(url)) {
              registrations[i].unregister();
              break;
            }
          }
        }
      })
      .catch(function () {
        /* nothing registered, or the browser refused the lookup */
      });
  }

  /** No tag, and nothing of the tag's left on screen. */
  function keepOff() {
    hideUnits();
    watchUnits();
    dropPushWorker();
  }

  function loadTag() {
    var tag = document.createElement("script");
    tag.id = "monetag-tag";
    tag.async = true;
    tag.src = TAG_SRC;
    tag.setAttribute("data-zone", ZONE);
    tag.setAttribute("data-cfasync", "false");
    (document.head || document.documentElement).appendChild(tag);
  }

  /** Waits for the session the OAuth callback writes, then decides again. */
  function waitForSession() {
    var waited = 0;
    var timer = window.setInterval(function () {
      waited += WAIT_STEP_MS;
      var email = sessionEmail();
      if (email) {
        window.clearInterval(timer);
        if (adFreeFor(email)) keepOff();
        else loadTag();
      } else if (waited >= WAIT_MS) {
        window.clearInterval(timer);
        loadTag();
      }
    }, WAIT_STEP_MS);
  }

  var signedInAs = sessionEmail();
  if (muted() || adFreeFor(signedInAs)) {
    keepOff();
  } else if (!signedInAs && oauthReturn()) {
    waitForSession();
  } else {
    loadTag();
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
    sessionEmail: sessionEmail,
    adFree: function () {
      return adFreeFor(sessionEmail());
    },
    adFreeEmails: AD_FREE_EMAILS.slice(),
    cachedAdFree: cachedAdFreeEmail,
    adFreeKey: AD_OFF_KEY,
  };
})();
