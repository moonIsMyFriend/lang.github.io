/* 로켓(rocket) 모듈 */
(function (global) {
  function create(ctx, line) {
    var wrapper = ctx.wrapper;
    var rocketLayer = ctx.rocketLayer;
    var rocket = ctx.rocket;
    var earthScreen = ctx.earthScreen;
    var rocketHomeMarker = ctx.rocketHomeMarker;
    var rocketInEarthHost = false;
    var rocketMode = "intro3d";
    var flightAnimId = null;
    var lastRocketPos = { x: 50, y: 44, rot: 12, scale: 1 };
    var smoothFlightRot = null;
    var reduceMotion = ctx.reduceMotion;

    function pageWidth() { return ctx.pageWidth(); }
    function readIndex() { return ctx.readIndex(); }

      function setRocketMode(mode) {
        rocketMode = mode;
        if (!rocketLayer) return;
        rocketLayer.classList.remove(
          "mode-intro",
          "mode-idle",
          "mode-wait-moon",
          "is-flying",
          "is-at-distance"
        );
        if (mode === "intro3d" || mode === "introArc") {
          rocketLayer.classList.add("mode-intro");
        }
        rocketLayer.classList.remove("is-ready-depart");
        if (mode === "atDistance") {
          rocketLayer.classList.add("is-at-distance");
          if (earthScreen) earthScreen.classList.add("is-scroll-guide");
          rocketLayer.classList.add("is-ready-depart");
        } else if (earthScreen) {
          earthScreen.classList.remove("is-scroll-guide");
        }
        if (mode === "flying" || mode === "moonOrbit") {
          rocketLayer.classList.add("is-flying");
        }
        if (mode === "moonWait") {
          rocketLayer.classList.add("mode-wait-moon");
          rocketLayer.classList.add("is-ready-depart");
        }
        if (mode === "landed") rocketLayer.classList.add("mode-idle");
      }

      function mountRocketFixed() {
        if (!rocketLayer || !rocketHomeMarker.parentNode) return;
        if (rocketLayer.parentNode !== rocketHomeMarker.parentNode) {
          rocketHomeMarker.parentNode.insertBefore(rocketLayer, rocketHomeMarker);
        }
        rocketInEarthHost = false;
      }

      function cancelFlight() {
        if (flightAnimId) {
          cancelAnimationFrame(flightAnimId);
          flightAnimId = null;
        }
      }

      function easeOutQuad(t) {
        return 1 - (1 - t) * (1 - t);
      }

      function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      }

      function lerpAngleDeg(from, to, t) {
        var d = (((to - from) % 360) + 540) % 360 - 180;
        return from + d * t;
      }

      function resetSmoothRot(rot) {
        smoothFlightRot = rot != null ? rot : lastRocketPos.rot;
      }

      function ensureSmoothRot() {
        if (smoothFlightRot == null) smoothFlightRot = lastRocketPos.rot;
        return smoothFlightRot;
      }

      function rotFromVelocity(p, pNext) {
        var dx = pNext.x - p.x;
        var dy = pNext.y - p.y;
        if (dx * dx + dy * dy < 0.0004) return lastRocketPos.rot;
        return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      }

      function rotFollowVelocity(eased, p, pNext, velRot, blend) {
        var t = blend != null ? blend : 0.14;
        smoothFlightRot = lerpAngleDeg(ensureSmoothRot(), velRot, t);
        return smoothFlightRot;
      }

      function clampMoonViewport(p) {
        var pad = ctx.MOON_VIEWPORT_PAD;
        return {
          x: Math.max(pad.xMin, Math.min(pad.xMax, p.x)),
          y: Math.max(pad.yMin, Math.min(pad.yMax, p.y)),
        };
      }

      function applyRocketViewport(p, rot, scale, flying) {
        if (!rocket) return;
        lastRocketPos.x = p.x;
        lastRocketPos.y = p.y;
        lastRocketPos.rot = rot;
        lastRocketPos.scale = scale != null ? scale : 1;
        rocket.style.transition = "none";
        rocket.style.left = p.x + "vw";
        rocket.style.top = p.y + "vh";
        rocket.style.opacity = "1";
        rocket.classList.toggle("rocket--flight", flying !== false);
        rocket.style.transform =
          "translate(-50%, -50%) rotate(" +
          rot +
          "deg) scale(" +
          lastRocketPos.scale +
          ")";
        if (line.trailOn) {
          if (line.trailUseActive) line.trailPushActiveVw(p);
          else line.trailPushVw(p);
        }
      }

      function sampleBezier(from, ctrl, to, t) {
        var u = 1 - t;
        return {
          x: u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x,
          y: u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y,
        };
      }

      function animateRocketArc(from, ctrl, to, duration, opts, cb) {
        if (!rocket) {
          if (cb) cb();
          return;
        }
        cancelFlight();
        mountRocketFixed();
        if (rocketLayer) {
          rocketLayer.style.visibility = "";
          rocket.classList.remove("rocket--landed");
        }
        setRocketMode((opts && opts.rocketMode) || "flying");
        line.trailOn = !opts || opts.trail !== false;
        line.trailUseActive = !!(opts && opts.trailActive);
        if (opts && opts.trailClear) line.trailClear();
        if (opts && opts.trailClearActive) line.trailClearActive();
        if (reduceMotion) {
          var rot0 =
            (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 90;
          var pEnd = opts && opts.clampMoon ? clampMoonViewport(to) : to;
          applyRocketViewport(pEnd, rot0, opts && opts.endScale != null ? opts.endScale : 1);
          line.trailOn = false;
          if (cb) cb();
          return;
        }
        if (opts && opts.clampMoon) {
          resetSmoothRot(from.rot != null ? from.rot : lastRocketPos.rot);
        }
        var t0 = performance.now();
        var velLook = opts && opts.clampMoon ? 0.055 : 0.028;
        function step(now) {
          var t = Math.min(1, (now - t0) / duration);
          var eased = easeOutQuad(t);
          if (opts && opts.easeInOut) eased = easeInOutQuad(t);
          else if (opts && opts.easeIn) eased = t * t;
          var p = sampleBezier(from, ctrl, to, eased);
          if (opts && opts.clampMoon) p = clampMoonViewport(p);
          var pNext = sampleBezier(from, ctrl, to, Math.min(1, eased + velLook));
          if (opts && opts.clampMoon) pNext = clampMoonViewport(pNext);
          var velRot = rotFromVelocity(p, pNext);
          var rot;
          if (opts && opts.rotAt) rot = opts.rotAt(eased, p, pNext, velRot);
          else rot = lerpAngleDeg(lastRocketPos.rot, velRot, 0.22);
          var scale = 1;
          if (opts && opts.scaleAt) scale = opts.scaleAt(eased);
          applyRocketViewport(p, rot, scale);
          if (t < 1) {
            flightAnimId = requestAnimationFrame(step);
          } else {
            flightAnimId = null;
            line.trailOn = false;
            line.trailUseActive = false;
            if (cb) cb();
          }
        }
        flightAnimId = requestAnimationFrame(step);
      }

      function animateRocketAlong(sample, duration, opts, cb) {
        if (!rocket) {
          if (cb) cb();
          return;
        }
        cancelFlight();
        mountRocketFixed();
        if (rocketLayer) {
          rocketLayer.style.visibility = "";
          rocket.classList.remove("rocket--landed");
        }
        setRocketMode("moonOrbit");
        line.trailOn = !opts || opts.trail !== false;
        line.trailUseActive = !!(opts && opts.trailActive);
        if (opts && opts.trailClearActive) line.trailClearActive();
        if (reduceMotion) {
          var pEnd = sample(1);
          if (opts && opts.clampMoon) pEnd = clampMoonViewport(pEnd);
          applyRocketViewport(pEnd, ctx.MOON_LAND_NOSE_UP, 1);
          line.trailOn = false;
          if (cb) cb();
          return;
        }
        if (opts && opts.clampMoon) {
          resetSmoothRot(lastRocketPos.rot);
        }
        var t0 = performance.now();
        var velLook =
          opts && opts.velLook != null
            ? opts.velLook
            : opts && opts.linearOrbit
              ? 0.018
              : 0.028;
        function step(now) {
          var t = Math.min(1, (now - t0) / duration);
          var eased = opts && opts.linearOrbit ? t : easeInOutQuad(t);
          var p = sample(eased);
          if (opts && opts.clampMoon) p = clampMoonViewport(p);
          var pNext = sample(Math.min(1, eased + velLook));
          if (opts && opts.clampMoon) pNext = clampMoonViewport(pNext);
          var velRot = rotFromVelocity(p, pNext);
          var rot;
          if (opts && opts.rotAt) rot = opts.rotAt(eased, p, pNext, velRot);
          else rot = rotFollowVelocity(eased, p, pNext, velRot, 0.12);
          var scale = 1;
          if (opts && opts.scaleAt) scale = opts.scaleAt(eased);
          applyRocketViewport(p, rot, scale);
          if (t < 1) {
            flightAnimId = requestAnimationFrame(step);
          } else {
            flightAnimId = null;
            line.trailOn = false;
            line.trailUseActive = false;
            if (cb) cb();
          }
        }
        flightAnimId = requestAnimationFrame(step);
      }

      function animateRocketHoldRotate(rotTo, duration, cb) {
        if (!rocket) {
          if (cb) cb();
          return;
        }
        cancelFlight();
        mountRocketFixed();
        if (rocket) rocket.classList.add("rocket--flight");
        setRocketMode("moonOrbit");
        line.trailOn = false;
        var p = { x: lastRocketPos.x, y: lastRocketPos.y };
        var rotFrom = lastRocketPos.rot;
        if (reduceMotion) {
          applyRocketViewport(p, rotTo, lastRocketPos.scale, false);
          if (cb) cb();
          return;
        }
        var t0 = performance.now();
        function step(now) {
          var t = Math.min(1, (now - t0) / duration);
          var rot = lerpAngleDeg(rotFrom, rotTo, easeInOutQuad(t));
          applyRocketViewport(p, rot, lastRocketPos.scale, true);
          if (t < 1) {
            flightAnimId = requestAnimationFrame(step);
          } else {
            flightAnimId = null;
            if (cb) cb();
          }
        }
        flightAnimId = requestAnimationFrame(step);
      }

      function bobOffsetVw() {
        if (!rocket) return { x: 0, y: 0 };
        var bob = rocket.querySelector(".rocket__bob");
        if (!bob) return { x: 0, y: 0 };
        var tr = window.getComputedStyle(bob).transform;
        if (!tr || tr === "none") return { x: 0, y: 0 };
        var m = new DOMMatrixReadOnly(tr);
        var vw = window.innerWidth || 1;
        var vh = window.innerHeight || 1;
        return { x: (m.m41 / vw) * 100, y: (m.m42 / vh) * 100 };
      }

      function snapDistanceWaitPose() {
        if (!rocket) return;
        if (readIndex() !== 1 || rocketMode !== "atDistance") return;
        var p = { x: 50, y: 44 };
        mountRocketFixed();
        if (rocketLayer) rocketLayer.style.visibility = "";
        rocket.classList.remove("rocket--flight", "rocket--landed");
        rocket.style.opacity = "1";
        applyRocketViewport(p, ctx.DISTANCE_WAIT_ROT, 1, false);
      }

      function syncMoonPageClass() {
        if (!rocketLayer) return;
        rocketLayer.classList.toggle("is-moon-page", readIndex() >= 2);
      }

      function arcControl(from, to, bulgeX, bulgeY) {
        return {
          x: (from.x + to.x) * 0.5 + (bulgeX || 0),
          y: (from.y + to.y) * 0.5 + (bulgeY || -18),
        };
      }

      function pageCenterInViewport(pageIndex) {
        var scrollVw = (wrapper.scrollLeft / pageWidth()) * 100;
        return { x: pageIndex * 100 + 50 - scrollVw, y: 44 };
      }

      function distanceWaitPose() {
        return {
          x: pageCenterInViewport(1).x,
          y: pageCenterInViewport(1).y,
        };
      }

    return {
      get rocketMode() { return rocketMode; },
      set rocketMode(v) { rocketMode = v; },
      get lastRocketPos() { return lastRocketPos; },
      set lastRocketPos(v) { lastRocketPos = v; },
      get smoothFlightRot() { return smoothFlightRot; },
      set smoothFlightRot(v) { smoothFlightRot = v; },
      get flightAnimId() { return flightAnimId; },
      setRocketMode: setRocketMode,
      mountRocketFixed: mountRocketFixed,
      cancelFlight: cancelFlight,
      applyRocketViewport: applyRocketViewport,
      animateRocketArc: animateRocketArc,
      animateRocketAlong: animateRocketAlong,
      animateRocketHoldRotate: animateRocketHoldRotate,
      snapDistanceWaitPose: snapDistanceWaitPose,
      bobOffsetVw: bobOffsetVw,
      syncMoonPageClass: syncMoonPageClass,
      sampleBezier: sampleBezier,
      arcControl: arcControl,
      pageCenterInViewport: pageCenterInViewport,
      distanceWaitPose: distanceWaitPose,
      easeOutQuad: easeOutQuad,
      easeInOutQuad: easeInOutQuad,
      lerpAngleDeg: lerpAngleDeg,
      resetSmoothRot: resetSmoothRot,
      ensureSmoothRot: ensureSmoothRot,
      rotFromVelocity: rotFromVelocity,
      rotFollowVelocity: rotFollowVelocity,
      clampMoonViewport: clampMoonViewport,
    };
  }

  global.EarthMoonRocket = { create: create };
})(typeof window !== "undefined" ? window : global);
