export class StringUtils {
  /**
   * Test if a string is null or empty
   * 
   * @param value 
   */
  static isNullOrEmpty(value: any): boolean {
    return value == null || value === "";
  }

  /**
   * Replace all occurrencies in a string
   * 
   * @param value 
   */
  static replaceAll(str: string, find: string, replace: string) {
    const f = find.replace('$', '\\$').replace('{', '\\{').replace('}', '\\}');
    return str.replace(new RegExp(f, 'g'), replace);
  }

  /**
   * Convert to regex a string
   * 
   * @param value 
   */
  static toRegEx(value: string): RegExp {
    try {
      return new RegExp(value, 'i');
    }
    catch {
      return null;
    }
  }
}