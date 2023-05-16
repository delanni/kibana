/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

const Path = require('path');
const Fs = require('fs');
const { inspect } = require('util');

const {
  isSomeString,
  isObj,
  isValidPluginId,
  isValidPkgType,
  isArrOfIds,
  isArrOfStrings,
  PACKAGE_TYPES,
} = require('./parse_helpers');
const { getGitRepoRootSync } = require('./get_git_repo_root');
const { parseOrThrow } = require('../utils/jsonc');
const { isValidPluginCategoryInfo, PLUGIN_CATEGORY } = require('./plugin_category_info');

/**
 * Reads the file given by the {path} argument, throw if it's missing
 * @param {string} path
 * @param {string} fileName
 * @returns string - File content
 */
const readOrThrow = (path, fileName = 'kibana.jsonc') => {
  try {
    const content = Fs.readFileSync(path, 'utf8');
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      const err = new Error(`Missing ${fileName} file at ${path}`);
      throw Object.assign(err, { code: 'ENOENT' });
    }

    throw error;
  }
};

/**
 * @param {string} key
 * @param {unknown} value
 * @param {string} msg
 * @returns {Error}
 */
const err = (key, value, msg) => {
  const dbg = ['string', 'number', 'boolean', 'undefined'].includes(typeof value)
    ? value
    : inspect(value);
  return new Error(`invalid package "${key}" [${dbg}], ${msg}`);
};

/**
 * @param {unknown} v
 * @returns {v is string}
 */
const isValidOwner = (v) => typeof v === 'string' && v.startsWith('@');

/**
 * @param {unknown} plugin
 * @param {string} repoRoot
 * @param {string} pathToManfest
 * @returns {import('./types').PluginPackageManifest['plugin']} plugin
 */
function validatePackageManifestPlugin(plugin, repoRoot, pathToManfest) {
  if (!isObj(plugin)) {
    throw err('plugin', plugin, 'must be an object');
  }

  const {
    id,
    browser,
    server,
    extraPublicDirs,
    configPath,
    requiredPlugins,
    optionalPlugins,
    requiredBundles,
    enabledOnAnonymousPages,
    type,
    __category__,
  } = plugin;

  if (!isValidPluginId(id)) {
    throw err(`plugin.id`, id, `must be a string in camel or snake case`);
  }
  if (typeof browser !== 'boolean') {
    throw err('plugin.browser', browser, 'must be a boolean');
  }
  if (typeof server !== 'boolean') {
    throw err('plugin.server', server, 'must be a boolean');
  }
  if (extraPublicDirs !== undefined && !isArrOfStrings(extraPublicDirs)) {
    throw err(`plugin.extraPublicDirs`, extraPublicDirs, `must be an array of strings`);
  }
  if (configPath !== undefined && !(isSomeString(configPath) || isArrOfStrings(configPath))) {
    throw err(
      `plugin.configPath`,
      configPath,
      `must be a non-empty string, or an array of non-empty strings`
    );
  }

  if (requiredPlugins !== undefined && !isArrOfIds(requiredPlugins)) {
    throw err(
      `plugin.requiredPlugins`,
      requiredPlugins,
      `must be an array of strings in camel or snake case`
    );
  }

  if (optionalPlugins !== undefined && !isArrOfIds(optionalPlugins)) {
    throw err(
      `plugin.requiredPlugins`,
      optionalPlugins,
      `must be an array of strings in camel or snake case`
    );
  }

  if (requiredBundles !== undefined && !isArrOfIds(requiredBundles)) {
    throw err(
      `plugin.requiredBundles`,
      requiredBundles,
      `must be an array of strings in camel or snake case`
    );
  }

  if (enabledOnAnonymousPages !== undefined && typeof enabledOnAnonymousPages !== 'boolean') {
    throw err(`plugin.enabledOnAnonymousPages`, enabledOnAnonymousPages, `must be a boolean`);
  }

  if (type !== undefined && type !== 'preboot') {
    throw err(`plugin.type`, type, `must be undefined or "preboot"`);
  }

  const segs = pathToManfest.split(Path.sep);
  const gitRepoRoot = getGitRepoRootSync(repoRoot);
  const isBuild =
    segs.includes('node_modules') ||
    (gitRepoRoot && pathToManfest.startsWith(Path.join(gitRepoRoot, 'build', 'kibana')));

  // TODO: evaluate if __category__ should be removed
  if (__category__ !== undefined) {
    if (!isBuild) {
      throw err(
        'plugin.__category__',
        __category__,
        'may only be specified on built packages in node_modules'
      );
    }

    if (!isValidPluginCategoryInfo(__category__)) {
      throw err('plugin.__category__', __category__, 'is not valid');
    }
  } else if (isBuild) {
    throw err(
      'plugin.__category__',
      __category__,
      'must be defined on built packages in node_modules'
    );
  }

  return {
    id,
    browser,
    server,
    type,
    configPath,
    requiredPlugins,
    optionalPlugins,
    requiredBundles,
    enabledOnAnonymousPages,
    extraPublicDirs,
    [PLUGIN_CATEGORY]: __category__,
  };
}

/**
 * @param {unknown} build
 * @returns {import('./types').PluginPackageManifest['build']}
 */
function validatePackageManifestBuild(build) {
  if (build !== undefined && !isObj(build)) {
    throw err('build', build, 'must be an object or undefined');
  }

  if (!build) {
    return build;
  }

  const { extraExcludes, noParse, ...extra } = build;

  const extraKeys = Object.keys(extra);
  if (extraKeys.length) {
    throw new Error(`unexpected keys in "build" of package [${extraKeys.join(', ')}]`);
  }

  if (extraExcludes !== undefined && !isArrOfStrings(extraExcludes)) {
    throw err(
      `build.extraExcludes`,
      extraExcludes,
      'must be an array of non-empty strings when defined'
    );
  }

  if (noParse !== undefined && !isArrOfStrings(noParse)) {
    throw err(`build.noParse`, noParse, 'must be an array of non-empty strings when defined');
  }

  return {
    extraExcludes,
    noParse,
  };
}

/**
 * Validate the contents of a parsed kibana.jsonc file.
 * @param {unknown} parsedManifest
 * @param {string} repoRoot
 * @param {string} pathToManifest
 * @returns {import('./types').KibanaPackageManifest}
 */
function validatePackageManifest(parsedManifest, repoRoot, pathToManifest) {
  if (!isObj(parsedManifest)) {
    throw new Error('expected manifest root to be an object');
  }

  const {
    type,
    id,
    owner,
    devOnly,
    plugin,
    sharedBrowserBundle,
    build,
    description,
    serviceFolders,
    ...extra
  } = parsedManifest;

  const extraKeys = Object.keys(extra);
  if (extraKeys.length) {
    throw new Error(`unexpected keys in package manifest [${extraKeys.join(', ')}]`);
  }

  if (!isValidPkgType(type)) {
    throw err(`type`, type, `options are [${PACKAGE_TYPES.join(', ')}]`);
  }

  if (typeof id !== 'string' || !id.startsWith('@kbn/')) {
    throw err(`id`, id, `must be a string that starts with @kbn/`);
  }

  if (
    !(Array.isArray(owner) && owner.every(isValidOwner)) &&
    !(typeof owner === 'string' && isValidOwner(owner))
  ) {
    throw err(
      `owner`,
      owner,
      `must be a valid Github team handle starting with @, or an array of such handles`
    );
  }

  if (devOnly !== undefined && typeof devOnly !== 'boolean') {
    throw err(`devOnly`, devOnly, `must be a boolean when defined`);
  }

  if (description !== undefined && !isSomeString(description)) {
    throw err(`description`, description, `must be a non-empty string when specified`);
  }

  if (serviceFolders !== undefined && !isArrOfStrings(serviceFolders)) {
    throw err(`serviceFolders`, serviceFolders, `must be an array of non-empty strings`);
  }

  const base = {
    id,
    owner: Array.isArray(owner) ? owner : [owner],
    devOnly,
    build: validatePackageManifestBuild(build),
    description,
    serviceFolders,
  };

  if (type === 'shared-server' || type === 'functional-tests' || type === 'test-helper') {
    // return if this is one of the more basic types of package types
    return {
      type,
      ...base,
    };
  } else if (type === 'plugin') {
    return {
      type,
      ...base,
      plugin: validatePackageManifestPlugin(plugin, repoRoot, pathToManifest),
    };
  } else if (sharedBrowserBundle !== undefined && typeof sharedBrowserBundle !== 'boolean') {
    // parse the sharedBrowserBundle for shared-browser and shared-common types
    throw err(`sharedBrowserBundle`, sharedBrowserBundle, `must be a boolean when defined`);
  } else {
    return {
      type,
      ...base,
      sharedBrowserBundle,
    };
  }
}

/**
 * Parse a kibana.jsonc file from the filesystem
 * @param {string} repoRoot
 * @param {string} pathToManifest
 */
function readPackageManifest(repoRoot, pathToManifest) {
  const manifestFileContent = readOrThrow(pathToManifest);
  const manifest = parseOrThrow(manifestFileContent);

  try {
    return validatePackageManifest(manifest, repoRoot, pathToManifest);
  } catch (error) {
    throw new Error(`Invalid manifest [${pathToManifest}]: ${error.message}`);
  }
}

module.exports = { readPackageManifest };
