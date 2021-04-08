'use strict';

import * as fs from 'fs';

/**
 * String utility class
 */
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

/**
 * License utility class
 */
export class LicenseUtils {

  /**
  * Shows author & license info (do not remove)
  */
  static print() {
    // Declaring a  useless variable just for the meme reference
    let yabe: boolean = false;

    console.clear();
    console.log('Telegram bot for teslamate (v1.0.2)');
    console.log('Copyright (c) Supaahiro - All rights reserved 2021');
    console.log('Private use only, no commercial use allowed');
    console.log('');
    if (!fs.existsSync('LICENSE')) {
      console.log('No LICENSE file found !');
      yabe = true;
    }

    if (yabe) {
      console.log('Oh, I\'m die. Thank you forever.');
      process.exit(0);
    }
  }
}
