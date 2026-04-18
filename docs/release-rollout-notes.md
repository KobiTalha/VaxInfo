# Release Rollout Notes

## Wave 1

- Enable Vercel project environment variables for Supabase URLs.
- Run `npm run prisma:migrate:deploy` before first production traffic.
- Verify `/api/health` returns `status: ok` after deployment.
