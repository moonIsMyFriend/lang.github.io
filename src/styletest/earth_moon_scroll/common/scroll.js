/* 공통 스크롤·페이지 시퀀스 — common/line.js, rocket.js 이후 로드 */
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
      var introArcDistanceRetargeted = false;
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
      var MOON_APPROACH_FRAC = 0.28;
      var MOON_APPROACH_APEX_LIFT = 7;
      var MOON_APPROACH_MIN_Y = 12;
      var MOON_ROTATE_MS = 1100;
      var MOON_DESCEND_MS = 3600;
      var moonAutoTimer = null;
      var moonSequenceActive = false;
      var DISTANCE_WAIT_ROT = 90;
      var DISTANCE_PAGE_ENTRY_LEFT = { x: 6, y: 44 };

      try {
        reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (e) {}

      function viewportMetrics() {
        if (rocketLayer) {
          var r = rocketLayer.getBoundingClientRect();
          if (r.width > 0.5 && r.height > 0.5) {
            return { width: r.width, height: r.height };
          }
        }
        var root = document.documentElement;
        return {
          width: root.clientWidth || window.innerWidth || 1,
          height: root.clientHeight || window.innerHeight || 1,
        };
      }

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
        viewportMetrics: viewportMetrics,
        pageWidth: function () {
          var m = viewportMetrics();
          return wrapper.clientWidth || m.width;
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
        if (document.body.classList.contains("is-nav-open")) return;
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
      function trailClearIntro() {
        line.trailClearIntro();
      }
      function beginMoonLandingTrailFade(durationMs, cb) {
        line.beginMoonLandingTrailFade(durationMs, cb);
      }
      function resetMoonTrailFade() {
        line.resetMoonTrailFade();
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

      /* README: 3페이지 도달 전까지 이전 페이지로 되돌릴 수 없음 */
      function minBackwardIndex() {
        if (maxPageReached >= pageCount - 1) return 0;
        return maxPageReached;
      }

      function hintScreenIndex(screenEl) {
        var screens = wrapper.querySelectorAll(".screen");
        for (var i = 0; i < screens.length; i++) {
          if (screens[i] === screenEl) return i;
        }
        return -1;
      }

      function syncScrollHints() {
        var backEnabled = maxPageReached >= pageCount - 1;
        var minBack = minBackwardIndex();

        wrapper.querySelectorAll(".arrow-hint--right").forEach(function (btn) {
          var si = hintScreenIndex(btn.closest(".screen"));
          var show = si >= 0 && si < pageCount - 1 && si < maxPageReached + 1;
          btn.hidden = !show;
        });

        wrapper.querySelectorAll(".arrow-hint--left").forEach(function (btn) {
          var si = hintScreenIndex(btn.closest(".screen"));
          var show = backEnabled && si > 0 && si > minBack;
          btn.hidden = !show;
        });
      }

      function navigateByHint(dir) {
        if (document.body.classList.contains("is-nav-open")) return;
        if (moonSequenceActive) return;
        if (R.rocketMode === "flying" || R.rocketMode === "moonOrbit") return;

        var idx = readIndex();
        if (dir > 0) {
          var next = clampIndex(idx + 1);
          if (next > maxPageReached + 1) return;
          if (idx === 0 && R.rocketMode === "intro3d") {
            maxPageReached = Math.max(maxPageReached, next);
            goToPage(next, true);
            window.setTimeout(function () {
              skipEarthIntroForDrag(next);
              syncScrollHints();
            }, reduceMotion ? 0 : 440);
            return;
          }
          goToPage(next, true);
        } else {
          var prev = idx - 1;
          if (prev < minBackwardIndex()) return;
          goToPage(prev, true);
        }
      }

      /* ── 2페이지 DISTANCE (distance/page.css) ── */
      function finishDistancePageArrival() {
        introDone = true;
        trailClearIntro();
        trailClearActive();
        if (rocketLayer) rocketLayer.style.visibility = "";
        setRocketMode("atDistance");
        snapDistanceWaitPose();
        scheduleDistanceAutoDepart();
        syncScrollHints();
      }












      /* ── 3페이지 MOON (moon/page.css) ── */
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

      function moonOrbitEntryPoint(center, radius) {
        return pointOnMoonOrbit(-Math.PI / 2, center, radius);
      }

      function moonOrbitTop(center, radius) {
        return moonOrbitEntryPoint(center, radius);
      }

      function moonApproachApex(wait, entry) {
        var lift = MOON_APPROACH_APEX_LIFT;
        return {
          x: wait.x + (entry.x - wait.x) * 0.55,
          y: Math.max(entry.y - lift, MOON_APPROACH_MIN_Y),
        };
      }

      /* README: 왼쪽 → 궤도 진입 지점 포물선(너무 위로 가지 않음) → 궤도에 부드럽게 연결 */
      function moonApproachOrbitPoint(rawT, wait, center, radius) {
        var entry = moonOrbitEntryPoint(center, radius);
        var orbitSpan = 1 - MOON_APPROACH_FRAC;
        var joinSpan = 0.07;
        if (rawT <= MOON_APPROACH_FRAC) {
          var t = easeInOutQuad(rawT / MOON_APPROACH_FRAC);
          var p = sampleBezier(wait, moonApproachApex(wait, entry), entry, t);
          return {
            x: p.x,
            y: Math.max(p.y, MOON_APPROACH_MIN_Y),
          };
        }
        var orbitT = (rawT - MOON_APPROACH_FRAC) / orbitSpan;
        var angle = -Math.PI / 2 + orbitT * Math.PI * 2;
        var orbitP = pointOnMoonOrbit(angle, center, radius);
        if (orbitT < joinSpan) {
          var blend = easeInOutQuad(orbitT / joinSpan);
          return {
            x: entry.x + (orbitP.x - entry.x) * blend,
            y: entry.y + (orbitP.y - entry.y) * blend,
          };
        }
        return orbitP;
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





      function distancePageEntryFrom() {
        return {
          x: DISTANCE_PAGE_ENTRY_LEFT.x,
          y: DISTANCE_PAGE_ENTRY_LEFT.y,
          rot: DISTANCE_WAIT_ROT,
        };
      }




















      function syncForwardPageIndex(idx) {
        if (idx == null) idx = readIndex();
        idx = clampIndex(idx);
        if (idx > maxPageReached) maxPageReached = idx;
        if (idx > anchorIndex) anchorIndex = idx;
        return idx;
      }

      function goToPage(index, smooth) {
        index = clampIndex(index);
        if (index < minBackwardIndex()) index = minBackwardIndex();
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
        if (target < minBackwardIndex()) target = minBackwardIndex();
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

      /* README: 2페이지에 미리 들어오면 왼쪽 → 중앙으로 궤적을 그리며 이동 */
      function flyDistancePageEntryFromLeft() {
        if (introArcDistanceRetargeted) return;
        introArcDistanceRetargeted = true;
        cancelFlight();
        mountRocketFixed();
        if (rocketLayer) rocketLayer.style.visibility = "";
        var from = distancePageEntryFrom();
        var to = pageCenterInViewport(1);
        applyRocketViewport(from, DISTANCE_WAIT_ROT, 1, false);
        setRocketMode("introArc");
        line.trailOn = true;
        line.trailUseActive = true;
        trailPushActiveVw(from);
        animateRocketArc(
          from,
          arcControl(from, to, (to.x - from.x) * 0.12, -12),
          to,
          INTRO_ARC_MS * 0.88,
          {
            rocketMode: "introArc",
            trail: true,
            trailActive: true,
            rotAt: function (eased, p, pNext, velRot) {
              if (eased > 0.45) {
                return lerpAngleDeg(
                  R.lastRocketPos.rot,
                  DISTANCE_WAIT_ROT,
                  (eased - 0.45) / 0.55
                );
              }
              return DISTANCE_WAIT_ROT;
            },
          },
          function () {
            if (readIndex() >= 2) {
              introDone = true;
              beginMoonPage();
              return;
            }
            finishDistancePageArrival();
          }
        );
      }

      function retargetIntroArcIfOnDistancePage() {
        if (readIndex() !== 1 || R.rocketMode !== "introArc") return;
        flyDistancePageEntryFromLeft();
      }

      function flyToDistanceCenter(fromSlot, skipTrailClear, isRetarget) {
        if (!isRetarget) introArcDistanceRetargeted = false;
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
            if (readIndex() >= 2) {
              introDone = true;
              trailFreeze();
              beginMoonPage();
              return;
            }
            if (readIndex() === 1) {
              trailFreeze();
              finishDistancePageArrival();
              return;
            }
            introDone = true;
            trailFreeze();
            if (rocketLayer) rocketLayer.style.visibility = "";
            setRocketMode("atDistance");
            /* README: 2페이지 중심이 목표지만, 사용자가 스크롤하기 전까지 1페이지 화면 유지 */
            applyRocketViewport(
              pageCenterInViewport(1),
              DISTANCE_WAIT_ROT,
              1,
              false
            );
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
        resetMoonTrailFade();
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
        resetMoonTrailFade();
        if (rocketLayer) {
          rocketLayer.classList.remove("is-moon-landing", "is-moon-orbit");
        }
        var to = moonCenterTarget();
        applyRocketViewport(to, MOON_LAND_NOSE_UP, MOON_LANDED_SCALE, false);
        setRocketMode("landed");
        if (rocket) {
          rocket.classList.add("rocket--landed");
          rocket.classList.remove("rocket--flight");
        }
        syncScrollHints();
      }

      function startMoonLandingFromOrbit(atTop) {
        var land = moonCenterTarget();
        line.trailOn = false;
        if (rocketLayer) {
          rocketLayer.classList.add("is-moon-landing");
          rocketLayer.classList.remove("is-moon-orbit");
        }
        beginMoonLandingTrailFade(1100, function () {
          applyRocketViewport(atTop, ensureSmoothRot(), 1, false);
          animateRocketHoldRotate(MOON_LAND_NOSE_UP, MOON_ROTATE_MS, function () {
            var descendCtrl = {
              x: atTop.x,
              y: (atTop.y + land.y) * 0.52,
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
        });
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
        var from = moonWaitPose();

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
        if (rocketLayer) rocketLayer.classList.add("is-moon-orbit");

        animateRocketAlong(
          function (rawT) {
            return moonApproachOrbitPoint(rawT, from, center, r);
          },
          MOON_AHEAD_MS * 1.5 + MOON_ORBIT_MS,
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
            startMoonLandingFromOrbit(atTop);
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
        syncScrollHints();
        if (index === 1 && R.rocketMode === "introArc") {
          retargetIntroArcIfOnDistancePage();
        }
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
          if (R.rocketMode === "introArc") {
            retargetIntroArcIfOnDistancePage();
            return;
          }
          if (R.rocketMode === "atDistance") {
            finishDistancePageArrival();
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
        if (readIndex() === 1 && R.rocketMode === "introArc") {
          retargetIntroArcIfOnDistancePage();
        }
        if (
          introDone &&
          readIndex() < 2 &&
          (R.rocketMode === "atDistance" || R.rocketMode === "introArc")
        ) {
          if (rocketLayer) rocketLayer.style.visibility = "";
          if (rocket) {
            rocket.style.opacity = "1";
            rocket.classList.remove("rocket--landed");
          }
          if (R.rocketMode === "atDistance") {
            applyRocketViewport(
              distanceWaitPose(),
              DISTANCE_WAIT_ROT,
              1,
              false
            );
          }
        }
        if (line.introTrailPts.length || line.activeTrailPts.length) renderTrail();
      }

      /* ── 1페이지 EARTH (earth/page.js) ── */
      function continueIntroArcFrom(viewportSlot) {
        R.smoothFlightRot = null;
        mountRocketFixed();
        if (rocketLayer) rocketLayer.style.visibility = "";
        if (readIndex() === 1) {
          line.trailOn = true;
          flyDistancePageEntryFromLeft();
          return;
        }
        viewportSlot.rot = 90;
        R.lastRocketPos.rot = 90;
        line.trailOn = true;
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
        if (next < minBackwardIndex()) return;
        goToPage(next, true);
      }

      function onScrollEnd() {
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(settleScroll, 50);
      }

      function onScroll() {
        if (!isSnapping) {
          syncForwardPageIndex();
          if (maxPageReached > 0 || introDone) {
            var minLeft = minBackwardIndex() * pageWidth();
            if (wrapper.scrollLeft < minLeft - 2) {
              wrapper.scrollLeft = minLeft;
            }
          }
        }
        onScrollEnd();
        syncMoonPageClass();
        syncDistanceWaitOnScroll();
        syncScrollHints();
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

      wrapper.addEventListener("click", function (e) {
        var hint = e.target.closest(".arrow-hint");
        if (!hint || hint.hidden) return;
        e.preventDefault();
        if (hint.classList.contains("arrow-hint--right")) navigateByHint(1);
        else if (hint.classList.contains("arrow-hint--left")) navigateByHint(-1);
      });

      syncScrollHints();

      /* 마우스·터치 드래그로 가로 스크롤 */
      var dragActive = false;
      var dragStartX = 0;
      var dragStartScroll = 0;
      var dragMoved = false;
      var DRAG_THRESHOLD = 5;

      function canDragScroll() {
        if (document.body.classList.contains("is-nav-open")) return false;
        if (moonSequenceActive) return false;
        if (R.rocketMode === "flying" || R.rocketMode === "moonOrbit") return false;
        return true;
      }

      function skipEarthIntroForDrag(targetIndex) {
        if (targetIndex < 1 || R.rocketMode !== "intro3d") return false;
        if (window.EarthIntroRocket && window.EarthIntroRocket.cancel) {
          window.EarthIntroRocket.cancel();
        }
        cancelFlight();
        mountRocketFixed();
        if (rocketLayer) rocketLayer.style.visibility = "";
        line.trailOn = true;
        if (targetIndex === 1) {
          flyDistancePageEntryFromLeft();
          return true;
        }
        if (targetIndex >= 2) {
          introDone = true;
          abortIntroArcForMoon();
          return true;
        }
        return false;
      }

      function settleScrollFromDrag() {
        if (isSnapping || moonSequenceActive) return;
        if (R.rocketMode === "flying" || R.rocketMode === "moonOrbit") return;

        var raw = syncForwardPageIndex();
        var target = clampIndex(raw);
        if (target < minBackwardIndex()) target = minBackwardIndex();
        if (target > maxPageReached + 1) target = maxPageReached + 1;
        target = clampIndex(target);

        if (
          target !== raw ||
          Math.abs(wrapper.scrollLeft - target * pageWidth()) > 2
        ) {
          goToPage(target, true);
          window.setTimeout(function () {
            if (!skipEarthIntroForDrag(target)) onPageSettled(target);
          }, reduceMotion ? 0 : 440);
        } else {
          anchorIndex = target;
          if (!skipEarthIntroForDrag(target)) onPageSettled(target);
        }
      }

      function isDragBlockedTarget(el) {
        if (!el || !el.closest) return false;
        if (el.closest(".site-nav")) return true;
        if (el.closest("a, button, input, textarea, select, label")) return true;
        return false;
      }

      function dragScrollMaxLeft() {
        var w = pageWidth();
        return Math.min((pageCount - 1) * w, (maxPageReached + 1) * w);
      }

      function onDragPointerDown(e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (!canDragScroll()) return;
        if (isDragBlockedTarget(e.target)) return;

        dragActive = true;
        dragMoved = false;
        dragStartX = e.clientX;
        dragStartScroll = wrapper.scrollLeft;
        isSnapping = false;

        try {
          wrapper.setPointerCapture(e.pointerId);
        } catch (err) {}

        wrapper.classList.add("is-drag-scrolling");
      }

      function onDragPointerMove(e) {
        if (!dragActive) return;

        var dx = e.clientX - dragStartX;
        if (Math.abs(dx) > DRAG_THRESHOLD) dragMoved = true;

        var next = dragStartScroll - dx;
        var minLeft = minBackwardIndex() * pageWidth();
        var maxLeft = dragScrollMaxLeft();

        if (next < minLeft) next = minLeft;
        if (next > maxLeft) next = maxLeft;

        wrapper.scrollLeft = next;

        if (dragMoved) e.preventDefault();
      }

      function onDragPointerEnd(e) {
        if (!dragActive) return;

        dragActive = false;
        wrapper.classList.remove("is-drag-scrolling");

        try {
          wrapper.releasePointerCapture(e.pointerId);
        } catch (err) {}

        if (dragMoved) {
          settleScrollFromDrag();
        }
      }

      wrapper.addEventListener("pointerdown", onDragPointerDown);
      wrapper.addEventListener("pointermove", onDragPointerMove);
      wrapper.addEventListener("pointerup", onDragPointerEnd);
      wrapper.addEventListener("pointercancel", onDragPointerEnd);

      document.addEventListener("earth-moon-nav-close", function (e) {
        var pose = e.detail;
        if (!pose) return;
        R.lastRocketPos.x = pose.x;
        R.lastRocketPos.y = pose.y;
        R.lastRocketPos.rot = pose.rot;
        R.lastRocketPos.scale = pose.scale != null ? pose.scale : 1;
        R.resetSmoothRot(pose.rot);
      });

      function onViewportChange() {
        if (document.body.classList.contains("is-nav-open")) return;
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
      }

      window.addEventListener("resize", onViewportChange);
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", onViewportChange);
        window.visualViewport.addEventListener("scroll", onViewportChange);
      }

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