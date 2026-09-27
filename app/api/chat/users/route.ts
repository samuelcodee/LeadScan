import type { NextRequest } from "next/server";
import { findPeople } from "@/lib/chat/service";
import { withChatUser } from "@/lib/chat/http";

export async function GET(request: NextRequest) {
  return withChatUser("chat", async (user) => ({ people: await findPeople(user.id, request.nextUrl.searchParams.get("q") ?? "") }));
}
