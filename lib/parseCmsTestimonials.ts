const TESTIMONIALS_HEADING = /what our clients say/i;

/** Strip GrapesJS canvas-only attributes that can differ between SSR and the browser. */
export function sanitizeCmsHtml(html: string): string {
  if (!html?.trim()) return "";

  return html
    .replace(/\sdraggable="(?:true|false)"/gi, "")
    .replace(/\sdata-highlightable="[^"]*"/gi, "")
    .replace(/\sdata-gjs-[a-z-]+="[^"]*"/gi, "")
    .replace(/\scontenteditable="(?:true|false)"/gi, "");
}

export function extractEmbeddedStyles(html: string): {
  htmlWithoutStyles: string;
  styles: string;
} {
  const styles: string[] = [];

  const htmlWithoutStyles = html.replace(
    /<style[^>]*>([\s\S]*?)<\/style>/gi,
    (_match, css: string) => {
      if (css?.trim()) styles.push(css.trim());
      return "";
    }
  );

  return {
    htmlWithoutStyles: htmlWithoutStyles.trim(),
    styles: styles.join("\n"),
  };
}

export function extractEmbeddedScripts(html: string): {
  htmlWithoutScripts: string;
  scripts: string;
} {
  const scripts: string[] = [];

  const htmlWithoutScripts = html.replace(
    /<script[^>]*>([\s\S]*?)<\/script>/gi,
    (_match, js: string) => {
      if (js?.trim()) scripts.push(js.trim());
      return "";
    }
  );

  return {
    htmlWithoutScripts: htmlWithoutScripts.trim(),
    scripts: scripts.join("\n"),
  };
}

/** Run GrapesJS inline scripts after React mounts (load event may have already fired). */
export function adaptCmsScriptForMount(script: string): string {
  if (!script.trim()) return "";

  let body = script.trim();
  const loadWrapper =
    /^window\.addEventListener\s*\(\s*['"]load['"]\s*,\s*function\s*\(\s*\)\s*\{/i;

  if (loadWrapper.test(body)) {
    body = body.replace(loadWrapper, "(function(){");
    if (body.endsWith("});")) {
      body = `${body.slice(0, -3)})();`;
    } else if (body.endsWith("}")) {
      body = `${body})();`;
    }
  }

  return body;
}

function extractBalancedElement(html: string, startIndex: number): string | null {
  const slice = html.slice(startIndex);
  const openMatch = slice.match(/^<([a-z0-9]+)[^>]*>/i);
  if (!openMatch) return null;

  const tag = openMatch[1].toLowerCase();
  let depth = 0;
  const tagRegex = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  tagRegex.lastIndex = startIndex;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(html)) !== null) {
    const token = match[0];
    if (token.startsWith("</")) depth -= 1;
    else if (!token.endsWith("/>")) depth += 1;

    if (depth === 0) {
      return html.slice(startIndex, tagRegex.lastIndex);
    }
  }

  return null;
}

function extractChildDivs(html: string, classPattern: RegExp): string[] {
  const results: string[] = [];
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const slice = html.slice(searchFrom);
    const divMatch = slice.match(/<div[^>]*>/i);
    if (!divMatch || divMatch.index === undefined) break;

    const absStart = searchFrom + divMatch.index;
    const classAttr = divMatch[0].match(/class="([^"]*)"/i)?.[1] ?? "";

    if (classPattern.test(classAttr)) {
      const element = extractBalancedElement(html, absStart);
      if (element) {
        results.push(element);
        searchFrom = absStart + element.length;
        continue;
      }
    }

    searchFrom = absStart + divMatch[0].length;
  }

  return results;
}

function findOutermostElementStart(html: string, markerIndex: number): number {
  const tagRegex = /<(section|div)\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html)) !== null) {
    if (match.index >= markerIndex) break;

    const tagName = match[1].toLowerCase();
    const slice = html.slice(match.index, markerIndex);
    const opens = (slice.match(new RegExp(`<${tagName}\\b`, "gi")) || []).length;
    const closes = (slice.match(new RegExp(`</${tagName}>`, "gi")) || []).length;

    if (opens > closes) {
      return match.index;
    }
  }

  return markerIndex;
}

function findTestimonialsSectionStart(html: string): number {
  const idMatch = html.match(/<(?:section|div)[^>]*\bid=["']itesti-section["'][^>]*>/i);
  if (idMatch?.index !== undefined) return idMatch.index;

  const legacyId = html.match(/<(?:section|div)[^>]*\bid=["']itestimonials["'][^>]*>/i);
  if (legacyId?.index !== undefined) return legacyId.index;

  const tsSection = html.match(/<(?:section|div)[^>]*\bts-section\b[^>]*>/i);
  if (tsSection?.index !== undefined) return tsSection.index;

  const classMatch = html.match(/<(?:section|div)[^>]*\btestimonials-section\b[^>]*>/i);
  if (classMatch?.index !== undefined) return classMatch.index;

  const commentMatch = html.match(
    /<!--\s*={3,}\s*TESTIMONIALS(?:\s+SECTION)?\s*={3,}\s*-->/i
  );
  if (commentMatch?.index !== undefined) {
    const afterComment = html.slice(commentMatch.index + commentMatch[0].length);
    const divMatch = afterComment.match(/<div\b/i);
    if (divMatch?.index !== undefined) {
      return commentMatch.index + commentMatch[0].length + divMatch.index;
    }
  }

  const headingIndex = html.search(TESTIMONIALS_HEADING);
  if (headingIndex === -1) return -1;

  return findOutermostElementStart(html, headingIndex);
}

function findCardsContainerStart(sectionHtml: string): number {
  const idRow = sectionHtml.match(/<div[^>]*\bid=["']itest-row["'][^>]*>/i);
  if (idRow?.index !== undefined) return idRow.index;

  const rowMatch = sectionHtml.match(/<div[^>]*class="[^"]*\brow\b[^"]*"[^>]*>/i);
  if (rowMatch?.index !== undefined) return rowMatch.index;

  const flexMatch = sectionHtml.match(
    /<div[^>]*class="[^"]*\b(?:d-flex|flex-row|flex-column)\b[^"]*"[^>]*>/i
  );
  if (flexMatch?.index !== undefined) return flexMatch.index;

  return -1;
}

function extractDirectChildDivs(containerHtml: string): string[] {
  const openMatch = containerHtml.match(/^<div[^>]*>/i);
  if (!openMatch) return [];

  const innerStart = openMatch[0].length;
  const innerEnd = containerHtml.lastIndexOf("</div>");
  if (innerEnd <= innerStart) return [];

  const inner = containerHtml.slice(innerStart, innerEnd);
  const results: string[] = [];
  let pos = 0;

  while (pos < inner.length) {
    const remainder = inner.slice(pos);
    const nextDiv = remainder.search(/<div\b/i);
    if (nextDiv === -1) break;

    pos += nextDiv;
    const element = extractBalancedElement(inner, pos);
    if (!element) break;

    results.push(element);
    pos += element.length;
  }

  return results;
}

function extractCards(sectionHtml: string): string[] {
  const containerStart = findCardsContainerStart(sectionHtml);
  if (containerStart >= 0) {
    const container = extractBalancedElement(sectionHtml, containerStart);
    if (container) {
      const cols = extractChildDivs(container, /\bcol(?:-[a-z0-9-]+)?\b/);
      if (cols.length >= 2) return cols;

      const cards = extractChildDivs(container, /\btestimonial-card\b/);
      if (cards.length >= 2) return cards;

      const children = extractDirectChildDivs(container);
      if (children.length >= 2) return children;
    }
  }

  const cols = extractChildDivs(sectionHtml, /\bcol(?:-[a-z0-9-]+)?\b/);
  if (cols.length >= 2) return cols;

  return [];
}

function extractHeaderHtml(sectionHtml: string, cards: string[]): string {
  const headingMatch = sectionHtml.match(/<div[^>]*\bid=["']itest-heading["'][^>]*>/i);
  if (headingMatch?.index !== undefined) {
    const heading = extractBalancedElement(sectionHtml, headingMatch.index);
    if (heading) return heading;
  }

  if (!cards.length) return sectionHtml;

  const firstCardIndex = sectionHtml.indexOf(cards[0]);
  if (firstCardIndex <= 0) return sectionHtml;

  const containerStart = findCardsContainerStart(sectionHtml.slice(0, firstCardIndex));
  const headerEnd = containerStart >= 0 ? containerStart : firstCardIndex;

  return sectionHtml.slice(0, headerEnd).trim();
}

function extractSectionClassName(sectionHtml: string): string {
  const classMatch = sectionHtml.match(/^<(?:section|div)[^>]*class="([^"]*)"/i);
  return classMatch?.[1]?.trim() ?? "w-100 border-top cutter-section testimonials-section";
}

export function parseCmsTestimonialsHtml(html: string): {
  beforeHtml: string;
  headerHtml: string;
  cards: string[];
  sectionHtml: string;
  sectionClassName: string;
  embeddedStyles: string;
} {
  if (!html?.trim()) {
    return {
      beforeHtml: "",
      headerHtml: "",
      cards: [],
      sectionHtml: "",
      sectionClassName: "w-100 border-top cutter-section testimonials-section",
      embeddedStyles: "",
    };
  }

  const { htmlWithoutStyles, styles: embeddedStyles } = extractEmbeddedStyles(html);
  const sectionStart = findTestimonialsSectionStart(htmlWithoutStyles);

  if (sectionStart === -1) {
    return {
      beforeHtml: htmlWithoutStyles,
      headerHtml: "",
      cards: [],
      sectionHtml: "",
      sectionClassName: "w-100 border-top cutter-section testimonials-section",
      embeddedStyles,
    };
  }

  const sectionElement = extractBalancedElement(htmlWithoutStyles, sectionStart);
  const sectionHtml = sectionElement?.trim() ?? htmlWithoutStyles.slice(sectionStart).trim();
  const beforeHtml = htmlWithoutStyles.slice(0, sectionStart).trim();
  const cards = extractCards(sectionHtml);
  const headerHtml = extractHeaderHtml(sectionHtml, cards);
  const sectionClassName = extractSectionClassName(sectionHtml);

  return {
    beforeHtml,
    headerHtml,
    cards,
    sectionHtml,
    sectionClassName,
    embeddedStyles,
  };
}
