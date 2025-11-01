# Publishing Guide for Gist Editor

This guide will walk you through publishing the Gist Editor extension to the VS Code Marketplace.

## Prerequisites

1. **GitHub Account** - Already required for development
2. **VS Code Marketplace Account** - Create at https://marketplace.visualstudio.com
3. **Personal Access Token (PAT)** - From VS Code Marketplace
4. **vsce CLI** - VS Code Extension Manager (install globally)

## Step 1: Create a Marketplace Account

1. Go to https://marketplace.visualstudio.com
2. Click "Sign in" and use your Microsoft/GitHub account
3. Create a publisher account if you don't have one:
   - Click your profile → "Create publisher"
   - Choose a publisher ID (e.g., "yourusername", "yourcompany")
   - This will be used in `package.json` as the `publisher` field

## Step 2: Generate a Personal Access Token

1. Go to https://dev.azure.com/
2. In the top-right corner, click your profile icon → "Personal access tokens"
3. Click "New Token"
4. Fill in the form:
   - **Name**: "vsce-token" (or any name you prefer)
   - **Organization**: Select your organization (appears automatically after creation)
   - **Scopes**: Select "Marketplace" → "Manage"
5. Click "Create"
6. **Save the token immediately** - you won't be able to see it again

## Step 3: Install vsce

Install the VS Code Extension Manager CLI:

```bash
npm install -g @vscode/vsce
```

Verify installation:

```bash
vsce --version
```

## Step 4: Update package.json

Before publishing, ensure your `package.json` has the correct values:

```json
{
  "publisher": "your-publisher-id",
  "name": "gist-editor",
  "displayName": "Gist Editor",
  "description": "Manage GitHub Gists directly from VS Code",
  "version": "1.0.0",
  "license": "MIT"
}
```

**Important:** Change:
- `"publisher": "your-publisher-name"` → Your actual publisher ID
- `"version"` → Use semantic versioning (MAJOR.MINOR.PATCH)
- `"repository"` → Point to your actual GitHub repository
- `"bugs"` → Point to your actual issues page

## Step 5: Prepare for Publishing

### Ensure everything builds correctly:

```bash
npm run package
```

This will:
- Type check the code
- Run linting
- Build the minified extension

### Test locally:

1. Press F5 in VS Code to launch the extension in debug mode
2. Verify all features work as expected
3. Check the extension icon displays correctly

### Create a .vscodeignore file

The `.vscodeignore` file is already set up, but verify it contains:

```
.git
.gitignore
.vscode
.vscode-test.mjs
.vscodeignore
**/*.ts
src/**
out/**
node_modules/**
*.vsix
.prettierrc
eslint.config.mjs
tsconfig.json
esbuild.js
```

This ensures only necessary files are packaged.

## Step 6: Package the Extension (Optional)

To create a VSIX file for manual distribution:

```bash
vsce package
```

This creates a `gist-editor-1.0.0.vsix` file that can be:
- Shared with others
- Installed locally with `code --install-extension gist-editor-1.0.0.vsix`
- Used for internal distribution

## Step 7: Publish to Marketplace

### Option A: Using Personal Access Token

1. Configure vsce with your token:

```bash
vsce login your-publisher-id
```

(vsce will prompt you to enter your PAT)

2. Publish the extension:

```bash
vsce publish
```

This will:
- Build the extension
- Package it as VSIX
- Upload to the marketplace
- Automatically bump the patch version in package.json (optional: add `--no-update-package-json` to skip)

### Option B: Direct Publishing with Token

```bash
vsce publish -p <your-personal-access-token>
```

### Success!

After publishing, your extension will appear on:
- VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=your-publisher-id.gist-editor
- It may take a few minutes for it to show in search results

## Step 8: Update Version for Future Releases

For each new release:

1. Update the version in `package.json`:
   ```json
   "version": "1.1.0"
   ```

2. Update `CHANGELOG.md` with release notes

3. Commit changes:
   ```bash
   git add .
   git commit -m "Release v1.1.0"
   git tag v1.1.0
   git push
   git push --tags
   ```

4. Publish:
   ```bash
   vsce publish
   ```

Or if you want to auto-increment:
```bash
vsce publish patch  # 1.0.0 → 1.0.1
vsce publish minor  # 1.0.0 → 1.1.0
vsce publish major  # 1.0.0 → 2.0.0
```

## Publishing Checklist

Before hitting publish, verify:

- [ ] Version number is updated in `package.json`
- [ ] `CHANGELOG.md` has release notes for this version
- [ ] `publisher` field in `package.json` is set correctly
- [ ] `repository` URL points to your GitHub repo
- [ ] `icon.svg` exists and looks good
- [ ] `README.md` is complete and well-formatted
- [ ] `LICENSE` file is present
- [ ] `npm run package` completes without errors
- [ ] Extension works correctly locally (F5 → test features)
- [ ] No TypeScript errors: `npm run check-types`
- [ ] No linting errors: `npm run lint`
- [ ] You have a marketplace account with a publisher ID
- [ ] You have a valid Personal Access Token with Marketplace scope

## Troubleshooting

### "The publisher name does not match"

**Error**: `publisher 'xyz' not found`

**Solution**: Make sure the `publisher` field in `package.json` matches your actual publisher ID on the marketplace.

### "Invalid personal access token"

**Error**: `Error: Invalid personal access token`

**Solution**:
- Check the token hasn't expired
- Verify it has "Marketplace" → "Manage" scope
- Try logging in again: `vsce logout` then `vsce login`

### "Extension already published"

**Error**: `Version already exists`

**Solution**: Increment the version number in `package.json` before publishing again.

### "VSIX file too large"

**Error**: `Package size is greater than 100 MB`

**Solution**:
- Ensure `.vscodeignore` is properly configured
- Remove `node_modules` (it shouldn't be packaged): verify in `.vscodeignore`
- Check the built `dist/extension.js` isn't duplicated

## Resources

- **VS Code Extension Guidelines**: https://code.visualstudio.com/api/references/extension-guidelines
- **vsce Documentation**: https://github.com/microsoft/vscode-vsce
- **Publishing to Marketplace**: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **Marketplace Overview**: https://marketplace.visualstudio.com/

## After Publishing

### Promotion

1. **Share on Social Media**: Twitter, Reddit's r/vscode, etc.
2. **GitHub Releases**: Add GitHub releases linked to the marketplace
3. **Mention in Blog/Portfolio**: If applicable

### Maintenance

1. **Monitor Issues**: Set up GitHub issue templates
2. **Track Downloads**: Check marketplace analytics for usage stats
3. **Plan Updates**: Gather feedback and plan improvements

---

**Good luck publishing your extension! 🚀**
