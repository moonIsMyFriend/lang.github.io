/* 궤적(line) 모듈 */
(function (global) {
  function create(ctx) {
    var wrapper = ctx.wrapper;
    var trailIntroEl = ctx.trailIntroEl;
    var trailActiveEl = ctx.trailActiveEl;
    var introTrailPts = [];
    var activeTrailPts = [];
    var trailFrozen = false;
    var trailMaxDocVw = null;
    var trailOn = false;
    var trailUseActive = false;
    var lastTrailPage = -1;
    var introTrailScrollBase = 0;
    var moonTrailFade = 1;
    var moonFadeAnimId = null;

    function pageWidth() {
      return ctx.pageWidth();
    }
    function readIndex() {
      return ctx.readIndex();
    }
    function pageCenterInViewport(pageIndex) {
      return ctx.pageCenterInViewport(pageIndex);
    }

    function trailClear() {
      introTrailPts = [];
      activeTrailPts = [];
      trailFrozen = false;
      trailMaxDocVw = null;
      introTrailScrollBase = 0;
      if (trailIntroEl) trailIntroEl.setAttribute("d", "");
      if (trailActiveEl) trailActiveEl.setAttribute("d", "");
    }

    function trailClearActive() {
      activeTrailPts = [];
      if (trailActiveEl) trailActiveEl.setAttribute("d", "");
    }

    function trailClearIntro() {
      introTrailPts = [];
      trailFrozen = false;
      trailMaxDocVw = null;
      introTrailScrollBase = 0;
      if (trailIntroEl) trailIntroEl.setAttribute("d", "");
    }

    function trailBeginIntro() {
      introTrailScrollBase = trailScrollVw();
    }

    function trailTrimIntroToDistanceCenter() {
      var end = pageCenterInViewport(1);
      var centerDoc = end.x + introTrailScrollBase;
      trailMaxDocVw = centerDoc + 6;
      while (
        introTrailPts.length &&
        introTrailPts[introTrailPts.length - 1].docVw > trailMaxDocVw + 0.5
      ) {
        introTrailPts.pop();
      }
    }

    function trailScrollVw() {
      var vw = pageWidth();
      if (vw < 1) return 0;
      return (wrapper.scrollLeft / vw) * 100;
    }

    function buildTrailPath(pts, opts) {
      opts = opts || {};
      if (pts.length < 2) return "";
      var vw = window.innerWidth || 1;
      var scrollVw = trailScrollVw();
      var minDoc = opts.pageClip ? scrollVw : -Infinity;
      var maxDoc =
        opts.maxDocVw != null ? opts.maxDocVw : Infinity;
      if (opts.pageClip) {
        maxDoc = Math.min(maxDoc, scrollVw + 100);
      }
      var d = "";
      var started = false;
      var i;
      for (i = 0; i < pts.length; i++) {
        if (pts[i].docVw < minDoc - 0.5) continue;
        if (pts[i].docVw > maxDoc + 0.5) break;
        var px = ((pts[i].docVw - scrollVw) / 100) * vw;
        var py = pts[i].py;
        d += (started ? " L" : "M") + px + " " + py;
        started = true;
      }
      if (!started || d.indexOf("L") === -1) return "";
      return d;
    }

    function introTrailRenderOpts() {
      if (!trailFrozen) return {};
      if (readIndex() === 0) return { maxDocVw: null };
      if (readIndex() === 1) {
        return {
          maxDocVw: trailMaxDocVw,
          pageClip: true,
        };
      }
      return { maxDocVw: trailMaxDocVw };
    }

    function activeTrailRenderOpts() {
      if (readIndex() === 1) {
        return {
          maxDocVw: trailScrollVw() + 100,
          pageClip: true,
        };
      }
      return {};
    }

    function applyTrailOpacity() {
      var introOp = 0.75 * moonTrailFade;
      var activeOp = 0.85 * moonTrailFade;
      if (trailIntroEl) trailIntroEl.style.opacity = String(introOp);
      if (trailActiveEl) trailActiveEl.style.opacity = String(activeOp);
    }

    function renderTrail() {
      if (trailIntroEl) {
        trailIntroEl.setAttribute(
          "d",
          buildTrailPath(introTrailPts, introTrailRenderOpts())
        );
      }
      if (trailActiveEl) {
        trailActiveEl.setAttribute(
          "d",
          buildTrailPath(activeTrailPts, activeTrailRenderOpts())
        );
      }
      applyTrailOpacity();
    }

    function beginMoonLandingTrailFade(durationMs, cb) {
      if (moonFadeAnimId) {
        cancelAnimationFrame(moonFadeAnimId);
        moonFadeAnimId = null;
      }
      var t0 = performance.now();
      function step(now) {
        var t = Math.min(1, (now - t0) / durationMs);
        moonTrailFade = 1 - easeOutQuad(t);
        renderTrail();
        if (t < 1) {
          moonFadeAnimId = requestAnimationFrame(step);
        } else {
          moonFadeAnimId = null;
          moonTrailFade = 0;
          trailClearActive();
          if (trailIntroEl) trailIntroEl.setAttribute("d", "");
          applyTrailOpacity();
          if (cb) cb();
        }
      }
      function easeOutQuad(u) {
        return 1 - (1 - u) * (1 - u);
      }
      moonFadeAnimId = requestAnimationFrame(step);
    }

    function resetMoonTrailFade() {
      if (moonFadeAnimId) {
        cancelAnimationFrame(moonFadeAnimId);
        moonFadeAnimId = null;
      }
      moonTrailFade = 1;
      applyTrailOpacity();
    }

    function trailPushTo(pts, p, scrollBase) {
      var vw = window.innerWidth || 1;
      var vh = window.innerHeight || 1;
      var sv = scrollBase != null ? scrollBase : trailScrollVw();
      var docVw = p.x + sv;
      var py = (p.y / 100) * vh;
      var n = pts.length;
      if (n > 0) {
        var lp = pts[n - 1];
        var dxPx = ((docVw - lp.docVw) / 100) * vw;
        var dy = py - lp.py;
        if (dxPx * dxPx + dy * dy < 36) return;
      }
      pts.push({ docVw: docVw, py: py });
      if (pts.length > 180) pts.shift();
    }

    function trailPushVw(p) {
      if (trailFrozen || trailUseActive) return;
      trailPushTo(introTrailPts, p, introTrailScrollBase);
      renderTrail();
    }

    function trailPushActiveVw(p) {
      trailPushTo(activeTrailPts, p, null);
      renderTrail();
    }

    function trailFreeze() {
      trailTrimIntroToDistanceCenter();
      trailFrozen = true;
      trailOn = false;
      trailUseActive = false;
      renderTrail();
    }

    function trailHandlePageChange(index) {
      if (index === lastTrailPage) return;
      lastTrailPage = index;
      if (index >= 2) {
        trailClear();
        return;
      }
      if (index === 1) {
        trailClearActive();
        trailClearIntro();
        return;
      }
      if (index === 0) {
        trailClearActive();
      }
    }

    return {
      get trailOn() {
        return trailOn;
      },
      set trailOn(v) {
        trailOn = v;
      },
      get trailUseActive() {
        return trailUseActive;
      },
      set trailUseActive(v) {
        trailUseActive = v;
      },
      get trailFrozen() {
        return trailFrozen;
      },
      get introTrailPts() {
        return introTrailPts;
      },
      get activeTrailPts() {
        return activeTrailPts;
      },
      trailClear: trailClear,
      trailClearIntro: trailClearIntro,
      trailClearActive: trailClearActive,
      trailBeginIntro: trailBeginIntro,
      trailFreeze: trailFreeze,
      trailHandlePageChange: trailHandlePageChange,
      renderTrail: renderTrail,
      trailPushVw: trailPushVw,
      trailPushActiveVw: trailPushActiveVw,
      trailTrimIntroToDistanceCenter: trailTrimIntroToDistanceCenter,
      beginMoonLandingTrailFade: beginMoonLandingTrailFade,
      resetMoonTrailFade: resetMoonTrailFade,
    };
  }

  global.EarthMoonLine = { create: create };
})(typeof window !== "undefined" ? window : global);
