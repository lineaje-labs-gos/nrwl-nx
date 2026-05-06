import {
  downgradeTargetDefaults,
  forEachExecutorOptions,
  normalizeTargetDefaults,
} from '@nx/devkit/internal';
import {
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';

export const executors = [
  '@angular-devkit/build-angular:dev-server',
  '@angular-devkit/build-angular:extract-i18n',
  '@nx/angular:module-federation-dev-server',
  '@nx/angular:webpack-dev-server',
];

export default async function (tree: Tree) {
  // update options from project configs
  executors.forEach((executor) => {
    forEachExecutorOptions<{
      browserTarget?: string;
      buildTarget?: string;
    }>(tree, executor, (_, project, target, configuration) => {
      const projectConfiguration = readProjectConfiguration(tree, project);
      const config = configuration
        ? projectConfiguration.targets[target].configurations[configuration]
        : projectConfiguration.targets[target].options;

      updateConfig(config);

      updateProjectConfiguration(tree, project, projectConfiguration);
    });
  });

  // update options from nx.json target defaults
  const nxJson = readNxJson(tree);
  if (!nxJson.targetDefaults) {
    return;
  }

  const original = nxJson.targetDefaults;
  const entries = normalizeTargetDefaults(original);
  for (const entry of entries) {
    // Match either the legacy `target`-as-executor key (an executor
    // identifier in the `target` slot) or an explicit `executor` field.
    if (
      !executors.includes(entry.target) &&
      !executors.includes(entry.executor)
    ) {
      continue;
    }

    if (entry.options) {
      updateConfig(entry.options);
    }

    Object.values(entry.configurations ?? {}).forEach((config) => {
      updateConfig(config);
    });
  }
  // Preserve the original on-disk shape so a record-shape nx.json stays
  // valid against pre-v23 schemas; normalized array writes back as array.
  nxJson.targetDefaults = Array.isArray(original)
    ? entries
    : downgradeTargetDefaults(entries);

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}

function updateConfig(config: {
  browserTarget?: string;
  buildTarget?: string;
}): void {
  if (config && config.browserTarget) {
    config.buildTarget ??= config.browserTarget;
    delete config.browserTarget;
  }
}
