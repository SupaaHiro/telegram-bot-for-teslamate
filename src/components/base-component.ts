'use strict';

import Application from '../application';

/**
 * Generic command
 */
interface BaseComponent {

  /**
   * Execute
   */
  exec(): Promise<any>;

  /**
   * Execute
   */
  dispose(): Promise<any>;
}


export default BaseComponent;