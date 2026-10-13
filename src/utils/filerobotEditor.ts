import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { StyleSheetManager } from 'styled-components';
import isPropValid from '@emotion/is-prop-valid';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';
import { optimizeImage } from './imageOptimizer';

export interface FilerobotModalOptions {
  src: string;
  defaultTab?: 'Finetune' | 'Filters' | 'Adjust' | 'Watermark' | 'Annotate' | 'Resize';
  defaultTool?: string;
  onSave: (savedUrl: string) => void;
  onClose?: () => void;
}

// Convert remote images or SVGs to a safe local data URL to prevent canvas cross-origin taint
async function ensureSafeDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  try {
    const res = await fetch(src, { mode: 'cors' });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(src);
      reader.readAsDataURL(blob);
    });
  } catch {
    return src;
  }
}

/**
 * Filter props so styled-components and @scaleflex/ui do not forward
 * custom internal attributes directly to native DOM elements in React 19.
 */
const shouldForwardProp = (propName: string, elementToBeRendered: any): boolean => {
  if (typeof elementToBeRendered === 'string') {
    return isPropValid(propName);
  }
  return true;
};

/**
 * Opens a modal with the full React Filerobot Image Editor,
 * enhanced with an accessible top action bar with direct crop presets,
 * rotation, flip, and save buttons.
 */
export function openFilerobotModal(options: FilerobotModalOptions): () => void {
  const { src, defaultTab, defaultTool, onSave, onClose } = options;

  // Intercept and filter React 19 attribute warnings during editor lifetime
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const filterWarnings = (args: any[]): boolean => {
    const firstArg = typeof args[0] === 'string' ? args[0] : '';
    if (
      firstArg.includes('React does not recognize the') ||
      firstArg.includes('If you want to write it to the DOM') ||
      firstArg.includes('prop on a DOM element')
    ) {
      return true;
    }
    return false;
  };

  console.error = (...args: any[]) => {
    if (!filterWarnings(args)) originalConsoleError.apply(console, args);
  };
  console.warn = (...args: any[]) => {
    if (!filterWarnings(args)) originalConsoleWarn.apply(console, args);
  };

  const overlay = document.createElement('div');
  overlay.className = 'cde-filerobot-modal-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '10000';
  overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
  overlay.style.backdropFilter = 'blur(4px)';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.overflow = 'hidden';

  // Modal full-window container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'cde-filerobot-modal-container';
  modalContainer.style.width = '100vw';
  modalContainer.style.height = '100vh';
  modalContainer.style.display = 'flex';
  modalContainer.style.flexDirection = 'column';
  modalContainer.style.backgroundColor = '#f8fafc';
  modalContainer.style.overflow = 'hidden';

  // Top Action Bar with prominent presets and tools
  const topBar = document.createElement('div');
  topBar.className = 'cde-filerobot-topbar';
  topBar.style.height = '52px';
  topBar.style.backgroundColor = '#ffffff';
  topBar.style.borderBottom = '1px solid #e2e8f0';
  topBar.style.display = 'flex';
  topBar.style.alignItems = 'center';
  topBar.style.justifyContent = 'space-between';
  topBar.style.padding = '0 16px';
  topBar.style.flexShrink = '0';
  topBar.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
  topBar.style.zIndex = '100';

  // Left Title / Branding
  const brandGroup = document.createElement('div');
  brandGroup.style.display = 'flex';
  brandGroup.style.alignItems = 'center';
  brandGroup.style.gap = '10px';

  const brandTitle = document.createElement('span');
  brandTitle.textContent = 'Editor de Imagen';
  brandTitle.style.fontWeight = '700';
  brandTitle.style.fontSize = '14px';
  brandTitle.style.color = '#0f172a';

  brandGroup.appendChild(brandTitle);

  // Center Quick Presets (direct access without buggy dropdowns)
  const presetsGroup = document.createElement('div');
  presetsGroup.className = 'cde-filerobot-presets-group';
  presetsGroup.style.display = 'flex';
  presetsGroup.style.alignItems = 'center';
  presetsGroup.style.gap = '5px';
  presetsGroup.style.flexWrap = 'nowrap';
  presetsGroup.style.overflowX = 'auto';
  (presetsGroup.style as any).scrollbarWidth = 'none';

  const presetLabel = document.createElement('span');
  presetLabel.textContent = 'Proporción:';
  presetLabel.style.fontSize = '11px';
  presetLabel.style.fontWeight = '600';
  presetLabel.style.color = '#64748b';
  presetLabel.style.marginRight = '2px';
  presetsGroup.appendChild(presetLabel);

  // Refs for Filerobot manipulation
  const updateStateRef = { current: null as any };
  const getCurrentImgDataRef = { current: null as any };

  let currentRotation = 0;
  let currentFlipX = false;
  let currentFlipY = false;

  const setCropRatio = (ratio: any, titleKey: string) => {
    if (updateStateRef.current) {
      updateStateRef.current({
        adjustments: {
          crop: {
            ratio,
            ratioTitleKey: titleKey,
            width: null,
            height: null,
          },
        },
      });
    }
  };

  const createPresetBtn = (
    label: string,
    title: string,
    onApply: () => void,
  ): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cde-filerobot-preset-btn';
    btn.textContent = label;
    btn.title = title;
    btn.style.padding = '4px 10px';
    btn.style.fontSize = '11px';
    btn.style.fontWeight = '500';
    btn.style.borderRadius = '5px';
    btn.style.border = '1px solid #e2e8f0';
    btn.style.backgroundColor = '#ffffff';
    btn.style.color = '#334155';
    btn.style.cursor = 'pointer';
    btn.style.whiteSpace = 'nowrap';
    btn.style.transition = 'all 0.12s ease';
    btn.onmouseenter = () => {
      btn.style.backgroundColor = '#eff6ff';
      btn.style.borderColor = '#93c5fd';
      btn.style.color = '#1d4ed8';
    };
    btn.onmouseleave = () => {
      btn.style.backgroundColor = '#ffffff';
      btn.style.borderColor = '#e2e8f0';
      btn.style.color = '#334155';
    };
    btn.onclick = () => {
      onApply();
    };
    return btn;
  };

  // Crop Ratio Buttons
  presetsGroup.appendChild(
    createPresetBtn('Libre', 'Recorte libre sin proporciones fijas', () => {
      setCropRatio('custom', 'custom');
    }),
  );
  presetsGroup.appendChild(
    createPresetBtn('1:1 Cuadrado', 'Proporción cuadrada 1:1', () => {
      setCropRatio(1, '1:1');
    }),
  );
  presetsGroup.appendChild(
    createPresetBtn('4:3', 'Proporción estándar 4:3', () => {
      setCropRatio(4 / 3, '4:3');
    }),
  );
  presetsGroup.appendChild(
    createPresetBtn('16:9', 'Proporción panorámica 16:9', () => {
      setCropRatio(16 / 9, '16:9');
    }),
  );
  presetsGroup.appendChild(
    createPresetBtn('Círculo', 'Recorte circular / elíptico', () => {
      setCropRatio('ellipse', 'ellipse');
    }),
  );

  // Divider
  const sep = document.createElement('span');
  sep.style.width = '1px';
  sep.style.height = '16px';
  sep.style.backgroundColor = '#e2e8f0';
  sep.style.margin = '0 4px';
  presetsGroup.appendChild(sep);

  // Rotate & Flip Quick Buttons
  presetsGroup.appendChild(
    createPresetBtn('Rotar 90°', 'Girar imagen 90 grados', () => {
      currentRotation = (currentRotation + 90) % 360;
      if (updateStateRef.current) {
        updateStateRef.current({
          adjustments: {
            rotation: currentRotation,
          },
        });
      }
    }),
  );

  presetsGroup.appendChild(
    createPresetBtn('Voltear H', 'Voltear horizontalmente', () => {
      currentFlipX = !currentFlipX;
      if (updateStateRef.current) {
        updateStateRef.current({
          adjustments: {
            isFlippedX: currentFlipX,
          },
        });
      }
    }),
  );

  presetsGroup.appendChild(
    createPresetBtn('Voltear V', 'Voltear verticalmente', () => {
      currentFlipY = !currentFlipY;
      if (updateStateRef.current) {
        updateStateRef.current({
          adjustments: {
            isFlippedY: currentFlipY,
          },
        });
      }
    }),
  );

  // Right Save / Cancel Group
  const rightGroup = document.createElement('div');
  rightGroup.style.display = 'flex';
  rightGroup.style.alignItems = 'center';
  rightGroup.style.gap = '8px';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.style.padding = '6px 14px';
  cancelBtn.style.fontSize = '12px';
  cancelBtn.style.fontWeight = '500';
  cancelBtn.style.borderRadius = '6px';
  cancelBtn.style.border = '1px solid #cbd5e1';
  cancelBtn.style.backgroundColor = '#ffffff';
  cancelBtn.style.color = '#475569';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.onmouseenter = () => {
    cancelBtn.style.backgroundColor = '#fee2e2';
    cancelBtn.style.color = '#ef4444';
    cancelBtn.style.borderColor = '#fca5a5';
  };
  cancelBtn.onmouseleave = () => {
    cancelBtn.style.backgroundColor = '#ffffff';
    cancelBtn.style.color = '#475569';
    cancelBtn.style.borderColor = '#cbd5e1';
  };

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.innerHTML = '✓ Guardar y aplicar';
  saveBtn.style.padding = '6px 16px';
  saveBtn.style.fontSize = '12px';
  saveBtn.style.fontWeight = '600';
  saveBtn.style.borderRadius = '6px';
  saveBtn.style.border = '1px solid #2563eb';
  saveBtn.style.backgroundColor = '#2563eb';
  saveBtn.style.color = '#ffffff';
  saveBtn.style.cursor = 'pointer';
  saveBtn.style.boxShadow = '0 1px 2px rgba(37,99,235,0.2)';
  saveBtn.onmouseenter = () => {
    saveBtn.style.backgroundColor = '#1d4ed8';
    saveBtn.style.borderColor = '#1d4ed8';
  };
  saveBtn.onmouseleave = () => {
    saveBtn.style.backgroundColor = '#2563eb';
    saveBtn.style.borderColor = '#2563eb';
  };

  rightGroup.append(cancelBtn, saveBtn);

  topBar.append(brandGroup, presetsGroup, rightGroup);
  modalContainer.appendChild(topBar);

  // Content wrapper for Filerobot Image Editor
  const editorMount = document.createElement('div');
  editorMount.style.flex = '1';
  editorMount.style.width = '100%';
  editorMount.style.height = 'calc(100vh - 52px)';
  editorMount.style.position = 'relative';
  editorMount.style.overflow = 'hidden';

  modalContainer.appendChild(editorMount);
  overlay.appendChild(modalContainer);
  document.body.appendChild(overlay);

  let root: Root | null = null;
  let isCleanedUp = false;

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    if (root) {
      try {
        root.unmount();
      } catch {
        // Ignore unmount error
      }
      root = null;
    }
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (onClose) {
      onClose();
    }
  };

  const wrappedCleanup = () => {
    window.removeEventListener('keydown', handleKeyDown);
    cleanup();
  };

  cancelBtn.onclick = () => {
    wrappedCleanup();
  };

  // Direct Save Trigger
  const triggerSave = async () => {
    saveBtn.textContent = 'Guardando...';
    saveBtn.disabled = true;
    try {
      if (getCurrentImgDataRef.current) {
        const res = getCurrentImgDataRef.current({ quality: 0.92 });
        const rawUrl =
          res?.imageData?.imageBase64 ||
          (res?.imageData?.imageCanvas ? res.imageData.imageCanvas.toDataURL('image/png') : '');

        if (rawUrl) {
          const optimized = await optimizeImage(rawUrl);
          onSave(optimized.dataUrl);
          wrappedCleanup();
          return;
        }
      }
    } catch (err) {
      console.warn('Saving via ref:', err);
    }
    // Fallback: click Filerobot's internal save button
    const internalSaveBtn = editorMount.querySelector<HTMLButtonElement>(
      '[data-testid="FIE-save-button"], .FIE_buttons-save-btn',
    );
    if (internalSaveBtn) {
      internalSaveBtn.click();
    } else {
      wrappedCleanup();
    }
  };

  saveBtn.onclick = triggerSave;

  // Close on Escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      wrappedCleanup();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  root = createRoot(editorMount);

  // Safely prepare source URL
  ensureSafeDataUrl(src).then((safeSrc) => {
    if (isCleanedUp || !root) return;

    const editorProps: any = {
      source: safeSrc,
      defaultSavedImageName: 'imagen',
      defaultSavedImageType: 'png',
      onBeforeSave: () => false,
      onSave: async (savedImageData: any) => {
        try {
          const rawUrl =
            savedImageData?.imageBase64 ||
            (savedImageData?.imageCanvas
              ? savedImageData.imageCanvas.toDataURL(savedImageData.mimeType || 'image/png')
              : '');

          if (rawUrl) {
            const optimized = await optimizeImage(rawUrl);
            onSave(optimized.dataUrl);
          }
        } catch (err) {
          console.error('Error saving edited image:', err);
          if (savedImageData?.imageBase64) {
            onSave(savedImageData.imageBase64);
          }
        }
        wrappedCleanup();
      },
      onClose: () => {
        wrappedCleanup();
      },
      closeAfterSave: true,
      tabsIds: [
        TABS.ADJUST,
        TABS.FINETUNE,
        TABS.FILTERS,
        TABS.ANNOTATE,
        TABS.RESIZE,
        TABS.WATERMARK,
      ],
      defaultTabId: defaultTab ? (TABS as any)[defaultTab.toUpperCase()] || defaultTab : TABS.ADJUST,
      defaultToolId: defaultTool ? (TOOLS as any)[defaultTool.toUpperCase()] || defaultTool : TOOLS.CROP,
      [TOOLS.CROP]: {
        presetsItems: [
          { titleKey: '1:1 Cuadrado', descriptionKey: '1:1', ratio: 1 },
          { titleKey: '4:3 Estándar', descriptionKey: '4:3', ratio: 4 / 3 },
          { titleKey: '16:9 Panorámica', descriptionKey: '16:9', ratio: 16 / 9 },
          { titleKey: '3:2 Clásico', descriptionKey: '3:2', ratio: 3 / 2 },
        ],
      },
      language: 'es',
      savingPixelRatio: 2,
      previewPixelRatio: 1.5,
      observePluginContainerSize: true,
      getCurrentImgDataFnRef: getCurrentImgDataRef,
      updateStateFnRef: updateStateRef,
    };

    root.render(
      React.createElement(
        StyleSheetManager,
        { shouldForwardProp: shouldForwardProp as any },
        React.createElement(FilerobotImageEditor, editorProps),
      ),
    );
  });

  return wrappedCleanup;
}
