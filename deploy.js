import { execSync } from 'child_process';
import { existsSync, rmSync, cpSync } from 'fs';
import { join } from 'path';

const distDir = 'dist';
const deployDir = '.gh-pages-deploy';

try {
  // Clean up any existing deploy directory
  if (existsSync(deployDir)) {
    rmSync(deployDir, { recursive: true, force: true });
  }

  // Clone the gh-pages branch (or create new)
  console.log('Setting up gh-pages branch...');
  try {
    execSync(`git clone --branch gh-pages --single-branch --depth 1 . ${deployDir}`, { stdio: 'inherit' });
  } catch {
    // Branch doesn't exist, create a new orphan branch
    execSync(`git clone . ${deployDir}`, { stdio: 'inherit' });
    process.chdir(deployDir);
    execSync('git checkout --orphan gh-pages', { stdio: 'inherit' });
    execSync('git rm -rf .', { stdio: 'inherit' });
    process.chdir('..');
  }

  // Clear existing files in deploy dir (except .git)
  console.log('Clearing old files...');
  const deployGitDir = join(deployDir, '.git');
  execSync(`Get-ChildItem -Path "${deployDir}" -Exclude ".git" | Remove-Item -Recurse -Force`, { shell: 'powershell', stdio: 'inherit' });

  // Copy dist contents to deploy directory
  console.log('Copying new files...');
  cpSync(distDir, deployDir, { recursive: true });

  // Commit and push
  console.log('Committing and pushing...');
  process.chdir(deployDir);
  execSync('git add -A', { stdio: 'inherit' });
  
  try {
    execSync('git commit -m "Deploy to gh-pages"', { stdio: 'inherit' });
    execSync('git push origin gh-pages --force', { stdio: 'inherit' });
    console.log('Deployed successfully!');
  } catch (e) {
    console.log('No changes to deploy or push failed');
  }

  // Cleanup
  process.chdir('..');
  rmSync(deployDir, { recursive: true, force: true });

} catch (error) {
  console.error('Deploy failed:', error.message);
  process.exit(1);
}
