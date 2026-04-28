// Minimal `ctx` for offline assemble + check-payload QA (not a real Figma draw).
const ctx = {
  activeFileKey: 'qa',
  fileKey: 'qa',
  registryComponents: {},
  usesComposes: false,
  composedWith: [],
  component: 'button',
  title: 'Button',
  pageName: '↳ Buttons',
  layout: 'chip',
  summary: 'QA fixture for assemble-component-use-figma-code.',
  docsUrl: 'https://ui.shadcn.com/docs/components/button',
  variants: ['default'],
  sizes: ['default'],
  style: {
    default: {
      fill: 'color/primary/default',
      fallback: '#000000',
      labelVar: 'color/foreground/on-primary',
      strokeVar: 'color/border/default',
    },
  },
  padH: { default: 'space/md' },
  radius: 'radius/md',
  label: () => 'Button',
  labelStyle: { default: 'Label/MD' },
  iconSlots: { leading: false, trailing: false, size: 24 },
  componentProps: { label: false, leadingIcon: false, trailingIcon: false },
  states: [
    { key: 'default', group: 'default' },
    { key: 'disabled', group: 'disabled' },
  ],
  applyStateOverride: function applyStateOverride(instance, stateKey, _ctx) {
    if (stateKey === 'disabled') instance.opacity = 0.38;
    else instance.opacity = 1;
  },
  properties: [['variant', 'enum', 'default', 'No', 'Variant.']],
  usageDo: ['Do this.', 'Do that.', 'Do the other.'],
  usageDont: ["Don't do this.", "Don't do that.", "Don't do the other."],
  composes: [],
};
