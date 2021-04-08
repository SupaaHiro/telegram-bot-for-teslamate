'use strict';

import yargs, { config } from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as tracer from 'tracer';
import Application from './src/application.js';
import { LicenseUtils } from './src/components/utils.js';
import * as fsext from './src/components/fs-extension.js';

/**
 * App entry point -> Called by the parameter parser
 *
 */
const entryPoint = function () {
  const logger: tracer.Tracer.Logger = fsext.init_logger();

  // Shows author & license info (do not remove)
  LicenseUtils.print();

  // Initialize yargs
  let argv = yargs(hideBin(process.argv))
    .strict()
    .option('verbose', { alias: 'v', default: false })
    .option('config-path', {
      alias: 'c',
      demand: false,
      default: '',
      description: 'configuration files path, you can also set CONFIG_PATH_DIR enviroment variable'
    })
    .help()
    .argv;
  if (argv.verbose) console.log('Command line arguments:', JSON.stringify(argv));

  // Init application
  const app: Application = new Application(argv);
  let exitCode: number = 0;
  app
    .initialize()
    .then(async function () {
      await app.doevents();
      await app.wait_for_tasks();
    })
    .catch(async function (err: Error) {
      logger.error('Application error:', (argv.verbose ? err : err.message));
      exitCode = 1;
    })
    .finally(async function () {
      await app.dispose();
      process.exit(exitCode);
    });
};

entryPoint();
