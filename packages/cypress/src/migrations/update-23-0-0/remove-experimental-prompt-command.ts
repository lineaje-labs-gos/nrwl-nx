import { formatFiles, type Tree } from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';
import type { Identifier, PropertyAssignment } from 'typescript';
import { cypressProjectConfigs } from '../../utils/migrations';

const SELECTOR =
  'PropertyAssignment > Identifier[name=experimentalPromptCommand]';

export default async function removeExperimentalPromptCommand(tree: Tree) {
  for await (const { cypressConfigPath } of cypressProjectConfigs(tree)) {
    if (!tree.exists(cypressConfigPath)) {
      continue;
    }

    const contents = tree.read(cypressConfigPath, 'utf-8');
    if (!contents.includes('experimentalPromptCommand')) {
      continue;
    }

    const sourceFile = ast(contents);
    const identifiers = query<Identifier>(sourceFile, SELECTOR);
    if (identifiers.length === 0) {
      continue;
    }

    let updated = contents;
    // Walk end-to-start so positions remain valid as we slice.
    for (let i = identifiers.length - 1; i >= 0; i--) {
      const propAssign = identifiers[i].parent as PropertyAssignment;
      const start = propAssign.getStart(sourceFile);
      let end = propAssign.getEnd();
      // Eat a single trailing comma if present (prettier handles whitespace).
      if (updated[end] === ',') {
        end++;
      }
      updated = updated.slice(0, start) + updated.slice(end);
    }

    tree.write(cypressConfigPath, updated);
  }

  await formatFiles(tree);
}
