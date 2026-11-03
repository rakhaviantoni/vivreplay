(() => {
  const sheet = document.querySelector(".sheet");
  const contents = document.getElementById("package-contents");
  const pageSizeStyle = document.getElementById("label-page-size");
  const status = document.getElementById("export-status");
  const language = document.documentElement.lang === "id" ? "id" : "en";
  const reference = sheet?.dataset.reference || "shipping-label";
  const paperSizes = {
    thermal: { width: 100, height: 150 },
    a6: { width: 105, height: 148 },
  };
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[char]);

  document.querySelectorAll("[data-contents-layout]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!contents) return;
      const layout = button.dataset.contentsLayout;
      contents.dataset.layout = layout;
      document.querySelectorAll("[data-contents-layout]").forEach((option) => {
        option.setAttribute("aria-pressed", String(option === button));
      });
    });
  });

  document.querySelectorAll("[data-paper-size]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!sheet || !pageSizeStyle) return;
      const size = button.dataset.paperSize;
      const dimensions = paperSizes[size] || paperSizes.thermal;
      sheet.dataset.paperSize = size;
      sheet.style.width = `${dimensions.width}mm`;
      sheet.style.height = `${dimensions.height}mm`;
      sheet.style.minHeight = `${dimensions.height}mm`;
      pageSizeStyle.textContent = `@page{size:${dimensions.width}mm ${dimensions.height}mm;margin:0}@media print{html,body{width:${dimensions.width}mm;height:${dimensions.height}mm}.sheet{width:${dimensions.width}mm;height:${dimensions.height}mm;min-height:${dimensions.height}mm;margin:0}}`;
      document.querySelectorAll("[data-paper-size]").forEach((option) => {
        option.setAttribute("aria-pressed", String(option === button));
      });
    });
  });

  document.querySelector("[data-print]")?.addEventListener("click", () => window.print());

  function collectBackgrounds(root, origin, factor) {
    const output = [];
    const elements = [root, ...root.querySelectorAll("*")];
    for (const element of elements) {
      if (!(element instanceof HTMLElement)) continue;
      const rect = element.getBoundingClientRect();
      const x = (rect.left - origin.left) * factor;
      const y = (rect.top - origin.top) * factor;
      const width = rect.width * factor;
      const height = rect.height * factor;
      if (width <= 0 || height <= 0) continue;
      const style = getComputedStyle(element);
      if (style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent") {
        output.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${esc(style.backgroundColor)}"/>`);
      }
      const sides = [
        ["Top", x, y, x + width, y],
        ["Right", x + width, y, x + width, y + height],
        ["Bottom", x, y + height, x + width, y + height],
        ["Left", x, y, x, y + height],
      ];
      for (const [side, x1, y1, x2, y2] of sides) {
        const borderWidth = parseFloat(style[`border${side}Width`]) * factor;
        const borderStyle = style[`border${side}Style`];
        const borderColor = style[`border${side}Color`];
        if (borderWidth > 0 && borderStyle !== "none" && borderColor !== "rgba(0, 0, 0, 0)") {
          output.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${esc(borderColor)}" stroke-width="${borderWidth}"/>`);
        }
      }
    }
    return output.join("");
  }

  async function collectImages(root, origin, factor) {
    const output = [];
    for (const image of root.querySelectorAll("img")) {
      const rect = image.getBoundingClientRect();
      if (!rect.width || !rect.height || !image.complete || !image.naturalWidth) continue;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d")?.drawImage(image, 0, 0);
        const data = canvas.toDataURL("image/png");
        output.push(`<image x="${(rect.left - origin.left) * factor}" y="${(rect.top - origin.top) * factor}" width="${rect.width * factor}" height="${rect.height * factor}" href="${data}" preserveAspectRatio="xMidYMid meet"/>`);
      } catch {
        // Skip an image that the browser cannot safely export.
      }
    }
    return output.join("");
  }

  function collectBarcode(root, origin, factor) {
    const output = [];
    for (const svg of root.querySelectorAll("svg.barcode")) {
      const rect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      if (!rect.width || !rect.height || !viewBox.width || !viewBox.height) continue;
      const scaleX = rect.width / viewBox.width;
      const scaleY = rect.height / viewBox.height;
      for (const bar of svg.querySelectorAll("rect")) {
        const x = Number(bar.getAttribute("x") || 0);
        const y = Number(bar.getAttribute("y") || 0);
        const width = Number(bar.getAttribute("width") || 0);
        const height = Number(bar.getAttribute("height") || 0);
        const fill = bar.getAttribute("fill") || getComputedStyle(bar).fill || "#000";
        output.push(`<rect x="${(rect.left - origin.left + x * scaleX) * factor}" y="${(rect.top - origin.top + y * scaleY) * factor}" width="${width * scaleX * factor}" height="${height * scaleY * factor}" fill="${esc(fill)}"/>`);
      }
    }
    return output.join("");
  }

  function collectText(root, origin, factor) {
    const output = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim()) continue;
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "SVG"].includes(parent.tagName)) continue;
      const style = getComputedStyle(parent);
      const fontSize = parseFloat(style.fontSize) || 12;
      const chars = Array.from(node.textContent);
      let offset = 0;
      let line = null;
      const flush = () => {
        if (!line?.text) return;
        const transform = style.textTransform;
        const text = transform === "uppercase" ? line.text.toLocaleUpperCase() : transform === "lowercase" ? line.text.toLocaleLowerCase() : line.text;
        output.push(`<text x="${line.x * factor}" y="${(line.top + fontSize * 0.86) * factor}" fill="${esc(style.color)}" font-family="${esc(style.fontFamily)}" font-size="${fontSize * factor}" font-weight="${esc(style.fontWeight)}" font-style="${esc(style.fontStyle)}" letter-spacing="${parseFloat(style.letterSpacing) ? parseFloat(style.letterSpacing) * factor : 0}" xml:space="preserve">${esc(text)}</text>`);
        line = null;
      };
      for (const char of chars) {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + char.length);
        offset += char.length;
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (!line || Math.abs(rect.top - line.top) > 1 || rect.left > line.right + 2) {
          flush();
          line = { x: rect.left - origin.left, top: rect.top - origin.top, right: rect.right - origin.left, text: char };
        } else {
          line.right = rect.right - origin.left;
          line.text += char;
        }
      }
      flush();
    }
    return output.join("");
  }

  async function render(format, scale, quality) {
    const selectedSize = paperSizes[sheet?.dataset.paperSize] || paperSizes.thermal;
    const root = sheet;
    const bounds = root.getBoundingClientRect();
    const width = Math.round(selectedSize.width * 96 / 25.4);
    const height = Math.round(selectedSize.height * 96 / 25.4);
    const factor = width / bounds.width;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width * scale)}" height="${Math.round(height * scale)}" viewBox="0 0 ${width} ${height}">${collectBackgrounds(root, bounds, factor)}${await collectImages(root, bounds, factor)}${collectBarcode(root, bounds, factor)}${collectText(root, bounds, factor)}</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Could not render the label image.")); image.src = url; });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode the label image.")), format === "png" ? "image/png" : "image/jpeg", quality);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function download(button) {
    const format = button.dataset.export;
    button.disabled = true;
    status.textContent = language === "id" ? "Menyiapkan gambar…" : "Preparing image…";
    try {
      let result = null;
      const scales = [3.125, 2.75, 2.375, 2, 1.625, 1.25];
      const qualities = format === "png" ? [undefined] : [0.9, 0.82, 0.74, 0.66];
      for (const scale of scales) {
        for (const quality of qualities) {
          result = await render(format, scale, quality);
          if (result && result.size <= 1_000_000) break;
        }
        if (result && result.size <= 1_000_000) break;
      }
      if (!result || result.size > 1_000_000) throw new Error("The image is larger than 1 MB.");
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(result);
      link.href = objectUrl;
      link.download = `${reference}_label.${format === "jpeg" ? "jpg" : "png"}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      status.textContent = language === "id" ? "Gambar diunduh (maks. 1 MB)." : "Image downloaded (1 MB max).";
    } catch (error) {
      console.error("Shipping label export failed:", error);
      status.textContent = language === "id" ? "Gambar tidak dapat dibuat. Coba format JPEG atau cetak sebagai PDF." : "Could not create the image. Try JPEG or print as PDF.";
    } finally {
      button.disabled = false;
    }
  }

  document.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => void download(button));
  });
})();
