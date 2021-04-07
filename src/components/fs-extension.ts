import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as lockfile from 'proper-lockfile';
import { StringUtils } from './utils.js';

const __dirname = process.cwd();

function touch(path: string) {
  const fileDescriptor = fs.openSync(path, 'a')

  return fileDescriptor
}

/**
 * Request an exclusive lock
 *
 * @param {*} name lock name
 */
export async function lock(name: string, maplock: Map<string, any>) {
  assert.ok(name, 'lock: name is mandatory');
  assert.ok(maplock, 'lock: maplock is mandatory');

  try {
    let lockdir = path.join(__dirname, './locks/');
    if (!fs.existsSync(lockdir)) fs.mkdirSync(lockdir);

    let fullpath = path.join(lockdir, name);
    if (!fs.existsSync(fullpath)) touch(fullpath);

    let release_lock = await lockfile.lock(fullpath);
    maplock.set(fullpath, release_lock);

    // return the lock fullpath (it act as a key)
    return fullpath;
  } catch (err) {
    console.log(err);
    console.error('Application lock is held by another running instance');
    process.exit(1);
  }
}

/**
 * Release a lock
 *
 * @param {*} fullpath fullpath (it act as a key)
 */
export async function release_lock(fullpath: string, maplock: Map<string, any>) {
  assert.ok(fullpath, 'release_lock: fullpath is mandatory');
  assert.ok(maplock, 'release_lock: maplock is mandatory');

  if (!maplock.has(fullpath)) return;

  let release_lock = maplock.get(fullpath);
  release_lock();

  if (fs.existsSync(fullpath)) fs.unlinkSync(fullpath);

  maplock.delete(fullpath);
}

/**
 * Release locks
 */
export async function release_locks(maplock: Map<string, any>) {
  assert.ok(maplock, 'release_locks: maplock is mandatory');

  for (let key of maplock.keys()) {
    let release_lock = maplock.get(key);
    release_lock();

    if (fs.existsSync(key)) fs.unlinkSync(key);
  }
  maplock.clear();

}

/**
 * Get config  directory path
 * 
 * @param {*} filename filename
 * @param {*} rootPath config path
 */
export function get_config_path(filename: string, rootPath?: string) {

  // If no custom path is specified, look into app folder\config
  if (StringUtils.isNullOrEmpty(rootPath))
    rootPath = path.join(__dirname, 'config');

  const fullpath = path.join(rootPath, filename);
  assert.ok(fs.existsSync(fullpath), `Unable to load ${filename} configuration file from directory ${rootPath}!\r\n` +
    `Double check the app configuration, you can also override the default path using --config-path or CONFIG_PATH_DIR enviroment variable`
  );

  return fullpath;
}

/**
 * Load a json configuration file from app-root:/config directory
 * 
 * @param {*} filename filename
 * @param {*} rootPath config path
 */
export function load_json<T>(filename: string, rootPath: string) {
  const fullpath = get_config_path(filename, rootPath);

  return JSON.parse(fs.readFileSync(fullpath).toString());
}

/**
 * Load a txt configuration file from app-root:/config directory
 * 
 * @param {*} filename filename
 * @param {*} rootPath config path
 */
export function load_txt(filename: string, rootPath: string) {
  const fullpath = get_config_path(filename, rootPath);

  return fs.readFileSync(fullpath).toString();
}