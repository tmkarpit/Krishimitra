// Placeholder theme until the final UI design arrives. Every screen styles through
// these tokens and the components in components/ui.tsx, so a redesign stays local.
export const colors = {
  primary: '#2E7D32',
  primaryDark: '#1B5E20',
  primaryLight: '#E8F5E9',
  accent: '#F9A825',
  accentLight: '#FFF8E1',
  danger: '#C62828',
  dangerLight: '#FFEBEE',
  warning: '#EF6C00',
  warningLight: '#FFF3E0',
  info: '#1565C0',
  infoLight: '#E3F2FD',
  text: '#1C2B1E',
  textMuted: '#5F6F61',
  border: '#DCE5DD',
  background: '#F6F8F4',
  surface: '#FFFFFF',
  white: '#FFFFFF',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

// Large base size: many users read on small screens in bright sunlight.
export const font = { small: 14, body: 17, large: 20, title: 24, hero: 30 };
