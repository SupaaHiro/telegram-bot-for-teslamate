'use strict';

import yargs, { config } from 'yargs'
import { hideBin } from 'yargs/helpers'
import Application from './src/application.js';
import { StringUtils, LicenseUtils } from './src/components/utils.js';

/**
 * App entry point -> Called by the parameter parser
 *
 */
const entryPoint = function () {

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

  // Find configuration path
  let config_path: string = String(argv.c);
  if (StringUtils.isNullOrEmpty(config_path))
    config_path = process.env.CONFIG_PATH_DIR ?? '';

  // Init application
  const app: Application = new Application(config_path);
  let exitCode: number = 0;
  app
    .initialize()
    .then(async function () {
      await app.doevents();
      await app.wait_for_tasks();
    })
    .catch(async function (err: Error) {
      console.error('Application error:', (argv.verbose ? err : err.message));
      exitCode = 1;
    })
    .finally(async function () {
      await app.dispose();
      process.exit(exitCode);
    });
};

entryPoint();
