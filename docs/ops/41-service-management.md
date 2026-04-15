# 41 Environment Service Management

## Chosen Approach

The `10.10.9.41` environment uses a `systemd` system service for the backend:

- Service name: `intelliflow-backend.service`
- Unit file source in repo: `ops/systemd/intelliflow-backend.service`
- Runtime code path on server: `/home/u/intelliflow-docs`
- Backend listen port: `14001`

`systemd` was chosen because it provides:

- reliable start and restart commands
- built-in log access via `journalctl`
- automatic restart on crash
- boot-time auto start with `systemctl enable`

## Service Commands on 41

Use these commands on `u@10.10.9.41`:

```bash
printf ' \n' | sudo -S systemctl status intelliflow-backend
printf ' \n' | sudo -S systemctl restart intelliflow-backend
printf ' \n' | sudo -S systemctl start intelliflow-backend
printf ' \n' | sudo -S systemctl stop intelliflow-backend
printf ' \n' | sudo -S journalctl -u intelliflow-backend -n 200 --no-pager
printf ' \n' | sudo -S journalctl -u intelliflow-backend -f
printf ' \n' | sudo -S systemctl enable intelliflow-backend
printf ' \n' | sudo -S systemctl disable intelliflow-backend
```

Note:

- The SSH and `sudo` password on 41 is a single space character.
- `sudo` is required because the service is installed as a system unit.

## Deployment Notes

After code changes for this repo:

1. Sync updated source files to `/home/u/intelliflow-docs` on `10.10.9.41`.
2. Restart the backend service with `systemctl restart intelliflow-backend`.
3. If frontend files changed, rebuild frontend assets on 41 from `/home/u/intelliflow-docs/packages/frontend`.

Frontend build on 41 must use Node, not Bun:

```bash
cd /home/u/intelliflow-docs/packages/frontend
/home/u/.nvm/versions/node/v20.12.2/bin/node node_modules/vite/bin/vite.js build
```

Reason:

- `bun vite build` crashes on 41 due the CPU / Bun runtime combination (`SIGILL`).

## Health Check

```bash
curl http://127.0.0.1:14001/api/health
```

Expected response shape:

```json
{"status":"ok","timestamp":"..."}
```

## Frontend Serving

The backend is managed by `systemd`.

Frontend static assets are built into:

```bash
/home/u/intelliflow-docs/packages/frontend/dist
```

`openresty/nginx` is responsible for serving the site on port `8084` and proxying API traffic as configured on the server.
