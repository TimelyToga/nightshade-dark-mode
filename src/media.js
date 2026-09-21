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

  function createController(document, hostname) {
    let observer;
    let frame;
    let enabled = false;
    const pending = new Set();
    function classify(element) {
      // Only the outer SVG gets a filter; nested SVGs must not undo it again.
      if (element.localName === "svg") {
        if (element.parentElement?.closest("svg")) return;
        element.setAttribute(attribute, classifySvg(element));
      } else if (element.localName === "img") {
        if (imageRule(hostname, element.getAttribute("src") || "", document.baseURI)) {
          element.setAttribute(attribute, "theme");
        } else {
          element.removeAttribute(attribute);
        }
      }
    }
    function scan(node) {
      if (node.nodeType !== 1) return;
      let owner = node.closest("svg");
      while (owner?.parentElement?.closest("svg")) owner = owner.parentElement.closest("svg");
      if (owner) classify(owner);
      if (node.matches("svg, img")) classify(node);
      node.querySelectorAll("svg, img").forEach(classify);
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
          attributeFilter: ["src", "fill", "stroke", "style", "class", "opacity"]
        });
      }
    };
  }
  globalThis.NightshadeMedia = { createController, imageRule, classifySvg };
})();
