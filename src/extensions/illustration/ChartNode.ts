import { Node } from '@tiptap/core';
import { IllustrationNodeView } from './IllustrationNodeView';
import { echartsToSvgDataUri } from '../../utils/chartGenerator';
import { CHART_TYPES, PALETTES } from '../../utils/chartGenerator';

// Re-export for convenience
export { CHART_TYPES, PALETTES };

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chart: {
      insertChart: (options: ChartAttrs) => ReturnType;
      updateChart: (options: Partial<ChartAttrs>) => ReturnType;
    };
  }
}

export interface ChartAttrs {
  chartType: string;
  title: string;
  data: { label: string; value: number }[];
  paletteId: string;
  showLegend: boolean;
  showLabels: boolean;
  width: number;
  height: number;
}

export function chartAttrsToSvg(attrs: ChartAttrs): string {
  const type = CHART_TYPES.find((t) => t.id === attrs.chartType) ?? CHART_TYPES[0];
  const palette = PALETTES.find((p) => p.id === attrs.paletteId) ?? PALETTES[0];
  const option = type.buildOption(
    attrs.title,
    attrs.data ?? [],
    palette.colors,
    attrs.showLegend !== false,
    attrs.showLabels !== false,
  );
  // echartsToSvgDataUri returns a data URI; extract the SVG markup for inline render
  const dataUri = echartsToSvgDataUri(option, attrs.width || 720, attrs.height || 420);
  if (!dataUri) return '';
  try {
    return decodeURIComponent(dataUri.replace('data:image/svg+xml;charset=utf-8,', ''));
  } catch {
    return '';
  }
}

export function chartAttrsToDataUri(attrs: ChartAttrs): string {
  const type = CHART_TYPES.find((t) => t.id === attrs.chartType) ?? CHART_TYPES[0];
  const palette = PALETTES.find((p) => p.id === attrs.paletteId) ?? PALETTES[0];
  const option = type.buildOption(
    attrs.title,
    attrs.data ?? [],
    palette.colors,
    attrs.showLegend !== false,
    attrs.showLabels !== false,
  );
  return echartsToSvgDataUri(option, attrs.width || 720, attrs.height || 420);
}

export const ChartNode = Node.create({
  name: 'chart',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      chartType: { default: 'column' },
      title: { default: '' },
      data: {
        default: [
          { label: 'Q1', value: 45 },
          { label: 'Q2', value: 72 },
          { label: 'Q3', value: 89 },
          { label: 'Q4', value: 110 },
        ],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-chart-data') || '[]');
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ 'data-chart-data': JSON.stringify(attrs.data) }),
      },
      paletteId: { default: 'blue' },
      showLegend: { default: true },
      showLabels: { default: true },
      width: { default: 720 },
      height: { default: 420 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="chart"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-type': 'chart', ...HTMLAttributes }];
  },

  addNodeView() {
    return (props) =>
      new IllustrationNodeView(props.node, props.editor as any, props.getPos as any, {
        label: 'Gráfico',
        renderSvg: (attrs) => chartAttrsToSvg(attrs as ChartAttrs),
        openEditor: (attrs, onUpdate) => {
          // Dynamic import to avoid circular dependency at module load
          import('../../utils/chartEditorModal').then((m) => {
            m.openChartEditorModal(attrs as ChartAttrs, onUpdate);
          });
        },
      });
  },

  addCommands() {
    return {
      insertChart:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
      updateChart:
        (options) =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const pos = selection.from;
          const node = state.doc.nodeAt(pos);
          if (node?.type.name !== this.name) return false;
          if (dispatch) {
            dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...options }));
          }
          return true;
        },
    };
  },
});
