/* 햄버거 메뉴 · liquid nav · 로켓 호버 유도 */
(function () {
  var NAV_LINKS = [
    { label: "profile", href: "https://us.simulavi.com" },
    { label: "research", href: "https://re.simulavi.com" },
    { label: "mission", href: "https://game.simulavi.com" },
    { label: "experience", href: "https://exp.simulavi.com" },
    { label: "backing", href: "https://back.simulavi.com" },
  ];

  var navRoot = document.querySelector(".site-nav");
  if (!navRoot) return;

  var toggle = navRoot.querySelector(".site-nav__toggle");
  var panel = navRoot.querySelector(".site-nav__panel");
  var rocketLayer = document.querySelector(".rocket-travel");
  var rocket = rocketLayer ? rocketLayer.querySelector(".rocket") : null;

  var isOpen = false;
  var savedRocket = null;
  var activeLink = null;

  function pxToVw(px) {
    return (px / (window.innerWidth || 1)) * 100;
  }

  function pxToVh(px) {
    return (px / (window.innerHeight || 1)) * 100;
  }

  function parseRocketPose() {
    if (!rocket) return null;
    var left = parseFloat(rocket.style.left);
    var top = parseFloat(rocket.style.top);
    if (isNaN(left) || isNaN(top)) {
      var rect = rocket.getBoundingClientRect();
      left = pxToVw(rect.left + rect.width * 0.5);
      top = pxToVh(rect.top + rect.height * 0.5);
    }
    var rot = 12;
    var tr = rocket.style.transform || "";
    var m = tr.match(/rotate\(([-\d.]+)deg\)/);
    if (m) rot = parseFloat(m[1]);
    return { x: left, y: top, rot: rot, scale: 1 };
  }

  function applyRocketPose(pose, flying) {
    if (!rocket || !pose) return;
    if (rocketLayer) rocketLayer.classList.add("is-nav-attract");
    rocket.style.transition = "";
    rocket.style.left = pose.x + "vw";
    rocket.style.top = pose.y + "vh";
    rocket.style.opacity = "1";
    rocket.classList.toggle("rocket--flight", flying !== false);
    rocket.style.transform =
      "translate(-50%, -50%) rotate(" +
      pose.rot +
      "deg) scale(" +
      (pose.scale != null ? pose.scale : 1) +
      ")";
  }

  function clearNavAttract() {
    if (rocketLayer) rocketLayer.classList.remove("is-nav-attract");
  }

  function targetForLink(linkEl) {
    var rect = linkEl.getBoundingClientRect();
    var cx = rect.left + rect.width * 0.5;
    var cy = rect.top + rect.height * 0.5;
    var rocketRect = rocket ? rocket.getBoundingClientRect() : null;
    var rx = rocketRect ? rocketRect.left + rocketRect.width * 0.5 : cx - 80;
    var ry = rocketRect ? rocketRect.top + rocketRect.height * 0.5 : cy;
    var dx = cx - rx;
    var dy = cy - ry;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var standOff = 56;
    var tx = cx + (dx / dist) * standOff;
    var ty = cy + (dy / dist) * standOff;
    var rot = (Math.atan2(cy - ty, cx - tx) * 180) / Math.PI + 90;
    return {
      x: pxToVw(tx),
      y: pxToVh(ty),
      rot: rot,
      scale: 0.92,
    };
  }

  function setOpen(next) {
    isOpen = next;
    navRoot.classList.toggle("is-open", isOpen);
    document.body.classList.toggle("is-nav-open", isOpen);
    if (toggle) toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (toggle) {
      toggle.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
    }
    if (!isOpen) {
      activeLink = null;
      if (savedRocket) {
        applyRocketPose(savedRocket, false);
        document.dispatchEvent(
          new CustomEvent("earth-moon-nav-close", { detail: savedRocket })
        );
        savedRocket = null;
      }
      clearNavAttract();
      return;
    }
    savedRocket = parseRocketPose();
  }

  function onLinkEnter(linkEl) {
    if (!isOpen || !rocket) return;
    activeLink = linkEl;
    applyRocketPose(targetForLink(linkEl), true);
  }

  function onLinkLeave() {
    if (!isOpen) return;
    activeLink = null;
    if (savedRocket) applyRocketPose(savedRocket, false);
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      setOpen(!isOpen);
    });
  }

  panel.addEventListener("click", function (e) {
    if (e.target === panel) setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) setOpen(false);
  });

  var links = navRoot.querySelectorAll(".liquid-btn");
  links.forEach(function (link) {
    link.addEventListener("mouseenter", function () {
      onLinkEnter(link);
    });
    link.addEventListener("focus", function () {
      onLinkEnter(link);
    });
    link.addEventListener("mouseleave", onLinkLeave);
    link.addEventListener("blur", function () {
      if (activeLink === link) onLinkLeave();
    });
  });

  window.addEventListener("resize", function () {
    if (isOpen && activeLink) onLinkEnter(activeLink);
  });

  /* NAV_LINKS는 HTML에 이미 있음 — 빈 리스트면 동적 생성 (단독 테스트용) */
  if (!links.length) {
    var list = navRoot.querySelector(".site-nav__list");
    if (list) {
      NAV_LINKS.forEach(function (item) {
        var li = document.createElement("li");
        li.className = "site-nav__item";
        li.innerHTML =
          '<a class="liquid-btn" href="' +
          item.href +
          '" data-nav-label="' +
          item.label +
          '">' +
          '<span class="liquid-btn__shell">' +
          '<span class="liquid-btn__goo" aria-hidden="true">' +
          '<span class="liquid-btn__blob liquid-btn__blob--a"></span>' +
          '<span class="liquid-btn__blob liquid-btn__blob--b"></span>' +
          "</span>" +
          '<span class="liquid-btn__face">' +
          '<span class="liquid-btn__label">' +
          item.label +
          "</span>" +
          '<span class="liquid-btn__kebab" aria-hidden="true"></span>' +
          "</span></span>" +
          "</a>";
        list.appendChild(li);
      });
    }
  }
})();
