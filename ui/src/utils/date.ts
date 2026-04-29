/**
 * 将 SQLite 返回的 UTC 时间字符串转换为本地 Date 对象
 * SQLite 默认格式: YYYY-MM-DD HH:MM:SS (不带 Z)
 */
export function parseServerDate(ts: string): Date {
  if (!ts) return new Date();
  
  // 如果已经是标准 ISO 格式 (带 T)，直接解析
  if (ts.includes('T')) return new Date(ts);
  
  // 针对 SQLite 默认格式补全 T 和 Z
  const iso = ts.replace(' ', 'T') + 'Z';
  const date = new Date(iso);
  
  // 如果解析失败，回退到原始解析
  return isNaN(date.getTime()) ? new Date(ts) : date;
}

/**
 * 格式化服务器时间为本地可读字符串
 */
export function formatServerDate(ts: string, options?: Intl.DateTimeFormatOptions): string {
  const date = parseServerDate(ts);
  return date.toLocaleString(undefined, options);
}

/**
 * 格式化服务器时间为本地时间字符串
 */
export function formatServerTime(ts: string, options?: Intl.DateTimeFormatOptions): string {
  const date = parseServerDate(ts);
  return date.toLocaleTimeString(undefined, options);
}
