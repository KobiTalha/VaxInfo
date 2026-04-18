import { createDeveloperKeyHandlers } from "@/lib/server/developer-keys-route";

const handlers = createDeveloperKeyHandlers();

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
