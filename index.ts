'use strict';

import Application from './src/application.js';

/**
 * App entry point -> Called by the parameter parser
 *
 * @param {*} argv    Command-line arguments
 */
const entryPoint = function (argv: (string | number)[]) {
  const app: Application = new Application(argv);
  let exitCode: number = 0;

  app
    .initialize()
    .then(async function () {
      await app.doevents();
      await app.wait_for_tasks();
    })
    .catch(async function (err: Error) {
      const verbose = false;
      console.error('Application error: ', (verbose ? err : err.message));
      exitCode = 1;
    })
    .finally(async function () {
      await app.dispose();
      process.exit(exitCode);
    });
};

entryPoint(process.argv);
