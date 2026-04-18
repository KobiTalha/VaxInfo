# Release Rollout Notes

## Wave 1

- Enable Vercel project environment variables for Supabase URLs.
- Run `npm run prisma:migrate:deploy` before first production traffic.
- Verify `/api/health` returns `status: ok` after deployment.

## Wave 2

- Validate authenticated flows (`/auth/signin`, `/api/user/*`) against production session storage.
- Confirm API key lifecycle actions (`create`, `rotate`, `revoke`, `activate`, `delete`) in `/developers`.
- Monitor `ErrorLog` inserts for the first 24 hours after release.
