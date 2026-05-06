import {
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  type Tree,
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
      if (
        target.executor === '@nx/angular:webpack-dev-server' ||
        target.executor === '@nrwl/angular:webpack-dev-server'
      ) {
        target.executor = '@nx/angular:dev-server';
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
    if (
      entry.executor === '@nx/angular:webpack-dev-server' ||
      entry.executor === '@nrwl/angular:webpack-dev-server'
    ) {
      entry.executor = '@nx/angular:dev-server';
    }
  }
  // Preserve the original on-disk shape so a record-shape nx.json stays
  // valid against pre-v23 schemas; normalized array writes back as array.
  nxJson.targetDefaults = Array.isArray(original)
    ? entries
    : downgradeTargetDefaults(entries);

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}
