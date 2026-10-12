import { optimizeImage } from './imageOptimizer';

export interface ImageFilterDef {
  id: string;
  label: string;
  cssFilter: string;
  icon?: string;
}

export const IMAGE_FILTERS: ImageFilterDef[] = [
  { id: 'none', label: 'Sin filtro', cssFilter: 'none' },
  { id: 'grayscale', label: 'Blanco y negro', cssFilter: 'grayscale(100%)' },
  { id: 'sepia', label: 'Sepia', cssFilter: 'sepia(90%)' },
  { id: 'contrast', label: 'Alto contraste', cssFilter: 'contrast(150%) brightness(105%)' },
  { id: 'bright', label: 'Luminoso', cssFilter: 'brightness(125%) contrast(105%)' },
  { id: 'vintage', label: 'Vintage / Cálido', cssFilter: 'sepia(45%) contrast(115%) saturate(135%)' },
  { id: 'cool', label: 'Tono frío', cssFilter: 'hue-rotate(185deg) saturate(90%)' },
  { id: 'invert', label: 'Invertir / Negativo', cssFilter: 'invert(100%)' },
  { id: 'blur', label: 'Desenfoque suave', cssFilter: 'blur(3px)' },
];

export function getFilterCss(filterId: string | null | undefined): string {
  if (!filterId || filterId === 'none') return 'none';
  const found = IMAGE_FILTERS.find((f) => f.id === filterId);
  return found ? found.cssFilter : filterId;
}

/**
 * Crops an image based on normalized crop coordinates (0..1 percentage).
 */
export async function cropImageDataUrl(
  dataUrl: string,
  crop: { x: number; y: number; width: number; height: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = async () => {
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;

      const sx = Math.max(0, Math.round(crop.x * naturalW));
      const sy = Math.max(0, Math.round(crop.y * naturalH));
      const sw = Math.min(naturalW - sx, Math.round(crop.width * naturalW));
      const sh = Math.min(naturalH - sy, Math.round(crop.height * naturalH));

      if (sw <= 0 || sh <= 0) {
        resolve(dataUrl);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const croppedUrl = canvas.toDataURL('image/webp', 0.88);
      // Run through optimizer for optimal size
      const optimized = await optimizeImage(croppedUrl);
      resolve(optimized.dataUrl);
    };

    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = dataUrl;
  });
}

/**
 * Opens a modal for cropping the given image.
 */
export function openCropModal(
  imageSrc: string,
  onApply: (croppedSrc: string) => void,
): void {
  const overlay = document.createElement('div');
  overlay.className = 'cde-crop-modal-overlay';
  overlay.tabIndex = -1;

  overlay.innerHTML = `
    <div class="cde-crop-modal">
      <div class="cde-crop-modal__header">
        <span class="cde-crop-modal__title">Recortar imagen</span>
        <div class="cde-crop-modal__aspects">
          <button type="button" class="cde-crop-aspect-btn is-active" data-aspect="free">Libre</button>
          <button type="button" class="cde-crop-aspect-btn" data-aspect="1:1">1:1 (Cuadrado)</button>
          <button type="button" class="cde-crop-aspect-btn" data-aspect="4:3">4:3</button>
          <button type="button" class="cde-crop-aspect-btn" data-aspect="16:9">16:9</button>
        </div>
        <button type="button" class="cde-crop-modal__close">&times;</button>
      </div>
      <div class="cde-crop-modal__body">
        <div class="cde-crop-container">
          <img class="cde-crop-image" src="${imageSrc}" alt="Crop source" draggable="false" />
          <div class="cde-crop-box">
            <div class="cde-crop-box__view"></div>
            <div class="cde-crop-handle cde-crop-handle--nw" data-dir="nw"></div>
            <div class="cde-crop-handle cde-crop-handle--ne" data-dir="ne"></div>
            <div class="cde-crop-handle cde-crop-handle--sw" data-dir="sw"></div>
            <div class="cde-crop-handle cde-crop-handle--se" data-dir="se"></div>
            <div class="cde-crop-handle cde-crop-handle--n" data-dir="n"></div>
            <div class="cde-crop-handle cde-crop-handle--s" data-dir="s"></div>
            <div class="cde-crop-handle cde-crop-handle--w" data-dir="w"></div>
            <div class="cde-crop-handle cde-crop-handle--e" data-dir="e"></div>
          </div>
        </div>
      </div>
      <div class="cde-crop-modal__footer">
        <button type="button" class="cde-crop-btn cde-crop-btn--cancel">Cancelar</button>
        <button type="button" class="cde-crop-btn cde-crop-btn--apply">Aplicar recorte</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const imgEl = overlay.querySelector('.cde-crop-image') as HTMLImageElement;
  const boxEl = overlay.querySelector('.cde-crop-box') as HTMLElement;
  const closeBtn = overlay.querySelector('.cde-crop-modal__close') as HTMLButtonElement;
  const cancelBtn = overlay.querySelector('.cde-crop-btn--cancel') as HTMLButtonElement;
  const applyBtn = overlay.querySelector('.cde-crop-btn--apply') as HTMLButtonElement;
  const aspectBtns = Array.from(overlay.querySelectorAll<HTMLButtonElement>('.cde-crop-aspect-btn'));

  let currentAspect: number | null = null; // null = free

  // Crop box state in container pixels
  let box = { x: 20, y: 20, w: 200, h: 200 };

  const updateBoxDom = () => {
    boxEl.style.left = `${box.x}px`;
    boxEl.style.top = `${box.y}px`;
    boxEl.style.width = `${box.w}px`;
    boxEl.style.height = `${box.h}px`;
  };

  imgEl.onload = () => {
    const imgLeft = imgEl.offsetLeft;
    const imgTop = imgEl.offsetTop;
    const imgW = imgEl.offsetWidth;
    const imgH = imgEl.offsetHeight;

    // Default crop box: 80% centered
    const w = Math.round(imgW * 0.85);
    const h = Math.round(imgH * 0.85);
    box = {
      x: imgLeft + Math.round((imgW - w) / 2),
      y: imgTop + Math.round((imgH - h) / 2),
      w,
      h,
    };
    updateBoxDom();
  };

  aspectBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      aspectBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const aspectVal = btn.dataset.aspect;
      if (aspectVal === '1:1') currentAspect = 1;
      else if (aspectVal === '4:3') currentAspect = 4 / 3;
      else if (aspectVal === '16:9') currentAspect = 16 / 9;
      else currentAspect = null;

      if (currentAspect) {
        box.h = Math.round(box.w / currentAspect);
        const maxH = imgEl.offsetHeight;
        if (box.h > maxH) {
          box.h = maxH;
          box.w = Math.round(box.h * currentAspect);
        }
        updateBoxDom();
      }
    });
  });

  // Dragging crop box or handles
  let activeAction: {
    type: 'move' | 'resize';
    dir?: string;
    startX: number;
    startY: number;
    startBox: typeof box;
  } | null = null;

  boxEl.addEventListener('mousedown', (e) => {
    const handle = (e.target as HTMLElement).closest('.cde-crop-handle') as HTMLElement | null;
    e.preventDefault();
    e.stopPropagation();

    if (handle) {
      activeAction = {
        type: 'resize',
        dir: handle.dataset.dir,
        startX: e.clientX,
        startY: e.clientY,
        startBox: { ...box },
      };
    } else {
      activeAction = {
        type: 'move',
        startX: e.clientX,
        startY: e.clientY,
        startBox: { ...box },
      };
    }
  });

  const onPointerMove = (e: MouseEvent) => {
    if (!activeAction) return;
    const dx = e.clientX - activeAction.startX;
    const dy = e.clientY - activeAction.startY;
    const imgLeft = imgEl.offsetLeft;
    const imgTop = imgEl.offsetTop;
    const imgW = imgEl.offsetWidth;
    const imgH = imgEl.offsetHeight;

    if (activeAction.type === 'move') {
      let newX = activeAction.startBox.x + dx;
      let newY = activeAction.startBox.y + dy;

      newX = Math.max(imgLeft, Math.min(imgLeft + imgW - activeAction.startBox.w, newX));
      newY = Math.max(imgTop, Math.min(imgTop + imgH - activeAction.startBox.h, newY));

      box.x = newX;
      box.y = newY;
      updateBoxDom();
    } else if (activeAction.type === 'resize') {
      const dir = activeAction.dir || 'se';
      const sb = activeAction.startBox;
      let newX = sb.x;
      let newY = sb.y;
      let newW = sb.w;
      let newH = sb.h;

      if (dir.includes('e')) newW = Math.max(40, sb.w + dx);
      if (dir.includes('s')) newH = Math.max(40, sb.h + dy);
      if (dir.includes('w')) {
        const potentialW = Math.max(40, sb.w - dx);
        newX = sb.x + (sb.w - potentialW);
        newW = potentialW;
      }
      if (dir.includes('n')) {
        const potentialH = Math.max(40, sb.h - dy);
        newY = sb.y + (sb.h - potentialH);
        newH = potentialH;
      }

      if (currentAspect) {
        if (dir.includes('e') || dir.includes('w')) {
          newH = Math.round(newW / currentAspect);
        } else {
          newW = Math.round(newH * currentAspect);
        }
      }

      // Constrain within image boundaries
      newX = Math.max(imgLeft, newX);
      newY = Math.max(imgTop, newY);
      newW = Math.min(imgLeft + imgW - newX, newW);
      newH = Math.min(imgTop + imgH - newY, newH);

      box = { x: newX, y: newY, w: newW, h: newH };
      updateBoxDom();
    }
  };

  const onPointerUp = () => {
    activeAction = null;
  };

  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  const cleanup = () => {
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    overlay.remove();
  };

  closeBtn.addEventListener('click', cleanup);
  cancelBtn.addEventListener('click', cleanup);

  applyBtn.addEventListener('click', async () => {
    applyBtn.disabled = true;
    applyBtn.textContent = 'Procesando...';

    const imgLeft = imgEl.offsetLeft;
    const imgTop = imgEl.offsetTop;
    const imgW = imgEl.offsetWidth;
    const imgH = imgEl.offsetHeight;

    // Convert pixel coordinates to normalized 0..1 percentages
    const normX = Math.max(0, (box.x - imgLeft) / imgW);
    const normY = Math.max(0, (box.y - imgTop) / imgH);
    const normW = Math.min(1 - normX, box.w / imgW);
    const normH = Math.min(1 - normY, box.h / imgH);

    try {
      const cropped = await cropImageDataUrl(imageSrc, {
        x: normX,
        y: normY,
        width: normW,
        height: normH,
      });
      cleanup();
      onApply(cropped);
    } catch {
      cleanup();
    }
  });
}
