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
        if (trailIntroEl) trailIntroEl.setAttribute("d", "");
        if (trailActiveEl) trailActiveEl.setAttribute("d", "");
      }

      function trailClearActive() {
        activeTrailPts = [];
        if (trailActiveEl) trailActiveEl.setAttribute("d", "");
      }

      function trailTrimIntroToDistanceCenter() {
        var end = pageCenterInViewport(1);
        trailMaxDocVw = end.x + trailScrollVw() + 50;
      }

      function trailScrollVw() {
        var vw = pageWidth();
        if (vw < 1) return 0;
        return (wrapper.scrollLeft / vw) * 100;
      }

      function buildTrailPath(pts, maxDocVw) {
        if (pts.length < 2) return "";
        var vw = window.innerWidth || 1;
        var scrollVw = trailScrollVw();
        var maxDoc = maxDocVw != null ? maxDocVw : Infinity;
        var d = "";
        var i;
        for (i = 0; i < pts.length; i++) {
          if (pts[i].docVw > maxDoc + 0.5) break;
          var px = ((pts[i].docVw - scrollVw) / 100) * vw;
          var py = pts[i].py;
          d += (i === 0 ? "M" : " L") + px + " " + py;
        }
        if (d.indexOf("L") === -1) return "";
        return d;
      }

      function renderTrail() {
        if (trailIntroEl) {
          var introCap =
            trailFrozen && readIndex() > 0 ? trailMaxDocVw : null;
          trailIntroEl.setAttribute(
            "d",
            buildTrailPath(introTrailPts, introCap)
          );
        }
        if (trailActiveEl) {
          trailActiveEl.setAttribute("d", buildTrailPath(activeTrailPts, null));
        }
      }

      function trailPushTo(pts, p) {
        var vw = window.innerWidth || 1;
        var vh = window.innerHeight || 1;
        var docVw = p.x + trailScrollVw();
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
        trailPushTo(introTrailPts, p);
        renderTrail();
      }

      function trailPushActiveVw(p) {
        trailPushTo(activeTrailPts, p);
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
        var prev = lastTrailPage;
        lastTrailPage = index;
        if (index >= 2) {
          trailClear();
          return;
        }
        if (index === 1) {
          trailClearActive();
          return;
        }
        if (index === 0) {
          trailClearActive();
        }
      }

    return {
      get trailOn() { return trailOn; },
      set trailOn(v) { trailOn = v; },
      get trailUseActive() { return trailUseActive; },
      set trailUseActive(v) { trailUseActive = v; },
      get trailFrozen() { return trailFrozen; },
      get introTrailPts() { return introTrailPts; },
      get activeTrailPts() { return activeTrailPts; },
      trailClear: trailClear,
      trailClearActive: trailClearActive,
      trailFreeze: trailFreeze,
      trailHandlePageChange: trailHandlePageChange,
      renderTrail: renderTrail,
      trailPushVw: trailPushVw,
      trailPushActiveVw: trailPushActiveVw,
      trailTrimIntroToDistanceCenter: trailTrimIntroToDistanceCenter,
    };
  }

  global.EarthMoonLine = { create: create };
})(typeof window !== "undefined" ? window : global);
