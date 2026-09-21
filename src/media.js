// Classify inline artwork separately from photos. No image downloads, pixel
// reads, account content, or host history are needed for this decision.
(() => {
  const attribute = "data-nightshade-media";
  const artwork = "path, rect, circle, ellipse, polygon, polyline, line, text, use";
  const siteRules = [{
    id: "1password-transparent-logo",
    host: /(^|\.)1password\.(com|ca|eu)$/i,
    imagePath: /\/1password-logo-[a-z0-9]+\.svg$/i
  }];

  function imageRule(hostname, source, baseURI) {
    let pathname;
    try { pathname = new URL(source, baseURI).pathname; } catch { return null; }
    return siteRules.find((rule) => rule.host.test(hostname) && rule.imagePath.test(pathname))?.id ?? null;
  }

  function isThemeCanvas(hostname, pathname, canvas) {
    return hostname?.toLowerCase() === "docs.google.com" &&
      pathname?.startsWith("/document/") &&
      canvas?.classList?.contains("kix-canvas-tile-content") === true;
  }

  function classifySvg(svg) {
    // External sprites, gradients and complex illustrations are ambiguous:
    // preserve them rather than guessing at their internal palette.
    if (svg.querySelector("use, image, foreignObject, linearGradient, radialGradient, pattern")) return "preserve";
    const shapes = svg.querySelectorAll(artwork);
    if (shapes.length > 128) return "preserve";
    const colors = new Set();
    for (const shape of shapes) {
      const style = getComputedStyle(shape);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      for (const property of ["fill", "stroke"]) {
        if (property === "fill" && ["line", "polyline"].includes(shape.localName)) continue;
        const paint = style[property];
        if (paint.startsWith("url(")) return "preserve";
        if (paint !== "none" && paint !== "rgba(0, 0, 0, 0)" &&
            Number(style[`${property}Opacity`]) !== 0) colors.add(paint);
      }
    }
    return colors.size > 1 ? "preserve" : "theme";
  }

  function isDarkNeutral(paint) {
    const match = /^rgba?\(([^)]+)\)$/.exec(paint);
    if (!match) return false;
    const channels = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (channels.length < 3 || channels.some((value) => !Number.isFinite(value))) return false;
    if (channels.length > 3 && channels[3] < 0.9) return false;
    const rgb = channels.slice(0, 3);
    // Absolute channel spread admits dark blue-gray wordmarks (e.g. #1c2b33)
    // but excludes saturated brand blue. Do not alter gradients or light paint.
    return Math.max(...rgb) <= 80 && Math.max(...rgb) - Math.min(...rgb) <= 32;
  }

  function isLabelledLogo(svg) {
    const referenced = (svg.getAttribute("aria-labelledby") || "").split(/\s+/)
      .map((id) => svg.ownerDocument.getElementById(id)?.textContent || "").join(" ");
    const label = [svg.getAttribute("aria-label"), referenced, svg.querySelector("title")?.textContent].join(" ");
    return /\b(logo|wordmark)\b/i.test(label);
  }

  function themeLogoParts(svg, mode) {
    // Clear stale classifications after repainting, relabelling or DOM moves.
    svg.querySelectorAll("[data-nightshade-theme-part]")
      .forEach((shape) => shape.removeAttribute("data-nightshade-theme-part"));
    if (mode !== "preserve" || !isLabelledLogo(svg)) return;
    if (svg.querySelector("use, image, foreignObject, mask, clipPath, filter")) return;
    const shapes = svg.querySelectorAll(artwork);
    if (shapes.length > 128) return;
    for (const shape of shapes) {
      if (shape.closest("defs")) continue;
      const style = getComputedStyle(shape);
      if (style.filter !== "none" || style.display === "none" || style.visibility === "hidden") continue;
      const paints = [style.fillOpacity !== "0" && style.fill, style.strokeOpacity !== "0" && style.stroke]
        .filter((paint) => paint && paint !== "none" && paint !== "rgba(0, 0, 0, 0)");
      if (paints.length && paints.every(isDarkNeutral)) shape.setAttribute("data-nightshade-theme-part", "true");
    }
  }

  function createController(document, hostname, routePathname) {
    const pathname = routePathname ?? document.location?.pathname ?? (() => {
      try { return new URL(document.baseURI).pathname; } catch { return ""; }
    })();
    let observer;
    let frame;
    let enabled = false;
    const pending = new Set();
    function classify(element) {
      // Only the outer SVG gets a filter; nested SVGs must not undo it again.
      if (element.localName === "svg") {
        if (element.parentElement?.closest("svg")) return;
        const mode = classifySvg(element);
        element.setAttribute(attribute, mode);
        themeLogoParts(element, mode);
      } else if (element.localName === "img") {
        if (imageRule(hostname, element.getAttribute("src") || "", document.baseURI)) {
          element.setAttribute(attribute, "theme");
        } else {
          element.removeAttribute(attribute);
        }
      } else if (element.localName === "canvas") {
        if (isThemeCanvas(hostname, pathname, element)) element.setAttribute(attribute, "theme");
        else element.removeAttribute(attribute);
      }
    }
    function scan(node) {
      if (node.nodeType !== 1) return;
      let owner = node.closest("svg");
      while (owner?.parentElement?.closest("svg")) owner = owner.parentElement.closest("svg");
      if (owner) classify(owner);
      if (node.matches("svg, img, canvas")) classify(node);
      node.querySelectorAll("svg, img, canvas").forEach(classify);
    }
    function flush() {
      frame = undefined;
      if (!enabled) return;
      for (const node of pending) if (node.isConnected) scan(node);
      pending.clear();
    }
    return {
      setEnabled(next) {
        if (next === enabled) return;
        enabled = next;
        if (!enabled) {
          observer?.disconnect();
          cancelAnimationFrame(frame);
          frame = undefined;
          pending.clear();
          return;
        }
        scan(document.documentElement);
        observer ??= new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === "attributes") pending.add(mutation.target);
            else {
              if (mutation.target.closest?.("svg")) pending.add(mutation.target);
              for (const node of mutation.addedNodes) if (node.nodeType === 1) pending.add(node);
            }
          }
          if (pending.size && frame === undefined) frame = requestAnimationFrame(flush);
        });
        observer.observe(document.documentElement, {
          childList: true, subtree: true, attributes: true,
          // Exclude our own markers to avoid a feedback loop.
          attributeFilter: ["src", "fill", "stroke", "style", "class", "opacity", "fill-opacity", "stroke-opacity", "aria-label", "aria-labelledby"]
        });
      }
    };
  }
  globalThis.NightshadeMedia = { createController, imageRule, classifySvg, isDarkNeutral, isThemeCanvas };
})();
