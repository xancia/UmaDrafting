import { normalizeRoomCode } from "./roomCode";

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

export function buildInvitePath(
  mode: "join" | "spectate",
  roomCode: string,
): string {
  const basePath = normalizeBasePath(import.meta.env.BASE_URL || "/");
  const normalizedCode = normalizeRoomCode(roomCode);
  const route = `${mode}/${normalizedCode}`;
  return basePath === "/" ? `/${route}` : `${basePath}${route}`;
}

export function buildInviteUrl(
  mode: "join" | "spectate",
  roomCode: string,
): string {
  const path = buildInvitePath(mode, roomCode);
  if (typeof window === "undefined") {
    return path;
  }
  return new URL(path, window.location.origin).toString();
}
