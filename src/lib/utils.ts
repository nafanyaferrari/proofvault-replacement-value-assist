export const money = (value?: number, currency = 'USD') => value == null ? 'Not set' : new Intl.NumberFormat('en-US', {style: 'currency', currency, maximumFractionDigits: 0}).format(value);
export const dateTime = (value?: string) => value ? new Date(value).toLocaleString() : 'Not checked';
export const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
