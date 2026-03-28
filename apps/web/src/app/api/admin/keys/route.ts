import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  createApiKey,
  revokeApiKey,
  listApiKeys,
} from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";

export async function POST(request: NextRequest) {
  return withRequestLogging(request, async () => {
    try {
      await requireAuth(request, { scope: "admin" });

      const body = await request.json();
      const { name, scope } = body;

      if (!name || typeof name !== "string") {
        return NextResponse.json(
          { error: "name is required and must be a string" },
          { status: 400 }
        );
      }

      if (!scope || !["agent", "admin"].includes(scope)) {
        return NextResponse.json(
          { error: 'scope must be "agent" or "admin"' },
          { status: 400 }
        );
      }

      const result = await createApiKey(name, scope);
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  });
}

export async function GET(request: NextRequest) {
  return withRequestLogging(request, async () => {
    try {
      await requireAuth(request, { scope: "admin" });
      const keys = await listApiKeys();
      return NextResponse.json(keys);
    } catch (error) {
      return handleApiError(error);
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withRequestLogging(request, async () => {
    try {
      await requireAuth(request, { scope: "admin" });

      const body = await request.json();
      const { key_id } = body;

      if (!key_id || typeof key_id !== "string") {
        return NextResponse.json(
          { error: "key_id is required" },
          { status: 400 }
        );
      }

      await revokeApiKey(key_id);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return handleApiError(error);
    }
  });
}
