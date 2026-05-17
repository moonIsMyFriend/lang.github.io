(function () {
      var canvas = document.querySelector(".earth-canvas");
      var container = canvas && canvas.closest(".earth-3d-host");
      if (!canvas || !container || typeof THREE === "undefined") return;

      var reduceMotion = false;
      try {
        reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (e) {}

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(38, 1, 0.08, 100);
      camera.position.set(0, 0.08, 2.62);
      camera.lookAt(0, 0, 0);

      var renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x020611, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (THREE.SRGBColorSpace !== undefined) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
      }

      function syncSize() {
        var w = container.clientWidth;
        var h = container.clientHeight;
        if (w < 1 || h < 1) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0, 0);
      }
      syncSize();

      var sunWorld = new THREE.Vector3(2.6, 1.35, 1.85).normalize();

      scene.add(new THREE.AmbientLight(0xffffff, 0.68));
      var key = new THREE.DirectionalLight(0xfff5e8, 1.12);
      key.position.copy(sunWorld.clone().multiplyScalar(6));
      scene.add(key);
      var rim = new THREE.DirectionalLight(0xc8e6ff, 0.22);
      rim.position.set(-3.6, -0.4, -2.0);
      scene.add(rim);

      var earthGroup = new THREE.Group();
      earthGroup.position.set(0, 0, 0);
      earthGroup.rotation.y = 0.65;
      earthGroup.rotation.x = -0.06;
      earthGroup.scale.setScalar(0.9);
      scene.add(earthGroup);

      function landNoise(nx, ny, nz) {
        return (
          Math.sin(nx * 3.8 + nz * 2.1) * 0.42 +
          Math.sin(ny * 4.6 + nx * 2.4) * 0.38 +
          Math.sin((nx * 1.7 + ny * 1.9 + nz * 2.2) * 3.1) * 0.28
        );
      }

      /* -Y 남극: 바다 비율↑(육지 문턱 상승), +Y 북극: 흰 빙상·나무 제외 */
      function landThresholdForLatitude(lat) {
        if (lat >= -0.16) return 0.04;
        var bump = (-0.16 - lat) * 1.05;
        if (bump > 0.68) bump = 0.68;
        return 0.04 + bump;
      }

      function buildLowPolyPlanet() {
        var baseGeo = new THREE.IcosahedronGeometry(1, 2);
        var geo = baseGeo.index ? baseGeo.toNonIndexed() : baseGeo;
        var pos = geo.attributes.position;
        var colors = new Float32Array(pos.count * 3);
        var cOcean = new THREE.Color(0x6ad4ff);
        var cLand = new THREE.Color(0x42b06e);
        var cLandHi = new THREE.Color(0xa8ff9a);
        var cSoil = new THREE.Color(0xc9a06e);
        var cSoilDeep = new THREE.Color(0xa67d52);
        var cDeep = new THREE.Color(0x4abef0);
        var cIceA = new THREE.Color(0xffffff);
        var cIceB = new THREE.Color(0xdceef9);
        var i;
        for (i = 0; i < pos.count; i += 3) {
          var ax = 0;
          var ay = 0;
          var az = 0;
          var k;
          for (k = 0; k < 3; k++) {
            ax += pos.getX(i + k);
            ay += pos.getY(i + k);
            az += pos.getZ(i + k);
          }
          ax /= 3;
          ay /= 3;
          az /= 3;
          var invLen = 1 / Math.sqrt(ax * ax + ay * ay + az * az);
          ax *= invLen;
          ay *= invLen;
          az *= invLen;
          var nVal = landNoise(ax, ay, az);
          var lat = ay;
          var landTh = landThresholdForLatitude(lat);
          var land = nVal > landTh;
          var base;
          if (land) {
            var soilMix = Math.sin(ax * 6.2 + az * 4.1) * 0.5 + Math.sin(ay * 5.3 + az * 3.4) * 0.5;
            if (soilMix > 0.35) {
              base = soilMix > 0.62 ? cSoilDeep : cSoil;
            } else if (Math.sin(ax * 9 + ay * 7) > 0.22) {
              base = cLandHi;
            } else {
              base = cLand;
            }
          } else {
            base = nVal > -0.22 ? cOcean : cDeep;
          }
          base = base.clone();
          /* +Y 북극 빙상: 위도 폭을 기존 대비 약 1/3(북극 근처만), 불투명 색만 */
          if (lat >= 0.89) {
            base.copy(cIceA);
          } else if (lat >= 0.82) {
            base.copy(
              Math.sin(ax * 17 + az * 14 + ay * 5.5) > -0.08 ? cIceA : cIceB
            );
          } else if (lat >= 0.79) {
            if (Math.sin(ax * 13 + az * 11) > 0.12) {
              base.copy(cIceB);
            }
          }
          if (lat < 0.36) {
            var lit = ax * sunWorld.x + ay * sunWorld.y + az * sunWorld.z;
            if (lit < -0.15) {
              base.multiplyScalar(0.92);
            }
          }
          for (k = 0; k < 3; k++) {
            colors[(i + k) * 3] = base.r;
            colors[(i + k) * 3 + 1] = base.g;
            colors[(i + k) * 3 + 2] = base.b;
          }
        }
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        var mat = new THREE.MeshLambertMaterial({
          vertexColors: true,
          flatShading: true,
          depthWrite: true,
          depthTest: true,
        });
        return new THREE.Mesh(geo, mat);
      }

      var planet = buildLowPolyPlanet();
      earthGroup.add(planet);

      var introRocketRadius = 1.04;
      var introRocketActive = false;
      var introRocket = (function buildIntroRocket() {
        var g = new THREE.Group();
        var bodyMat = new THREE.MeshLambertMaterial({
          color: 0xe8eeff,
          flatShading: true,
        });
        var finMat = new THREE.MeshLambertMaterial({
          color: 0xc94e2e,
          flatShading: true,
        });
        var flameMat = new THREE.MeshLambertMaterial({
          color: 0xff9a38,
          flatShading: true,
          emissive: 0xff6a10,
          emissiveIntensity: 0.35,
        });
        var body = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 5), bodyMat);
        body.rotation.x = Math.PI / 2;
        body.position.z = 0.03;
        g.add(body);
        var win = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), bodyMat);
        win.position.set(0, 0.02, 0.055);
        g.add(win);
        var finL = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 3), finMat);
        finL.rotation.z = Math.PI / 2;
        finL.position.set(-0.04, -0.02, -0.02);
        g.add(finL);
        var finR = finL.clone();
        finR.position.x = 0.04;
        g.add(finR);
        var flame = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.06, 4), flameMat);
        flame.rotation.x = -Math.PI / 2;
        flame.position.z = -0.07;
        g.add(flame);
        g.visible = false;
        g.scale.setScalar(0.9);
        return g;
      })();
      earthGroup.add(introRocket);

      var introDirs = {
        start: new THREE.Vector3(),
        mid: new THREE.Vector3(),
        end: new THREE.Vector3(),
      };
      var INTRO_PHASE_UP = 0.42;
      var INTRO_PHASE_TURN = 0.62;
      var introScratch = {
        dir: new THREE.Vector3(),
        tangent: new THREE.Vector3(),
        prev: new THREE.Vector3(),
        qA: new THREE.Quaternion(),
        qB: new THREE.Quaternion(),
        qMix: new THREE.Quaternion(),
        mat: new THREE.Matrix4(),
        x: new THREE.Vector3(),
        y: new THREE.Vector3(),
        z: new THREE.Vector3(),
        earthCenter: new THREE.Vector3(),
        toCam: new THREE.Vector3(),
        right: new THREE.Vector3(),
      };

      function computeIntroDirections() {
        earthGroup.updateMatrixWorld(true);
        introScratch.earthCenter.set(0, 0, 0);
        earthGroup.localToWorld(introScratch.earthCenter);
        introScratch.toCam
          .copy(camera.position)
          .sub(introScratch.earthCenter)
          .normalize();
        introScratch.right
          .crossVectors(introScratch.toCam, new THREE.Vector3(0, 1, 0))
          .normalize();
        if (introScratch.right.lengthSq() < 0.04) {
          introScratch.right.set(1, 0, 0);
        }
        var up = introScratch.prev;
        up.crossVectors(introScratch.right, introScratch.toCam).normalize();
        introDirs.start
          .copy(introScratch.toCam)
          .multiplyScalar(0.32)
          .add(up.clone().multiplyScalar(-0.88))
          .normalize();
        introDirs.mid
          .copy(introScratch.toCam)
          .multiplyScalar(0.58)
          .add(up.clone().multiplyScalar(0.42))
          .add(introScratch.right.clone().multiplyScalar(0.22))
          .normalize();
        introDirs.end
          .copy(introScratch.toCam)
          .multiplyScalar(0.38)
          .add(introScratch.right.clone().multiplyScalar(0.9))
          .add(up.clone().multiplyScalar(0.12))
          .normalize();
      }

      function lerpAngleDeg3(a, b, u) {
        var d = (((b - a) % 360) + 540) % 360 - 180;
        return a + d * u;
      }

      function introRotForPhase(t) {
        if (t < INTRO_PHASE_UP) return 0;
        if (t < INTRO_PHASE_TURN) {
          return lerpAngleDeg3(
            0,
            90,
            (t - INTRO_PHASE_UP) / (INTRO_PHASE_TURN - INTRO_PHASE_UP)
          );
        }
        return 90;
      }

      function placeIntroRocketOnDirection(dir, tangent) {
        introRocket.position
          .copy(dir)
          .normalize()
          .multiplyScalar(introRocketRadius);
        var lookAtPt = introRocket.position.clone().add(tangent);
        introRocket.up.copy(dir).normalize();
        introRocket.lookAt(lookAtPt);
      }

      function projectIntroRocketViewport() {
        var v = new THREE.Vector3();
        introRocket.getWorldPosition(v);
        v.project(camera);
        var r = container.getBoundingClientRect();
        var root = document.documentElement;
        var vw = root.clientWidth || window.innerWidth || 1;
        var vh = root.clientHeight || window.innerHeight || 1;
        var tip = introScratch.prev;
        tip.copy(introScratch.dir).multiplyScalar(introRocketRadius);
        tip.add(introScratch.tangent.clone().multiplyScalar(0.12));
        earthGroup.localToWorld(tip);
        tip.project(camera);
        var rot =
          (Math.atan2(
            -(tip.y - v.y) * r.height,
            (tip.x - v.x) * r.width
          ) *
            180) /
          Math.PI;
        return {
          x: ((v.x * 0.5 + 0.5) * r.width + r.left) / vw * 100,
          y: ((-(v.y * 0.5) + 0.5) * r.height + r.top) / vh * 100,
          rot: rot + 90,
          scale: 1,
        };
      }

      function easeOutQuad3(t) {
        return 1 - (1 - t) * (1 - t);
      }

      function slerpOnSphere(fromDir, toDir, u, out) {
        introScratch.qA.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fromDir);
        introScratch.qB.setFromUnitVectors(new THREE.Vector3(0, 0, 1), toDir);
        introScratch.qMix.slerpQuaternions(introScratch.qA, introScratch.qB, u);
        return out.set(0, 0, 1).applyQuaternion(introScratch.qMix).normalize();
      }

      function setIntroRocketT(t) {
        var s = introScratch;
        var posU;
        if (t < INTRO_PHASE_UP) {
          posU = t / INTRO_PHASE_UP;
          slerpOnSphere(introDirs.start, introDirs.mid, easeOutQuad3(posU), s.dir);
          s.tangent.copy(introDirs.mid).sub(introDirs.start);
        } else if (t < INTRO_PHASE_TURN) {
          s.dir.copy(introDirs.mid);
          s.tangent.copy(introScratch.right);
        } else {
          posU = (t - INTRO_PHASE_TURN) / (1 - INTRO_PHASE_TURN);
          slerpOnSphere(introDirs.mid, introDirs.end, easeOutQuad3(posU), s.dir);
          s.tangent.copy(introDirs.end).sub(introDirs.mid);
        }
        if (s.tangent.lengthSq() < 0.0002) {
          s.tangent.crossVectors(s.dir, introScratch.right).normalize();
        } else {
          s.tangent.normalize();
        }
        placeIntroRocketOnDirection(s.dir, s.tangent);
        earthGroup.updateMatrixWorld(true);
        introScratch.earthCenter.set(0, 0, 0);
        earthGroup.localToWorld(introScratch.earthCenter);
        introScratch.toCam
          .copy(camera.position)
          .sub(introScratch.earthCenter)
          .normalize();
        return s.dir.dot(introScratch.toCam) > 0.04;
      }

      var introRafId = null;

      window.EarthIntroRocket = {
        ready: true,
        cancel: function () {
          if (introRafId != null) {
            cancelAnimationFrame(introRafId);
            introRafId = null;
          }
          introRocketActive = false;
        },
        start: function (durationMs, reduced, onFrame, onDone) {
          computeIntroDirections();
          introRocketActive = true;
          introRocket.visible = false;
          if (reduced) {
            setIntroRocketT(1);
            introRocketActive = false;
            onDone(projectIntroRocketViewport());
            return;
          }
          setIntroRocketT(0);
          var t0 = performance.now();
          function step(now) {
            if (!introRocketActive) return;
            var t = Math.min(1, (now - t0) / durationMs);
            var eased = 1 - Math.pow(1 - t, 2.1);
            var front = setIntroRocketT(eased);
            var slot = projectIntroRocketViewport();
            slot.rot = introRotForPhase(eased);
            if (onFrame) onFrame(slot, front);
            if (t < 1) {
              introRafId = requestAnimationFrame(step);
            } else {
              introRafId = null;
              introRocketActive = false;
              onDone(slot);
            }
          }
          introRafId = requestAnimationFrame(step);
        },
      };
      document.dispatchEvent(new CustomEvent("earth-scene-ready"));

      function placeOnSphere(mesh, dir, radius, scale) {
        var d = dir.clone().normalize();
        mesh.position.copy(d.multiplyScalar(radius));
        mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.clone().normalize()
        );
        if (scale != null && scale !== 1) mesh.scale.setScalar(scale);
      }

      var rnd = 0;
      function rand() {
        rnd = (rnd * 1664525 + 1013904223) % 4294967296;
        return rnd / 4294967296;
      }

      var matTrunk = new THREE.MeshLambertMaterial({
        color: 0x4d3a2a,
        flatShading: true,
      });
      var matNeedle = new THREE.MeshLambertMaterial({
        color: 0x6ef0a8,
        flatShading: true,
      });
      var matBushHi = new THREE.MeshLambertMaterial({
        color: 0x8cff9a,
        flatShading: true,
      });
      var matWide = new THREE.MeshLambertMaterial({
        color: 0x2f8448,
        flatShading: true,
      });
      var matWideTop = new THREE.MeshLambertMaterial({
        color: 0x5ad078,
        flatShading: true,
      });

      function buildTreePine(s) {
        var g = new THREE.Group();
        var trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.011 * s, 0.013 * s, 0.032 * s, 5),
          matTrunk
        );
        var top = new THREE.Mesh(
          new THREE.ConeGeometry(0.03 * s, 0.078 * s, 5),
          matNeedle
        );
        top.position.y = 0.048 * s;
        g.add(trunk);
        g.add(top);
        return g;
      }

      function buildTreeBush(s) {
        var g = new THREE.Group();
        var trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.009 * s, 0.011 * s, 0.022 * s, 4),
          matTrunk
        );
        var ball = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.038 * s, 1),
          matBushHi
        );
        ball.position.y = 0.038 * s;
        g.add(trunk);
        g.add(ball);
        return g;
      }

      function buildTreeWide(s) {
        var g = new THREE.Group();
        var trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.01 * s, 0.012 * s, 0.038 * s, 5),
          matTrunk
        );
        var top = new THREE.Mesh(
          new THREE.ConeGeometry(0.048 * s, 0.055 * s, 6),
          matWideTop
        );
        top.position.y = 0.045 * s;
        var mid = new THREE.Mesh(
          new THREE.ConeGeometry(0.04 * s, 0.045 * s, 6),
          matWide
        );
        mid.position.y = 0.018 * s;
        g.add(trunk);
        g.add(mid);
        g.add(top);
        return g;
      }

      function buildTreeTwin(s) {
        var g = new THREE.Group();
        var trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.01 * s, 0.012 * s, 0.04 * s, 5),
          matTrunk
        );
        var lo = new THREE.Mesh(
          new THREE.ConeGeometry(0.034 * s, 0.05 * s, 5),
          matWide
        );
        lo.position.y = 0.028 * s;
        var hi = new THREE.Mesh(
          new THREE.ConeGeometry(0.026 * s, 0.06 * s, 5),
          matNeedle
        );
        hi.position.y = 0.072 * s;
        g.add(trunk);
        g.add(lo);
        g.add(hi);
        return g;
      }

      var treeBuilders = [
        buildTreePine,
        buildTreeBush,
        buildTreeWide,
        buildTreeTwin,
      ];

      function randomTangentAxis(dir) {
        var ax = new THREE.Vector3(1, 0.15, 0);
        if (Math.abs(ax.dot(dir)) > 0.92) ax.set(0, 1, 0.1);
        var u = new THREE.Vector3().crossVectors(dir, ax);
        if (u.lengthSq() < 1e-8) u.crossVectors(dir, new THREE.Vector3(0, 0, 1));
        u.normalize();
        return u;
      }

      function rotateToward(base, axis, radians) {
        return base.clone().applyAxisAngle(axis, radians).normalize();
      }

      var posAttr = planet.geometry.attributes.position;
      var landDirs = [];
      var ti;
      for (ti = 0; ti < posAttr.count; ti += 3) {
        var lx = (posAttr.getX(ti) + posAttr.getX(ti + 1) + posAttr.getX(ti + 2)) / 3;
        var ly = (posAttr.getY(ti) + posAttr.getY(ti + 1) + posAttr.getY(ti + 2)) / 3;
        var lz = (posAttr.getZ(ti) + posAttr.getZ(ti + 1) + posAttr.getZ(ti + 2)) / 3;
        var llen = 1 / Math.sqrt(lx * lx + ly * ly + lz * lz);
        lx *= llen;
        ly *= llen;
        lz *= llen;
        if (
          landNoise(lx, ly, lz) > landThresholdForLatitude(ly) &&
          ly < 0.74
        ) {
          landDirs.push(new THREE.Vector3(lx, ly, lz));
        }
      }

      for (ti = landDirs.length - 1; ti > 0; ti--) {
        var j = (rand() * (ti + 1)) | 0;
        var tmp = landDirs[ti];
        landDirs[ti] = landDirs[j];
        landDirs[j] = tmp;
      }

      var clusterCount = 7;
      var baseScale = 0.34;
      var used = 0;
      for (ti = 0; ti < clusterCount && used < landDirs.length; ti++) {
        var baseDir = landDirs[used++];
        var typeIdx = (rand() * treeBuilders.length) | 0;
        var builder = treeBuilders[typeIdx];
        var members = 2 + ((rand() * 2) | 0);
        var axis = randomTangentAxis(baseDir);
        var spread = 0.032 + rand() * 0.028;
        var mi;
        for (mi = 0; mi < members; mi++) {
          var ang = (mi - (members - 1) * 0.5) * spread;
          var d = rotateToward(baseDir, axis, ang);
          var jitter = (rand() - 0.5) * 0.022;
          d = rotateToward(d, randomTangentAxis(d), jitter);
          var tree = builder(baseScale * (0.92 + rand() * 0.12));
          placeOnSphere(tree, d, 0.965 + rand() * 0.006, 1);
          earthGroup.add(tree);
        }
      }

      var cloudMat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        emissive: 0xb8dcff,
        emissiveIntensity: 0.06,
        flatShading: true,
        depthWrite: true,
        depthTest: true,
      });
      var cloudMeshes = [];
      var cloudGeoSmall = new THREE.IcosahedronGeometry(0.018, 0);
      var cloudGeoMed = new THREE.IcosahedronGeometry(0.023, 0);
      var cloudGeoLarge = new THREE.IcosahedronGeometry(0.028, 0);

      function addCloud(dir, radius, geo, sc) {
        var cloud = new THREE.Mesh(geo, cloudMat);
        placeOnSphere(cloud, dir, radius, sc);
        earthGroup.add(cloud);
        cloudMeshes.push(cloud);
      }

      var c;
      for (c = 0; c < 14; c++) {
        var theta = (c / 14) * Math.PI * 2 + 0.28;
        var phi = 0.48 + (c % 4) * 0.16 + (c % 2) * 0.07;
        var dx = Math.sin(phi) * Math.cos(theta);
        var dy = Math.cos(phi) * 0.78 + (rand() - 0.5) * 0.06;
        var dz = Math.sin(phi) * Math.sin(theta);
        var gPick = c % 3 === 0 ? cloudGeoLarge : c % 3 === 1 ? cloudGeoMed : cloudGeoSmall;
        addCloud(new THREE.Vector3(dx, dy, dz), 0.988 + rand() * 0.008, gPick, 0.52 + rand() * 0.22);
      }
      for (c = 0; c < 10; c++) {
        var t2 = (c / 10) * Math.PI * 2 + 1.1;
        var p2 = 0.62 + (c % 3) * 0.11;
        var ex = Math.sin(p2) * Math.cos(t2);
        var ey = Math.cos(p2) * 0.72;
        var ez = Math.sin(p2) * Math.sin(t2);
        var ax = new THREE.Vector3(ex, ey, ez);
        var tang = randomTangentAxis(ax);
        ax.applyAxisAngle(tang, (rand() - 0.5) * 0.22);
        addCloud(ax, 0.994 + rand() * 0.008, cloudGeoSmall, 0.38 + rand() * 0.18);
      }

      var clock = new THREE.Clock();
      var rotationSpeed = 0.1;
      var vToCam = new THREE.Vector3();
      var vObj = new THREE.Vector3();

      function updateFacingVisibility() {
        vToCam.copy(camera.position).normalize();
        var i;
        for (i = 0; i < cloudMeshes.length; i++) {
          cloudMeshes[i].getWorldPosition(vObj);
          vObj.normalize();
          cloudMeshes[i].visible = vObj.dot(vToCam) > 0.04;
        }
      }

      function tick() {
        requestAnimationFrame(tick);
        var dt = clock.getDelta();
        if (!reduceMotion) {
          earthGroup.rotation.y += dt * rotationSpeed;
        }
        updateFacingVisibility();
        renderer.render(scene, camera);
      }
      tick();

      if (typeof ResizeObserver !== "undefined") {
        var ro = new ResizeObserver(syncSize);
        ro.observe(container);
      } else {
        window.addEventListener("resize", syncSize);
      }

      try {
        var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (mq.addEventListener) {
          mq.addEventListener("change", function () {
            reduceMotion = mq.matches;
          });
        } else if (mq.addListener) {
          mq.addListener(function () {
            reduceMotion = mq.matches;
          });
        }
      } catch (e2) {}
    })();
