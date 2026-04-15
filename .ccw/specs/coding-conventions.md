# Project Coding Conventions

## Execution

- Default remote environment for this project is `u@10.10.9.41`. SSH password is a single space character.
- Default project database is `postgresql://postgres:f0354c0add5f49b8fae72ad8dddb2793@10.10.9.41:5432/intelliflow`.
- The 41 backend service manager is `systemd`, using unit `intelliflow-backend.service`.
- On 41, use `systemctl` for start/restart/status and `journalctl -u intelliflow-backend` for logs.
- In this project, when the user says `更新41`, interpret it as: batch the relevant local file changes into one or more git commits, push them to `origin`, update `10.10.9.41` from git, and then decide whether to rebuild frontend assets, restart the backend service, and update the database based on the actual change scope.
- After completing code changes for this repository, sync the updated code to `10.10.9.41`.
- After syncing backend code to 41, restart `intelliflow-backend.service`.
- If frontend assets changed, rebuild frontend on 41 with Node-based Vite, not Bun-based Vite.
- When a change includes schema, migration, seed, or other DB-affecting work, also update the database on `10.10.9.41` as needed.
- Unless the user explicitly specifies another environment, treat `10.10.9.41` as the default target for deployment-style updates after code changes.
