declare global {
  interface Window {
    FOODFLOW_CONFIG?: {
      apiUrl?: string;
    };
  }
}

export const environment = {
  apiUrl:
    window.FOODFLOW_CONFIG?.apiUrl ??
    `${window.location.port === '4200' ? 'http://localhost:3000' : window.location.origin}/api/v1`,
};
