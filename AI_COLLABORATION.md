# AI Collaboration Guidelines

This file serves as a coordination protocol for multiple AI agents (e.g., Antigravity, Claude) working on this repository simultaneously.

## Core Rules

1. **Always Pull Before Push**: Before making any significant changes or pushing to Git, always run `git pull origin master` (or current branch) to capture updates from other agents.
2. **Feature Isolation**: To avoid conflicts, only one AI should work on a specific feature or page at any given time.
   - Example: If Antigravity is updating **Strategy Lab**, Claude should focus on **Gallery** or another module.
3. **Commit Messages**: Use descriptive commit messages specifying which AI made the change and what was updated.
4. **Environment Awareness**: Always check the most recent commit or `AI_COLLABORATION.md` to see what was last changed.
5. **Conflict Resolution**: In case of merge conflicts, prefer keeping both changes if they target different features, or ask the USER for clarification if logic overlaps.

## Current Responsibilities
- **Claude**: Dashboard Visuals, Gallery, CSS Refinement.
- **Antigravity**: Data Fetching (Dhan), Strategy Logic, Backend Stability, Git Management.
