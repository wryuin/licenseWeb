# Key Generator

A simple web application for generating and storing keys of various formats with saving to a YAML file on GitHub.

## Features

- Generation of different key types: random, UUID, alphanumeric, hexadecimal
- Customizable key length (except for UUID)
- Saving keys to a YAML file in your GitHub repository
- History of saved keys
- Copying keys to clipboard

## Usage

1. Open `index.html` in your browser
2. In the "GitHub" tab, enter:
   - GitHub username
   - Repository name
   - GitHub personal access token (with repository write permissions)
   - Path to the YAML file (default is `keys.yml`)
3. Save the settings
4. Return to the "Generator" tab and create a key
5. Save the key to GitHub by clicking the "Save to GitHub" button

## Creating a GitHub Token

1. Go to [Personal Access Tokens](https://github.com/settings/tokens) in GitHub settings
2. Click "Generate new token" (Classic)
3. Give your token a description
4. Select permissions:
   - `repo` - full access to repositories
5. Create the token and save it (the token is shown only once)