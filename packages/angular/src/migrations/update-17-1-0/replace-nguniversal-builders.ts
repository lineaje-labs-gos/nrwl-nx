import {
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  type TargetConfiguration,
  type Tree,
  removeDependenciesFromPackageJson,
} from '@nx/devkit';
import {
  downgradeTargetDefaults,
  normalizeTargetDefaults,
} from '@nx/devkit/internal';

export default async function (tree: Tree) {
  const projects = getProjects(tree);
  for (const [, project] of projects) {
    if (project.projectType !== 'application') {
      continue;
    }

    for (const target of Object.values(project.targets ?? {})) {
      if (target.executor === '@nguniversal/builders:ssr-dev-server') {
        target.executor = '@angular-devkit/build-angular:ssr-dev-server';
      } else if (target.executor === '@nguniversal/builders:prerender') {
        target.executor = '@angular-devkit/build-angular:prerender';
        updatePrerenderOptions(target);
      }
    }

    updateProjectConfiguration(tree, project.name, project);
  }

  // update options from nx.json target defaults
  const nxJson = readNxJson(tree);
  if (!nxJson.targetDefaults) {
    return;
  }

  const original = nxJson.targetDefaults;
  const entries = normalizeTargetDefaults(original);
  for (const entry of entries) {
    if (entry.executor === '@nguniversal/builders:ssr-dev-server') {
      entry.executor = '@angular-devkit/build-angular:ssr-dev-server';
    } else if (entry.executor === '@nguniversal/builders:prerender') {
      entry.executor = '@angular-devkit/build-angular:prerender';
      updatePrerenderOptions(entry);
    }
  }
  // Preserve the original on-disk shape so a record-shape nx.json stays
  // valid against pre-v23 schemas; normalized array writes back as array.
  nxJson.targetDefaults = Array.isArray(original)
    ? entries
    : downgradeTargetDefaults(entries);

  updateNxJson(tree, nxJson);

  // remove @nguniversal/builders from package.json
  removeDependenciesFromPackageJson(
    tree,
    ['@nguniversal/builders'],
    ['@nguniversal/builders']
  );

  await formatFiles(tree);
}

function* allTargetOptions<T>(
  target: TargetConfiguration<T>
): Iterable<[string | undefined, T]> {
  if (target.options) {
    yield [undefined, target.options];
  }

  if (!target.configurations) {
    return;
  }

  for (const [name, options] of Object.entries(target.configurations)) {
    if (options !== undefined) {
      yield [name, options];
    }
  }
}

function updatePrerenderOptions(
  config: TargetConfiguration<{
    discoverRoutes?: any;
    guessRoutes?: any;
    numProcesses?: any;
  }>
) {
  for (const [, options] of allTargetOptions(config)) {
    if (options.guessRoutes !== undefined) {
      options.discoverRoutes = options.guessRoutes;
      delete options.guessRoutes;
    }

    if (options.numProcesses !== undefined) {
      delete options.numProcesses;
    }
  }
}
