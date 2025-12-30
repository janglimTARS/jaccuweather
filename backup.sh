#!/bin/bash
# Automated backup script for Weather app
# This script commits all changes and pushes to the remote repository

# Navigate to project directory
cd "$(dirname "$0")"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not a git repository. Please initialize git first."
    exit 1
fi

# Check if there are any changes to commit
if git diff-index --quiet HEAD --; then
    echo "No changes to commit. Repository is up to date."
    exit 0
fi

# Add all changes
echo "Staging all changes..."
git add .

# Create commit with timestamp
COMMIT_MESSAGE="Auto-backup: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Creating commit: $COMMIT_MESSAGE"
git commit -m "$COMMIT_MESSAGE"

# Check if remote is configured
if git remote | grep -q "origin"; then
    echo "Pushing to remote repository..."
    git push origin main 2>&1 || git push origin master 2>&1
    if [ $? -eq 0 ]; then
        echo "✓ Backup completed successfully!"
    else
        echo "⚠ Warning: Local commit created, but push to remote failed."
        echo "  Make sure you have:"
        echo "  1. Created a remote repository (GitHub/GitLab/etc.)"
        echo "  2. Added it with: git remote add origin <repository-url>"
        echo "  3. Authenticated with the remote service"
    fi
else
    echo "⚠ Warning: No remote repository configured."
    echo "  Local commit created, but not pushed."
    echo "  To set up remote: git remote add origin <repository-url>"
fi

