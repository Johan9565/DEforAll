/**
 * Shared helpers to turn SVG / canvas output into data URIs
 * and insert them as TipTap images.
 */

export function svgToDataUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function canvasToPngDataUri(canvas: HTMLCanvasElement, quality = 1): string {
  return canvas.toDataURL('image/png', quality);
}

export interface InsertImageOptions {
  alt?: string;
  width?: number;
  height?: number;
  alignment?: 'left' | 'center' | 'right';
}

export function insertImage(
  editor: any,
  src: string,
  opts: InsertImageOptions = {},
): boolean {
  const { alt = '', width, height, alignment = 'center' } = opts;
  return editor
    .chain()
    .focus()
    .setImage({
      src,
      alt,
      ...(width != null ? { width } : {}),
      ...(height != null ? { height } : {}),
      alignment,
    })
    .run();
}

/** Escape a string for safe inclusion in SVG text content. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wrap a text string into multiple lines so it fits within `maxChars` per line.
 * Returns an array of lines (max `maxLines`, last line ellipsized).
 */
export function wrapText(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w;
    } else if ((current + ' ' + w).length <= maxChars) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines) {
    const consumed = lines.join(' ').length;
    if (consumed < text.trim().length) {
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, Math.max(0, maxChars - 1)) + '…';
    }
  }
  return lines;
}
