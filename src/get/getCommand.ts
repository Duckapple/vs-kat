import fs = require("fs");
import vscode = require("vscode");
import unzipper = require("unzipper");
import { getProblemUrl } from "../utilities/uri";
import { fetch } from "../utilities/fetch";
import { workspacePath } from "../globals";

export const getProblemSub = vscode.commands.registerCommand(
  "vs-kat.get-problem",
  async (problemName?: string) => {
    if (problemName == null) {
      problemName = await vscode.window.showInputBox({
        placeHolder: "Problem name...",
        prompt: "Write the name of the problem",
      });
    }

    if (problemName == null || problemName.includes("/")) return;

    const problemDir = `${workspacePath.value}/${problemName}`;
    const testDir = `${problemDir}/test`;

    if (fs.existsSync(`${workspacePath.value}/${problemName}`)) {
      return vscode.window.showErrorMessage(
        `Problem '${problemName}' already exists.`
      );
    }

    const baseProblemUrl = getProblemUrl(problemName);

    if (!problemExists(baseProblemUrl)) {
      return vscode.window.showErrorMessage("Problem does not exist.");
    }

    fs.mkdirSync(problemDir);
    fs.mkdirSync(testDir);

    const zipResponse = await fetch(
      baseProblemUrl + "/file/statement/samples.zip"
    );
    if (zipResponse.status !== 200) {
      return vscode.window.showErrorMessage(
        `Could not retrieve samples for '${problemName}'.`
      );
    }

    const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
    const unzip = await unzipper.Open.buffer(zipBuffer);
    unzip.files.forEach(async (f) =>
      fs.writeFileSync(testDir + "/" + f.path, await f.buffer())
    );

    fs.writeFileSync(
      `${problemDir}/${problemName}.py`,
      "first_line = input()\n"
    );

    // TODO: Add boilerplate file

    return vscode.window.showInformationMessage(`Retrieved ${problemName}`);
  }
);

async function problemExists(baseProblemUrl: string) {
  const res = await fetch(baseProblemUrl);
  return res.status === 200;
}
