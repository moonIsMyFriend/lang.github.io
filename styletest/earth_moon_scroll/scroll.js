/* 스크롤·페이지 시퀀스 — line.js, rocket.js 이후 로드 */
(function () {
      var wrapper = document.querySelector(".scroll-wrapper");
      if (!wrapper) return;

      var rocketLayer = document.querySelector(".rocket-travel");
      var rocket = document.querySelector(".rocket-travel .rocket");
      var earth3dHost = document.querySelector(".earth-3d-host");
      var rocketHomeMarker = document.createComment("rocket-travel-home");
      if (rocketLayer && rocketLayer.parentNode) {
        rocketLayer.parentNode.insertBefore(rocketHomeMarker, rocketLayer.nextSibling);
      }
      var pageCount = wrapper.querySelectorAll(".screen").length;
      var anchorIndex = 0;
      var maxPageReached = 0;
      var settleTimer = null;
      var rocketScrollTimer = null;
      var isSnapping = false;
      var reduceMotion = false;

      /* intro3d → introArc → atDistance → (page3) moonWait → orbit → land */
      var introDone = false;
      var earthScreen = document.querySelector(".earth-screen");
      var introBooted = false;
      var trailIntroEl = rocketLayer
        ? rocketLayer.querySelector(".rocket-trail-path--intro")
        : null;
      var trailActiveEl = rocketLayer
        ? rocketLayer.querySelector(".rocket-trail-path--active")
        : null;

      var INTRO_3D_MS = 3800;
      var INTRO_ARC_MS = 3200;
      var MOON_AHEAD_MS = 2800;
      var MOON_LAND_MS = 3800;
      var MOON_LAND_NOSE_UP = 0;
      var DISTANCE_AUTO_DELAY_MS = 1400;
      var distanceAutoTimer = null;
      var MOON_LANDED_SCALE = 0.52;
      var MOON_VIEWPORT_PAD = { xMin: 14, xMax: 86, yMin: 18, yMax: 70 };
      var MOON_WAIT_ROT = 90;
      var MOON_ORBIT_RADIUS_VW = 31;
      var MOON_PAGE_CENTER = { x: 50, y: 44 };
      var MOON_AUTO_DELAY_MS = 1400;
      var MOON_LAUNCH_MS = 2400;
      var MOON_ORBIT_MS = 7200;
      var MOON_APPROACH_FRAC = 0.26;
      var MOON_ROTATE_MS = 1100;
      var MOON_DESCEND_MS = 3600;
      var moonAutoTimer = null;
      var moonSequenceActive = false;

      try {
        reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (e) {}

      var ctx = {
        wrapper: wrapper,
        rocketLayer: rocketLayer,
        rocket: rocket,
        earthScreen: earthScreen,
        trailIntroEl: trailIntroEl,
        trailActiveEl: trailActiveEl,
        rocketHomeMarker: rocketHomeMarker,
        reduceMotion: reduceMotion,
        MOON_VIEWPORT_PAD: MOON_VIEWPORT_PAD,
        DISTANCE_WAIT_ROT: DISTANCE_WAIT_ROT,
        MOON_LAND_NOSE_UP: MOON_LAND_NOSE_UP,
        pageWidth: function () {
          return wrapper.clientWidth || window.innerWidth;
        },
        readIndex: function () {
          var w = ctx.pageWidth();
          if (w < 1) return 0;
          return Math.round(wrapper.scrollLeft / w);
        },
        pageCenterInViewport: function (pageIndex) {
          var scrollVw = (wrapper.scrollLeft / ctx.pageWidth()) * 100;
          return { x: pageIndex * 100 + 50 - scrollVw, y: 44 };
        },
      };

      var line = EarthMoonLine.create(ctx);
      var R = EarthMoonRocket.create(ctx, line);

      function pageWidth() {
        return ctx.pageWidth();
      }

      function readIndex() {
        return ctx.readIndex();
      }

      function pageCenterInViewport(pageIndex) {
        return R.pageCenterInViewport(pageIndex);
      }

      function setRocketMode(mode) {
        R.setRocketMode(mode);
      }
      function mountRocketFixed() {
        R.mountRocketFixed();
      }
      function cancelFlight() {
        R.cancelFlight();
      }
      function applyRocketViewport(p, rot, scale, flying) {
        R.applyRocketViewport(p, rot, scale, flying);
      }
      function animateRocketArc(from, ctrl, to, duration, opts, cb) {
        R.animateRocketArc(from, ctrl, to, duration, opts, cb);
      }
      function animateRocketAlong(sample, duration, opts, cb) {
        R.animateRocketAlong(sample, duration, opts, cb);
      }
      function animateRocketHoldRotate(rotTo, duration, cb) {
        R.animateRocketHoldRotate(rotTo, duration, cb);
      }
      function snapDistanceWaitPose() {
        R.snapDistanceWaitPose();
      }
      function bobOffsetVw() {
        return R.bobOffsetVw();
      }
      function syncMoonPageClass() {
        R.syncMoonPageClass();
      }
      function sampleBezier(from, ctrl, to, t) {
        return R.sampleBezier(from, ctrl, to, t);
      }
      function arcControl(from, to, bulgeX, bulgeY) {
        return R.arcControl(from, to, bulgeX, bulgeY);
      }
      function distanceWaitPose() {
        return R.distanceWaitPose();
      }
      function easeOutQuad(t) {
        return R.easeOutQuad(t);
      }
      function easeInOutQuad(t) {
        return R.easeInOutQuad(t);
      }
      function lerpAngleDeg(from, to, t) {
        return R.lerpAngleDeg(from, to, t);
      }
      function resetSmoothRot(rot) {
        R.resetSmoothRot(rot);
      }
      function ensureSmoothRot() {
        return R.ensureSmoothRot();
      }
      function rotFromVelocity(p, pNext) {
        return R.rotFromVelocity(p, pNext);
      }
      function rotFollowVelocity(eased, p, pNext, velRot, blend) {
        return R.rotFollowVelocity(eased, p, pNext, velRot, blend);
      }
      function clampMoonViewport(p) {
        return R.clampMoonViewport(p);
      }
      function trailClear() {
        line.trailClear();
      }
      function trailBeginIntro() {
        line.trailBeginIntro();
      }
      function trailClearActive() {
        line.trailClearActive();
      }
      function trailFreeze() {
        line.trailFreeze();
      }
      function trailHandlePageChange(index) {
        line.trailHandlePageChange(index);
      }
      function renderTrail() {
        line.renderTrail();
      }
      function trailPushActiveVw(p) {
        line.trailPushActiveVw(p);
      }

      function clampIndex(i) {
        if (i < 0) return 0;
        if (i >= pageCount) return pageCount - 1;
        return i;
      }












      function isMoonScrollSettled() {
        var w = pageWidth();
        if (w < 1) return false;
        return (
          readIndex() === 2 &&
          Math.abs(wrapper.scrollLeft - 2 * w) < 4
        );
      }

      function moonPageCenter() {
        return { x: MOON_PAGE_CENTER.x, y: MOON_PAGE_CENTER.y };
      }

      function moonCenterTarget() {
        return moonPageCenter();
      }

      function moonOrbitCenter() {
        return moonPageCenter();
      }

      function moonWaitPose() {
        return { x: 6, y: 44 };
      }

      function moonOrbitTop(center, radius) {
        return pointOnMoonOrbit(-Math.PI / 2, center, radius);
      }

      function moonApproachOrbitPoint(rawT, wait, approachCtrl, top, center, radius) {
        if (rawT <= MOON_APPROACH_FRAC) {
          var t = easeInOutQuad(rawT / MOON_APPROACH_FRAC);
          return sampleBezier(wait, approachCtrl, top, t);
        }
        var ot = (rawT - MOON_APPROACH_FRAC) / (1 - MOON_APPROACH_FRAC);
        return pointOnMoonOrbit(-Math.PI / 2 + ot * Math.PI * 2, center, radius);
      }

      function pointOnMoonOrbit(angle, center, radius) {
        return {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        };
      }

      function onMoonPage() {
        return readIndex() >= 2;
      }





      var DISTANCE_WAIT_ROT = 90;




















      function syncForwardPageIndex(idx) {
        if (idx == null) idx = readIndex();
        idx = clampIndex(idx);
        if (idx > maxPageReached) maxPageReached = idx;
        if (idx > anchorIndex) anchorIndex = idx;
        return idx;
      }

      function goToPage(index, smooth) {
        index = clampIndex(index);
        if (index < maxPageReached) index = maxPageReached;
        maxPageReached = Math.max(maxPageReached, index);
        anchorIndex = index;
        isSnapping = true;
        wrapper.scrollTo({
          left: index * pageWidth(),
          behavior: smooth && !reduceMotion ? "smooth" : "auto",
        });
        window.setTimeout(
          function () {
            isSnapping = false;
            onPageSettled(index);
          },
          smooth && !reduceMotion ? 420 : 0
        );
      }

      function settleScroll() {
        var raw = syncForwardPageIndex();
        if (
          isSnapping ||
          R.rocketMode === "intro3d" ||
          R.rocketMode === "introArc" ||
          R.rocketMode === "flying" ||
          R.rocketMode === "moonOrbit" ||
          moonSequenceActive ||
          !introDone
        ) {
          return;
        }
        var target = raw;
        if (target < maxPageReached) target = maxPageReached;
        if (target > maxPageReached + 1) target = maxPageReached + 1;
        target = clampIndex(target);
        if (
          target !== raw ||
          Math.abs(wrapper.scrollLeft - target * pageWidth()) > 2
        ) {
          goToPage(target, true);
        } else {
          anchorIndex = target;
          onPageSettled(target);
        }
      }

      function flyToDistanceCenter(fromSlot, skipTrailClear) {
        var from = fromSlot || { x: R.lastRocketPos.x, y: R.lastRocketPos.y };
        var to = pageCenterInViewport(1);
        var ctrl = arcControl(from, to, -6, -22);
        if (!skipTrailClear) {
          trailBeginIntro();
        }
        setRocketMode("introArc");
        animateRocketArc(
          from,
          ctrl,
          to,
          INTRO_ARC_MS,
          {
            rocketMode: "introArc",
            trail: true,
            trailClear: !skipTrailClear,
            rotAt: function (eased, p, pNext, velRot) {
              if (eased > 0.55) {
                return lerpAngleDeg(
                  R.lastRocketPos.rot,
                  DISTANCE_WAIT_ROT,
                  (eased - 0.55) / 0.45
                );
              }
              if (eased < 0.2) return lerpAngleDeg(90, velRot, eased / 0.2);
              return lerpAngleDeg(R.lastRocketPos.rot, velRot, 0.18);
            },
          },
          function () {
            introDone = true;
            trailFreeze();
            if (readIndex() >= 2) {
              beginMoonPage();
              return;
            }
            if (rocketLayer) rocketLayer.style.visibility = "";
            setRocketMode("atDistance");
            applyRocketViewport(
              distanceWaitPose(),
              DISTANCE_WAIT_ROT,
              1,
              false
            );
            if (readIndex() === 1) scheduleDistanceAutoDepart();
          }
        );
      }

      function cancelDistanceAutoDepart() {
        if (distanceAutoTimer) {
          clearTimeout(distanceAutoTimer);
          distanceAutoTimer = null;
        }
      }

      function distanceDepartTarget() {
        return pageCenterInViewport(2);
      }

      function scheduleDistanceAutoDepart() {
        cancelDistanceAutoDepart();
        distanceAutoTimer = window.setTimeout(function () {
          distanceAutoTimer = null;
          if (!introDone || R.rocketMode !== "atDistance") return;
          if (readIndex() !== 1) return;
          flyDistanceDepartRight();
        }, DISTANCE_AUTO_DELAY_MS);
      }

      function flyDistanceDepartRight() {
        if (R.rocketMode !== "atDistance") return;
        cancelDistanceAutoDepart();
        var bob = bobOffsetVw();
        var from = {
          x: R.lastRocketPos.x + bob.x,
          y: R.lastRocketPos.y + bob.y,
        };
        var to = distanceDepartTarget();
        var span = to.x - from.x;
        var ctrl = arcControl(from, to, span * 0.1, -24);
        trailClearActive();
        trailPushActiveVw(from);
        animateRocketArc(
          from,
          ctrl,
          to,
          MOON_AHEAD_MS * 1.35,
          {
            trail: true,
            trailActive: true,
            easeInOut: true,
            rotAt: function (eased, p, pNext, velRot) {
              if (eased < 0.06) return DISTANCE_WAIT_ROT;
              return lerpAngleDeg(
                DISTANCE_WAIT_ROT,
                velRot,
                Math.min(1, (eased - 0.06) / 0.94)
              );
            },
          },
          function () {
            if (readIndex() >= 2) {
              beginMoonPage();
              return;
            }
            setRocketMode("moonAhead");
          }
        );
      }

      function moonAheadTarget() {
        return pageCenterInViewport(2);
      }

      function cancelMoonAutoDepart() {
        if (moonAutoTimer) {
          clearTimeout(moonAutoTimer);
          moonAutoTimer = null;
        }
      }

      /* ── 3페이지 전용 (1·2페이지 로직과 분리) ── */

      function snapMoonWaitPose() {
        if (!rocket || readIndex() < 2 || R.rocketMode === "landed") return;
        var p = moonWaitPose();
        mountRocketFixed();
        if (rocketLayer) {
          rocketLayer.style.visibility = "";
          rocketLayer.classList.add("is-moon-page");
        }
        rocket.classList.remove("rocket--flight", "rocket--landed");
        rocket.style.opacity = "1";
        applyRocketViewport(p, MOON_WAIT_ROT, 1, false);
        setRocketMode("moonWait");
      }

      function scheduleMoonAutoDepart() {
        cancelMoonAutoDepart();
        function tryDepart() {
          moonAutoTimer = null;
          if (readIndex() < 2 || R.rocketMode !== "moonWait") return;
          if (R.rocketMode === "landed") return;
          if (!isMoonScrollSettled()) {
            moonAutoTimer = window.setTimeout(tryDepart, 60);
            return;
          }
          runMoonOrbitAndLand();
        }
        moonAutoTimer = window.setTimeout(tryDepart, MOON_AUTO_DELAY_MS);
      }

      function beginMoonPage() {
        if (readIndex() < 2 || R.rocketMode === "landed") return;
        if (moonSequenceActive) return;
        syncForwardPageIndex(2);
        cancelDistanceAutoDepart();
        cancelFlight();
        cancelMoonAutoDepart();
        moonSequenceActive = false;
        line.trailOn = false;
        line.trailUseActive = false;
        trailClear();
        trailClearActive();
        snapMoonWaitPose();
        scheduleMoonAutoDepart();
      }

      function flyToMoonAhead() {
        if (R.rocketMode === "landed") return;
        if (readIndex() >= 2) return;
        cancelDistanceAutoDepart();
        cancelFlight();
        if (R.rocketMode === "moonAhead") return;
        var from = { x: R.lastRocketPos.x, y: R.lastRocketPos.y };
        var to = moonAheadTarget();
        var ctrl = arcControl(from, to, -14, -20);
        animateRocketArc(
          from,
          ctrl,
          to,
          MOON_AHEAD_MS,
          {
            trail: true,
            trailActive: true,
            trailClearActive: true,
            rotAt: function (eased, p, pNext, velRot) {
              return lerpAngleDeg(R.lastRocketPos.rot, velRot, 0.2);
            },
          },
          function () {
            setRocketMode("moonAhead");
          }
        );
      }

      function finishMoonLanding() {
        moonSequenceActive = false;
        trailClear();
        var to = moonCenterTarget();
        applyRocketViewport(to, MOON_LAND_NOSE_UP, MOON_LANDED_SCALE, false);
        setRocketMode("landed");
        if (rocket) {
          rocket.classList.add("rocket--landed");
          rocket.classList.remove("rocket--flight");
        }
      }

      function runMoonOrbitAndLand() {
        if (readIndex() < 2 || R.rocketMode !== "moonWait") return;
        cancelMoonAutoDepart();
        moonSequenceActive = true;

        if (reduceMotion) {
          finishMoonLanding();
          return;
        }

        var center = moonOrbitCenter();
        var r = MOON_ORBIT_RADIUS_VW;
        var top = moonOrbitTop(center, r);
        var from = moonWaitPose();
        var span = top.x - from.x;
        var approachCtrl = arcControl(from, top, span * 0.1, -24);

        if (rocketLayer) rocketLayer.classList.remove("is-ready-depart");
        if (rocket) {
          rocket.classList.add("rocket--flight");
          rocket.classList.remove("rocket--landed");
          rocket.style.opacity = "1";
        }
        applyRocketViewport(from, MOON_WAIT_ROT, 1, true);
        trailClearActive();
        trailPushActiveVw(from);
        resetSmoothRot(MOON_WAIT_ROT);

        animateRocketAlong(
          function (rawT) {
            return moonApproachOrbitPoint(
              rawT,
              from,
              approachCtrl,
              top,
              center,
              r
            );
          },
          MOON_AHEAD_MS * 1.35 + MOON_ORBIT_MS,
          {
            linearOrbit: true,
            velLook: 0.014,
            trail: true,
            trailActive: true,
            rotAt: function (eased, p, pNext, velRot) {
              return rotFollowVelocity(eased, p, pNext, velRot, 0.1);
            },
          },
          function () {
            var c = moonOrbitCenter();
            var atTop = moonOrbitTop(c, r);
            var land = moonCenterTarget();
            line.trailOn = false;
            applyRocketViewport(atTop, ensureSmoothRot(), 1, true);
            animateRocketHoldRotate(MOON_LAND_NOSE_UP, MOON_ROTATE_MS, function () {
              var descendCtrl = {
                x: atTop.x,
                y: (atTop.y + land.y) * 0.55,
              };
              animateRocketArc(
                atTop,
                descendCtrl,
                land,
                MOON_DESCEND_MS,
                {
                  rocketMode: "moonOrbit",
                  trail: false,
                  rotAt: function () {
                    return MOON_LAND_NOSE_UP;
                  },
                  scaleAt: function (t) {
                    return 1 - t * (1 - MOON_LANDED_SCALE);
                  },
                },
                finishMoonLanding
              );
            });
          }
        );
      }

      function abortIntroArcForMoon() {
        if (R.rocketMode !== "introArc") return false;
        cancelFlight();
        introDone = true;
        trailFreeze();
        if (readIndex() >= 2) beginMoonPage();
        else flyToMoonAhead();
        return true;
      }

      function onPageSettled(index) {
        if (!introDone) return;
        trailHandlePageChange(index);
        if (index !== 1) cancelDistanceAutoDepart();
        if (index >= 2) {
          syncForwardPageIndex(index);
          syncMoonPageClass();
          if (R.rocketMode === "introArc") {
            abortIntroArcForMoon();
            return;
          }
          if (R.rocketMode === "landed" || moonSequenceActive) return;
          beginMoonPage();
          return;
        }
        syncMoonPageClass();
        cancelMoonAutoDepart();
        if (index === 1) {
          if (
            R.rocketMode === "moonWait" ||
            R.rocketMode === "moonOrbit" ||
            moonSequenceActive
          ) {
            cancelFlight();
            moonSequenceActive = false;
            setRocketMode("atDistance");
          }
          if (R.rocketMode === "moonAhead") {
            setRocketMode("atDistance");
          }
          if (R.rocketMode === "atDistance") {
            snapDistanceWaitPose();
            scheduleDistanceAutoDepart();
          }
        }
      }

      function syncDistanceWaitOnScroll() {
        if (readIndex() >= 2) {
          if (R.rocketMode === "introArc") {
            abortIntroArcForMoon();
            return;
          }
          if (
            R.rocketMode !== "landed" &&
            R.rocketMode !== "moonWait" &&
            R.rocketMode !== "moonOrbit" &&
            !moonSequenceActive
          ) {
            beginMoonPage();
          }
          return;
        }
        if (introDone && R.rocketMode === "atDistance" && readIndex() < 2) {
          if (rocketLayer) rocketLayer.style.visibility = "";
          if (rocket) {
            rocket.style.opacity = "1";
            rocket.classList.remove("rocket--landed");
          }
          applyRocketViewport(
            distanceWaitPose(),
            DISTANCE_WAIT_ROT,
            1,
            false
          );
        }
        if (line.introTrailPts.length || line.activeTrailPts.length) renderTrail();
      }

      function continueIntroArcFrom(viewportSlot) {
        R.smoothFlightRot = null;
        mountRocketFixed();
        if (rocketLayer) rocketLayer.style.visibility = "";
        viewportSlot.rot = 90;
        R.lastRocketPos.rot = 90;
        flyToDistanceCenter(viewportSlot, true);
      }

      function runIntroDomFallback() {
        trailClear();
        trailBeginIntro();
        line.trailOn = true;
        setRocketMode("introArc");
        flyToDistanceCenter({ x: 50, y: 44 }, true);
      }

      function runIntro() {
        if (introBooted || introDone) return;
        introBooted = true;
        R.smoothFlightRot = null;
        if (!rocket) {
          introDone = true;
          setRocketMode("atDistance");
          return;
        }

        function tryEarthIntro() {
          if (!window.EarthIntroRocket || !window.EarthIntroRocket.start) {
            runIntroDomFallback();
            return;
          }
          trailClear();
          trailBeginIntro();
          line.trailOn = true;
          setRocketMode("intro3d");
          if (rocketLayer) rocketLayer.style.visibility = "hidden";
          window.EarthIntroRocket.start(
            INTRO_3D_MS,
            reduceMotion,
            function (slot, frontVisible) {
              if (!frontVisible) return;
              if (rocketLayer) rocketLayer.style.visibility = "";
              mountRocketFixed();
              applyRocketViewport(slot, slot.rot, 1, true);
            },
            function (viewportSlot) {
              continueIntroArcFrom(viewportSlot);
            }
          );
        }

        if (window.EarthIntroRocket && window.EarthIntroRocket.ready) {
          tryEarthIntro();
        } else {
          document.addEventListener("earth-scene-ready", tryEarthIntro, {
            once: true,
          });
        }
      }

      function moveRocketByKey(dir) {
        if (!introDone || R.rocketMode === "intro3d" || R.rocketMode === "introArc") {
          return;
        }
        var next = clampIndex(readIndex() + dir);
        if (next < maxPageReached) return;
        goToPage(next, true);
      }

      function onScrollEnd() {
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(settleScroll, 50);
      }

      function onScroll() {
        if (introDone && !isSnapping) {
          syncForwardPageIndex();
          var minLeft = maxPageReached * pageWidth();
          if (wrapper.scrollLeft < minLeft - 2) {
            wrapper.scrollLeft = minLeft;
          }
        }
        onScrollEnd();
        syncMoonPageClass();
        syncDistanceWaitOnScroll();
        if (rocketLayer) {
          rocketLayer.classList.add("is-scrolling");
          clearTimeout(rocketScrollTimer);
          rocketScrollTimer = window.setTimeout(function () {
            rocketLayer.classList.remove("is-scrolling");
          }, 150);
        }
      }

      wrapper.addEventListener("scroll", onScroll, { passive: true });

      if ("onscrollend" in wrapper) {
        wrapper.addEventListener("scrollend", settleScroll);
      }

      window.addEventListener("resize", function () {
        var stay = syncForwardPageIndex();
        goToPage(stay, false);
        if (line.introTrailPts.length || line.activeTrailPts.length) renderTrail();
        syncMoonPageClass();
        if (introDone && R.rocketMode !== "flying" && R.rocketMode !== "moonOrbit") {
          var idx = readIndex();
          if (idx >= 2 && R.rocketMode !== "landed" && !moonSequenceActive) {
            beginMoonPage();
          } else if (R.rocketMode === "landed" && idx >= 2) {
            applyRocketViewport(moonCenterTarget(), MOON_LAND_NOSE_UP, MOON_LANDED_SCALE);
          } else if (R.rocketMode === "moonAhead") {
            applyRocketViewport({ x: 86, y: 38 }, R.lastRocketPos.rot, 1);
          } else if (R.rocketMode === "atDistance" && idx === 1) {
            snapDistanceWaitPose();
          }
        }
      });

      window.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        if (
          e.target &&
          (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        ) {
          return;
        }
        e.preventDefault();
        moveRocketByKey(e.key === "ArrowRight" ? 1 : -1);
      });

      if (window.EarthIntroRocket && window.EarthIntroRocket.ready) {
        runIntro();
      } else {
        document.addEventListener("earth-scene-ready", runIntro, { once: true });
      }
    })();