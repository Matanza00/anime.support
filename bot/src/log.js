const stamp = () => new Date().toLocaleString('en-GB', { hour12: false });
export const log = (...a) => console.log(`[${stamp()}]`, ...a);
export const warn = (...a) => console.warn(`[${stamp()}] WARN`, ...a);
export const fail = (...a) => console.error(`[${stamp()}] ERROR`, ...a);
