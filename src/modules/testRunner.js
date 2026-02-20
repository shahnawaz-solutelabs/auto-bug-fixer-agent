import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const IS_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const TEST_STRATEGIES = [
  {
    name: "npm test",
    detect: (dir) => existsSync(join(dir, "package.json")),
    command: (dir) => {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
      return pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1'
        ? "npm test"
        : null;
    },
  },
  {
    name: "pytest",
    detect: (dir) =>
      existsSync(join(dir, "pytest.ini")) ||
      existsSync(join(dir, "setup.py")) ||
      existsSync(join(dir, "pyproject.toml")),
    command: () => "python -m pytest --tb=short -q",
  },
  {
    name: "go test",
    detect: (dir) => existsSync(join(dir, "go.mod")),
    command: () => "go test ./...",
  },
  {
    name: "cargo test",
    detect: (dir) => existsSync(join(dir, "Cargo.toml")),
    command: () => "cargo test",
  },
  {
    name: "mvn test",
    detect: (dir) => existsSync(join(dir, "pom.xml")),
    command: () => "mvn test -q",
  },
];

export class TestRunner {
  run(repoPath) {
    if (IS_SERVERLESS) {
      return { passed: true, skipped: true, output: "Skipped — serverless environment" };
    }

    const strategy = TEST_STRATEGIES.find((s) => s.detect(repoPath));

    if (!strategy) {
      return { passed: true, skipped: true, output: "" };
    }

    const cmd = strategy.command(repoPath);
    if (!cmd) {
      return { passed: true, skipped: true, output: "" };
    }

    try {
      this._installDependencies(repoPath);

      const output = execSync(cmd, {
        cwd: repoPath,
        encoding: "utf-8",
        timeout: 300_000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      return { passed: true, skipped: false, output };
    } catch (err) {
      const output = (err.stdout || "") + "\n" + (err.stderr || "");
      return { passed: false, skipped: false, output };
    }
  }

  _installDependencies(repoPath) {
    const pkgPath = join(repoPath, "package.json");
    const nodeModules = join(repoPath, "node_modules");

    if (existsSync(pkgPath) && !existsSync(nodeModules)) {
      try {
        execSync("npm install --ignore-scripts", {
          cwd: repoPath,
          encoding: "utf-8",
          timeout: 120_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        // continue anyway
      }
    }
  }
}
