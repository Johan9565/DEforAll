import type { PageMargins } from './types';
import type { PageMetrics } from './extensions/pageMetrics';
import type { DocumentRestrictions } from './types';

export type RulerUnit = 'cm' | 'in';

export interface RulerOptions {
  stageElement: HTMLElement;
  getMetrics: () => PageMetrics;
  getRestrictions: () => DocumentRestrictions;
  getActivePageOffset?: () => { top: number; width: number; height: number };
  onMarginsChange: (margins: Partial<PageMargins>) => void;
  defaultUnit?: RulerUnit;
}

export class Ruler {
  private readonly stageElement: HTMLElement;
  private readonly getMetrics: () => PageMetrics;
  private readonly getRestrictions: () => DocumentRestrictions;
  private readonly onMarginsChange: (margins: Partial<PageMargins>) => void;
  private readonly getActivePageOffset?: () => { top: number; width: number; height: number };

  private unit: RulerUnit;
  private visible = true;

  private topBarEl!: HTMLElement;
  private cornerEl!: HTMLButtonElement;
  private hRulerWrapper!: HTMLElement;
  private hRulerEl!: HTMLElement;
  private hActiveEl!: HTMLElement;
  private hLeftMarginEl!: HTMLElement;
  private hRightMarginEl!: HTMLElement;
  private hLeftHandle!: HTMLElement;
  private hRightHandle!: HTMLElement;
  private hTicksEl!: HTMLElement;

  private mainRowEl!: HTMLElement;
  private vRulerWrapper!: HTMLElement;
  private vRulerEl!: HTMLElement;
  private vActiveEl!: HTMLElement;
  private vTopMarginEl!: HTMLElement;
  private vBottomMarginEl!: HTMLElement;
  private vTopHandle!: HTMLElement;
  private vBottomHandle!: HTMLElement;
  private vTicksEl!: HTMLElement;

  private guideLineH!: HTMLElement;
  private guideLineV!: HTMLElement;
  private tooltipEl!: HTMLElement;

  private scrollHandler?: () => void;
  private destroyed = false;

  constructor(options: RulerOptions) {
    this.stageElement = options.stageElement;
    this.getMetrics = options.getMetrics;
    this.getRestrictions = options.getRestrictions;
    this.onMarginsChange = options.onMarginsChange;
    this.getActivePageOffset = options.getActivePageOffset;
    this.unit = options.defaultUnit ?? 'cm';

    this.buildDom();
    this.attachScrollSync();
    this.update();
  }

  private buildDom(): void {
    // Top Bar: Corner + Horizontal Ruler
    this.topBarEl = document.createElement('div');
    this.topBarEl.className = 'cde-ruler-top-bar';

    this.cornerEl = document.createElement('button');
    this.cornerEl.type = 'button';
    this.cornerEl.className = 'cde-ruler-corner';
    this.cornerEl.title = `Unidad: ${this.unit.toUpperCase()} (clic para cambiar a ${this.unit === 'cm' ? 'PULGADAS' : 'CM'}, doble clic para configurar márgenes)`;
    this.cornerEl.innerHTML = `
      <span class="cde-ruler-corner-unit">${this.unit}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16v16H4zM4 10h5M4 16h5M10 4v5M16 4v5"/></svg>
    `;
    this.cornerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleUnit();
    });
    this.cornerEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.promptCustomMargins();
    });
    this.topBarEl.appendChild(this.cornerEl);

    this.hRulerWrapper = document.createElement('div');
    this.hRulerWrapper.className = 'cde-ruler-h-wrapper';

    this.hRulerEl = document.createElement('div');
    this.hRulerEl.className = 'cde-ruler cde-ruler--horizontal';
    this.hRulerEl.addEventListener('dblclick', () => this.promptCustomMargins());

    this.hLeftMarginEl = document.createElement('div');
    this.hLeftMarginEl.className = 'cde-ruler-margin-zone cde-ruler-margin-zone--left';
    this.hRulerEl.appendChild(this.hLeftMarginEl);

    this.hActiveEl = document.createElement('div');
    this.hActiveEl.className = 'cde-ruler-active-zone cde-ruler-active-zone--h';
    this.hRulerEl.appendChild(this.hActiveEl);

    this.hRightMarginEl = document.createElement('div');
    this.hRightMarginEl.className = 'cde-ruler-margin-zone cde-ruler-margin-zone--right';
    this.hRulerEl.appendChild(this.hRightMarginEl);

    this.hTicksEl = document.createElement('div');
    this.hTicksEl.className = 'cde-ruler-ticks cde-ruler-ticks--h';
    this.hRulerEl.appendChild(this.hTicksEl);

    this.hLeftHandle = document.createElement('div');
    this.hLeftHandle.className = 'cde-ruler-handle cde-ruler-handle--left';
    this.hLeftHandle.title = 'Margen izquierdo (arrastre para ajustar, doble clic para configurar)';
    this.hLeftHandle.innerHTML = `<div class="cde-ruler-marker-icon cde-ruler-marker-icon--down"></div>`;
    this.hLeftHandle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.promptCustomMargins();
    });
    this.hRulerEl.appendChild(this.hLeftHandle);

    this.hRightHandle = document.createElement('div');
    this.hRightHandle.className = 'cde-ruler-handle cde-ruler-handle--right';
    this.hRightHandle.title = 'Margen derecho (arrastre para ajustar, doble clic para configurar)';
    this.hRightHandle.innerHTML = `<div class="cde-ruler-marker-icon cde-ruler-marker-icon--down"></div>`;
    this.hRightHandle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.promptCustomMargins();
    });
    this.hRulerEl.appendChild(this.hRightHandle);

    this.hRulerWrapper.appendChild(this.hRulerEl);
    this.topBarEl.appendChild(this.hRulerWrapper);

    // Main Row: Vertical Ruler Wrapper + Document Stage
    this.mainRowEl = document.createElement('div');
    this.mainRowEl.className = 'cde-editor-main-row';

    this.vRulerWrapper = document.createElement('div');
    this.vRulerWrapper.className = 'cde-ruler-v-wrapper';

    this.vRulerEl = document.createElement('div');
    this.vRulerEl.className = 'cde-ruler cde-ruler--vertical';
    this.vRulerEl.addEventListener('dblclick', () => this.promptCustomMargins());

    this.vTopMarginEl = document.createElement('div');
    this.vTopMarginEl.className = 'cde-ruler-margin-zone cde-ruler-margin-zone--top';
    this.vRulerEl.appendChild(this.vTopMarginEl);

    this.vActiveEl = document.createElement('div');
    this.vActiveEl.className = 'cde-ruler-active-zone cde-ruler-active-zone--v';
    this.vRulerEl.appendChild(this.vActiveEl);

    this.vBottomMarginEl = document.createElement('div');
    this.vBottomMarginEl.className = 'cde-ruler-margin-zone cde-ruler-margin-zone--bottom';
    this.vRulerEl.appendChild(this.vBottomMarginEl);

    this.vTicksEl = document.createElement('div');
    this.vTicksEl.className = 'cde-ruler-ticks cde-ruler-ticks--v';
    this.vRulerEl.appendChild(this.vTicksEl);

    this.vTopHandle = document.createElement('div');
    this.vTopHandle.className = 'cde-ruler-handle cde-ruler-handle--top';
    this.vTopHandle.title = 'Margen superior (arrastre para ajustar, doble clic para configurar)';
    this.vTopHandle.innerHTML = `<div class="cde-ruler-marker-icon cde-ruler-marker-icon--right"></div>`;
    this.vTopHandle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.promptCustomMargins();
    });
    this.vRulerEl.appendChild(this.vTopHandle);

    this.vBottomHandle = document.createElement('div');
    this.vBottomHandle.className = 'cde-ruler-handle cde-ruler-handle--bottom';
    this.vBottomHandle.title = 'Margen inferior (arrastre para ajustar, doble clic para configurar)';
    this.vBottomHandle.innerHTML = `<div class="cde-ruler-marker-icon cde-ruler-marker-icon--right"></div>`;
    this.vBottomHandle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.promptCustomMargins();
    });
    this.vRulerEl.appendChild(this.vBottomHandle);

    this.vRulerWrapper.appendChild(this.vRulerEl);
    this.mainRowEl.appendChild(this.vRulerWrapper);

    // Reposition stage inside mainRowEl
    const parent = this.stageElement.parentElement;
    if (parent) {
      parent.insertBefore(this.topBarEl, this.stageElement);
      parent.insertBefore(this.mainRowEl, this.stageElement);
      this.mainRowEl.appendChild(this.stageElement);
    }

    // Guide lines & tooltip
    this.guideLineV = document.createElement('div');
    this.guideLineV.className = 'cde-ruler-guideline cde-ruler-guideline--v';
    document.body.appendChild(this.guideLineV);

    this.guideLineH = document.createElement('div');
    this.guideLineH.className = 'cde-ruler-guideline cde-ruler-guideline--h';
    document.body.appendChild(this.guideLineH);

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'cde-ruler-tooltip';
    document.body.appendChild(this.tooltipEl);

    this.attachDragEvents();
  }

  private attachScrollSync(): void {
    let ticking = false;
    this.scrollHandler = () => {
      if (!ticking && !this.destroyed && this.visible) {
        window.requestAnimationFrame(() => {
          this.syncVerticalRulerPosition();
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  public syncVerticalRulerPosition(): void {
    if (this.destroyed || !this.visible) return;

    if (this.getActivePageOffset) {
      const offset = this.getActivePageOffset();
      this.vRulerWrapper.style.top = `${offset.top}px`;
      return;
    }

    const sheets = Array.from(this.stageElement.querySelectorAll<HTMLElement>('.cde-virtual-sheet'));
    if (!sheets.length) return;

    const topBarRect = this.topBarEl.getBoundingClientRect();
    const referenceY = topBarRect.bottom + 30;

    let targetSheet = sheets[0];
    let minDistance = Infinity;

    for (const sheet of sheets) {
      const rect = sheet.getBoundingClientRect();
      if (rect.top <= referenceY && rect.bottom >= referenceY) {
        targetSheet = sheet;
        break;
      }
      const dist = Math.abs(rect.top - referenceY);
      if (dist < minDistance) {
        minDistance = dist;
        targetSheet = sheet;
      }
    }

    const stageOffset = 24; // 1.5rem margin-top of stage
    this.vRulerWrapper.style.top = `${stageOffset + targetSheet.offsetTop}px`;
  }

  public setUnit(unit: RulerUnit): void {
    if (this.unit === unit) return;
    this.unit = unit;
    const unitLabel = this.cornerEl.querySelector('.cde-ruler-corner-unit');
    if (unitLabel) unitLabel.textContent = unit;
    this.cornerEl.title = `Unidad: ${this.unit.toUpperCase()} (clic para cambiar a ${this.unit === 'cm' ? 'PULGADAS' : 'CM'}, doble clic para configurar márgenes)`;
    this.update();
  }

  public toggleUnit(): void {
    this.setUnit(this.unit === 'cm' ? 'in' : 'cm');
  }

  public getUnit(): RulerUnit {
    return this.unit;
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.topBarEl.classList.toggle('is-hidden', !visible);
    this.vRulerWrapper.classList.toggle('is-hidden', !visible);
    if (visible) {
      this.update();
    }
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public toggle(): void {
    this.setVisible(!this.visible);
  }

  public promptCustomMargins(): void {
    const restrictions = this.getRestrictions();
    if (restrictions.allowMarginEditing === false || restrictions.editable === false) {
      return;
    }

    const metrics = this.getMetrics();
    const { top, right, bottom, left } = metrics.margins;
    const pxPerUnit = this.unit === 'cm' ? 37.795 : 96;
    const unitName = this.unit === 'cm' ? 'centímetros' : 'pulgadas';

    const defaultStr = [top, right, bottom, left]
      .map((px) => (px / pxPerUnit).toFixed(2))
      .join(', ');

    const promptText = `Configuración de márgenes en ${unitName} [superior, derecho, inferior, izquierdo]:`;
    const input = window.prompt(promptText, defaultStr);
    if (!input) return;

    const parts = input.split(/[,;\s]+/).map((v) => Number(v.trim()));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n) && n >= 0.5)) {
      const newMargins: PageMargins = {
        top: Math.round(parts[0] * pxPerUnit),
        right: Math.round(parts[1] * pxPerUnit),
        bottom: Math.round(parts[2] * pxPerUnit),
        left: Math.round(parts[3] * pxPerUnit),
      };
      this.onMarginsChange(newMargins);
    }
  }

  private attachDragEvents(): void {
    const startDrag = (
      e: MouseEvent,
      type: 'left' | 'right' | 'top' | 'bottom',
    ) => {
      const restrictions = this.getRestrictions();
      if (restrictions.allowMarginEditing === false || restrictions.editable === false) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const metrics = this.getMetrics();
      const margins = { ...metrics.margins };
      const startX = e.clientX;
      const startY = e.clientY;
      const sheets = Array.from(this.stageElement.querySelectorAll<HTMLElement>('.cde-virtual-sheet'));
      const activeSheet = sheets[0] ?? this.stageElement;
      const sheetRect = activeSheet.getBoundingClientRect();

      let currentMargin = margins[type];

      const showGuide = (pos: number, isVertical: boolean, text: string, clientX: number, clientY: number) => {
        this.tooltipEl.style.display = 'block';
        this.tooltipEl.textContent = text;

        if (isVertical) {
          this.guideLineV.style.display = 'block';
          this.guideLineV.style.left = `${pos}px`;
          this.guideLineV.style.top = '0px';
          this.guideLineV.style.bottom = '0px';
          this.guideLineV.style.height = '100vh';

          this.tooltipEl.style.left = `${Math.min(window.innerWidth - 180, pos + 12)}px`;
          this.tooltipEl.style.top = `${Math.max(12, Math.min(window.innerHeight - 36, clientY + 12))}px`;
        } else {
          this.guideLineH.style.display = 'block';
          this.guideLineH.style.top = `${pos}px`;
          this.guideLineH.style.left = `${sheetRect.left}px`;
          this.guideLineH.style.width = `${metrics.pageWidthPx}px`;

          this.tooltipEl.style.top = `${pos + 8}px`;
          this.tooltipEl.style.left = `${Math.max(sheetRect.left + 12, Math.min(sheetRect.left + metrics.pageWidthPx - 140, clientX + 12))}px`;
        }
      };

      const formatTooltip = (typeText: string, px: number) => {
        const cm = (px / 37.795).toFixed(2);
        const inch = (px / 96).toFixed(2);
        if (this.unit === 'cm') {
          return `${typeText}: ${cm} cm (${inch} in)`;
        }
        return `${typeText}: ${inch} in (${cm} cm)`;
      };

      const onMove = (moveEv: MouseEvent) => {
        const dx = moveEv.clientX - startX;
        const dy = moveEv.clientY - startY;

        if (type === 'left') {
          const maxLeft = metrics.pageWidthPx - margins.right - 96;
          currentMargin = Math.max(24, Math.min(maxLeft, Math.round(margins.left + dx)));
          const pageX = sheetRect.left + currentMargin;
          showGuide(pageX, true, formatTooltip('Margen izq', currentMargin), moveEv.clientX, moveEv.clientY);
          this.hLeftHandle.style.left = `${currentMargin}px`;
          this.hLeftMarginEl.style.width = `${currentMargin}px`;
          this.hActiveEl.style.left = `${currentMargin}px`;
          this.hActiveEl.style.width = `${metrics.pageWidthPx - currentMargin - margins.right}px`;
        } else if (type === 'right') {
          const maxRight = metrics.pageWidthPx - margins.left - 96;
          currentMargin = Math.max(24, Math.min(maxRight, Math.round(margins.right - dx)));
          const pageX = sheetRect.left + metrics.pageWidthPx - currentMargin;
          showGuide(pageX, true, formatTooltip('Margen der', currentMargin), moveEv.clientX, moveEv.clientY);
          this.hRightHandle.style.right = `${currentMargin}px`;
          this.hRightMarginEl.style.width = `${currentMargin}px`;
          this.hActiveEl.style.width = `${metrics.pageWidthPx - margins.left - currentMargin}px`;
        } else if (type === 'top') {
          const maxTop = metrics.pageHeightPx - margins.bottom - 96;
          currentMargin = Math.max(24, Math.min(maxTop, Math.round(margins.top + dy)));
          const pageY = sheetRect.top + currentMargin;
          showGuide(pageY, false, formatTooltip('Margen sup', currentMargin), moveEv.clientX, moveEv.clientY);
          this.vTopHandle.style.top = `${currentMargin}px`;
          this.vTopMarginEl.style.height = `${currentMargin}px`;
          this.vActiveEl.style.top = `${currentMargin}px`;
          this.vActiveEl.style.height = `${metrics.pageHeightPx - currentMargin - margins.bottom}px`;
        } else if (type === 'bottom') {
          const maxBottom = metrics.pageHeightPx - margins.top - 96;
          currentMargin = Math.max(24, Math.min(maxBottom, Math.round(margins.bottom - dy)));
          const pageY = sheetRect.top + metrics.pageHeightPx - currentMargin;
          showGuide(pageY, false, formatTooltip('Margen inf', currentMargin), moveEv.clientX, moveEv.clientY);
          this.vBottomHandle.style.bottom = `${currentMargin}px`;
          this.vBottomMarginEl.style.height = `${currentMargin}px`;
          this.vActiveEl.style.height = `${metrics.pageHeightPx - margins.top - currentMargin}px`;
        }
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        this.guideLineV.style.display = 'none';
        this.guideLineH.style.display = 'none';
        this.tooltipEl.style.display = 'none';

        this.onMarginsChange({ [type]: currentMargin });
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    this.hLeftHandle.addEventListener('mousedown', (e) => startDrag(e, 'left'));
    this.hRightHandle.addEventListener('mousedown', (e) => startDrag(e, 'right'));
    this.vTopHandle.addEventListener('mousedown', (e) => startDrag(e, 'top'));
    this.vBottomHandle.addEventListener('mousedown', (e) => startDrag(e, 'bottom'));
  }

  public update(): void {
    if (this.destroyed) return;
    const metrics = this.getMetrics();
    const restrictions = this.getRestrictions();
    const isLocked = restrictions.allowMarginEditing === false || restrictions.editable === false;

    this.hLeftHandle.classList.toggle('is-locked', isLocked);
    this.hRightHandle.classList.toggle('is-locked', isLocked);
    this.vTopHandle.classList.toggle('is-locked', isLocked);
    this.vBottomHandle.classList.toggle('is-locked', isLocked);

    const pw = metrics.pageWidthPx;
    const ph = metrics.pageHeightPx;
    const { top, right, bottom, left } = metrics.margins;

    // Synchronize CSS custom property for exact centering alignment
    const halfWidth = `${pw / 2}px`;
    this.topBarEl.style.setProperty('--ruler-half-width', halfWidth);
    this.mainRowEl.style.setProperty('--ruler-half-width', halfWidth);
    this.stageElement.style.setProperty('--ruler-half-width', halfWidth);

    // Sync vertical position with active sheet
    this.syncVerticalRulerPosition();

    // Horizontal Ruler dimensions
    this.hRulerEl.style.width = `${pw}px`;
    this.hLeftMarginEl.style.width = `${left}px`;
    this.hRightMarginEl.style.width = `${right}px`;
    this.hActiveEl.style.left = `${left}px`;
    this.hActiveEl.style.width = `${pw - left - right}px`;
    this.hLeftHandle.style.left = `${left}px`;
    this.hRightHandle.style.right = `${right}px`;

    // Vertical Ruler dimensions
    this.vRulerEl.style.height = `${ph}px`;
    this.vTopMarginEl.style.height = `${top}px`;
    this.vBottomMarginEl.style.height = `${bottom}px`;
    this.vActiveEl.style.top = `${top}px`;
    this.vActiveEl.style.height = `${ph - top - bottom}px`;
    this.vTopHandle.style.top = `${top}px`;
    this.vBottomHandle.style.bottom = `${bottom}px`;

    // Render ticks in selected unit
    this.renderHorizontalTicks(pw, left);
    this.renderVerticalTicks(ph, top);
  }

  private renderHorizontalTicks(width: number, leftMargin: number): void {
    this.hTicksEl.replaceChildren();

    if (this.unit === 'cm') {
      const pxPerCm = 37.795;
      const step = pxPerCm / 10; // 1 mm
      const totalSteps = Math.floor(width / step);

      for (let i = 0; i <= totalSteps; i++) {
        const x = i * step;
        const tick = document.createElement('div');
        tick.className = 'cde-ruler-tick';
        tick.style.left = `${x}px`;

        const mmFromMargin = Math.round((x - leftMargin) / step);
        const isMajor = mmFromMargin % 10 === 0;
        const isMedium = mmFromMargin % 5 === 0;

        if (isMajor) {
          tick.classList.add('cde-ruler-tick--major');
          const cmVal = Math.round(Math.abs(mmFromMargin) / 10);
          if (cmVal !== 0 && x > 14 && x < width - 14) {
            const label = document.createElement('span');
            label.className = 'cde-ruler-tick-label';
            label.textContent = String(cmVal);
            tick.appendChild(label);
          }
        } else if (isMedium) {
          tick.classList.add('cde-ruler-tick--medium');
        } else {
          tick.classList.add('cde-ruler-tick--minor');
        }

        this.hTicksEl.appendChild(tick);
      }
    } else {
      // Inches: 1 in = 96px, 1/8 in = 12px
      const step = 12;
      const totalSteps = Math.floor(width / step);

      for (let i = 0; i <= totalSteps; i++) {
        const x = i * step;
        const tick = document.createElement('div');
        tick.className = 'cde-ruler-tick';
        tick.style.left = `${x}px`;

        const eighths = Math.round((x - leftMargin) / step);
        const isMajor = eighths % 8 === 0;
        const isHalf = eighths % 4 === 0;
        const isQuarter = eighths % 2 === 0;

        if (isMajor) {
          tick.classList.add('cde-ruler-tick--major');
          const inchVal = Math.round(Math.abs(eighths) / 8);
          if (inchVal !== 0 && x > 14 && x < width - 14) {
            const label = document.createElement('span');
            label.className = 'cde-ruler-tick-label';
            label.textContent = String(inchVal);
            tick.appendChild(label);
          }
        } else if (isHalf) {
          tick.classList.add('cde-ruler-tick--medium');
        } else if (isQuarter) {
          tick.classList.add('cde-ruler-tick--submedium');
        } else {
          tick.classList.add('cde-ruler-tick--minor');
        }

        this.hTicksEl.appendChild(tick);
      }
    }
  }

  private renderVerticalTicks(height: number, topMargin: number): void {
    this.vTicksEl.replaceChildren();

    if (this.unit === 'cm') {
      const pxPerCm = 37.795;
      const step = pxPerCm / 10; // 1 mm
      const totalSteps = Math.floor(height / step);

      for (let i = 0; i <= totalSteps; i++) {
        const y = i * step;
        const tick = document.createElement('div');
        tick.className = 'cde-ruler-tick cde-ruler-tick--v';
        tick.style.top = `${y}px`;

        const mmFromMargin = Math.round((y - topMargin) / step);
        const isMajor = mmFromMargin % 10 === 0;
        const isMedium = mmFromMargin % 5 === 0;

        if (isMajor) {
          tick.classList.add('cde-ruler-tick--major');
          const cmVal = Math.round(Math.abs(mmFromMargin) / 10);
          if (cmVal !== 0 && y > 14 && y < height - 14) {
            const label = document.createElement('span');
            label.className = 'cde-ruler-tick-label cde-ruler-tick-label--v';
            label.textContent = String(cmVal);
            tick.appendChild(label);
          }
        } else if (isMedium) {
          tick.classList.add('cde-ruler-tick--medium');
        } else {
          tick.classList.add('cde-ruler-tick--minor');
        }

        this.vTicksEl.appendChild(tick);
      }
    } else {
      // Inches
      const step = 12;
      const totalSteps = Math.floor(height / step);

      for (let i = 0; i <= totalSteps; i++) {
        const y = i * step;
        const tick = document.createElement('div');
        tick.className = 'cde-ruler-tick cde-ruler-tick--v';
        tick.style.top = `${y}px`;

        const eighths = Math.round((y - topMargin) / step);
        const isMajor = eighths % 8 === 0;
        const isHalf = eighths % 4 === 0;
        const isQuarter = eighths % 2 === 0;

        if (isMajor) {
          tick.classList.add('cde-ruler-tick--major');
          const inchVal = Math.round(Math.abs(eighths) / 8);
          if (inchVal !== 0 && y > 14 && y < height - 14) {
            const label = document.createElement('span');
            label.className = 'cde-ruler-tick-label cde-ruler-tick-label--v';
            label.textContent = String(inchVal);
            tick.appendChild(label);
          }
        } else if (isHalf) {
          tick.classList.add('cde-ruler-tick--medium');
        } else if (isQuarter) {
          tick.classList.add('cde-ruler-tick--submedium');
        } else {
          tick.classList.add('cde-ruler-tick--minor');
        }

        this.vTicksEl.appendChild(tick);
      }
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }

    if (this.mainRowEl.parentElement && this.stageElement.parentElement === this.mainRowEl) {
      this.mainRowEl.parentElement.insertBefore(this.stageElement, this.mainRowEl);
      this.mainRowEl.remove();
    }

    this.topBarEl.remove();
    this.vRulerWrapper.remove();
    this.guideLineV.remove();
    this.guideLineH.remove();
    this.tooltipEl.remove();
  }
}
