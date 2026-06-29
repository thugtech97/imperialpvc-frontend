import { resolvePageContent, resolvePageStyles } from "@/lib/cmsPageContent";
import {
  parseCmsTestimonialsHtml,
  sanitizeCmsHtml,
  extractEmbeddedStyles,
  extractEmbeddedScripts,
} from "@/lib/parseCmsTestimonials";
import type { PublicPage } from "@/services/publicPageService";

export type PreparedHomeCms = {
  middleCmsHtml: string;
  testimonialsHtml: string;
  pageStyles: string;
};

function buildCarouselSectionHtml(
  headerHtml: string,
  cards: string[],
  sectionClassName: string
): string {
  if (!cards.length) return "";

  const slots = cards.map((card) => `<div class="ts-slot flex-shrink-0">${card}</div>`).join("");

  return `
<div class="${sectionClassName} ts-section">
  ${headerHtml}
  <div class="ts-wrap position-relative px-3">
    <button type="button" id="tsPrev" class="ts-arrow ts-arrow-prev" aria-label="Previous">&#8249;</button>
    <div id="tsViewport" class="overflow-hidden">
      <div id="tsTrack" class="d-flex">${slots}</div>
    </div>
    <button type="button" id="tsNext" class="ts-arrow ts-arrow-next" aria-label="Next">&#8250;</button>
    <div id="tsDots" class="ts-dots d-flex justify-content-center gap-2 mt-4"></div>
  </div>
</div>`.trim();
}

function normalizeTestimonialsSection(
  cmsSections: ReturnType<typeof parseCmsTestimonialsHtml>
): string {
  let sectionHtml = cmsSections.sectionHtml?.trim() ?? "";

  if (!sectionHtml) return "";

  const hasCarouselMarkup =
    sectionHtml.includes('id="tsTrack"') &&
    sectionHtml.includes('id="tsViewport"');

  if (hasCarouselMarkup) return sectionHtml;

  if (cmsSections.cards.length >= 2) {
    return buildCarouselSectionHtml(
      cmsSections.headerHtml,
      cmsSections.cards,
      cmsSections.sectionClassName
    );
  }

  return sectionHtml;
}

export function prepareHomePageCms(pageData: PublicPage | null): PreparedHomeCms {
  const rawContent = resolvePageContent(pageData ?? { content: "", json: undefined });
  const { htmlWithoutStyles, styles: embeddedStyles } = extractEmbeddedStyles(
    sanitizeCmsHtml(rawContent)
  );
  const { htmlWithoutScripts } = extractEmbeddedScripts(htmlWithoutStyles);
  const cmsSections = parseCmsTestimonialsHtml(htmlWithoutScripts);
  const testimonialsHtml = normalizeTestimonialsSection(cmsSections);
  const hasTestimonialsSection = Boolean(testimonialsHtml);
  const basePageStyles = resolvePageStyles(
    pageData ?? { styles: undefined, json: undefined }
  );
  const pageStyles = [basePageStyles, embeddedStyles, cmsSections.embeddedStyles]
    .filter(Boolean)
    .join("\n");

  return {
    middleCmsHtml: hasTestimonialsSection ? cmsSections.beforeHtml : htmlWithoutScripts,
    testimonialsHtml,
    pageStyles,
  };
}
