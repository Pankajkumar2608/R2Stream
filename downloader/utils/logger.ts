export const log = {
  info: (msg: string) => console.log(`${time()} [INFO]  ${msg}`),
  ok: (msg: string) => console.log(`${time()} [✓]     ${msg}`),
  warn: (msg: string) => console.warn(`${time()} [WARN]  ${msg}`),
  error: (msg: string) => console.error(`${time()} [✗]     ${msg}`),
};

export function time(): string {
  return new Date().toTimeString().slice(0, 8);
}
