export const emailOk = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
