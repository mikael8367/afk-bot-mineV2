import {timingSafeEqual} from "node:crypto";

export function isLocalApiTokenValid(expected, supplied) {
  if (!expected) return true;
  if (typeof supplied !== "string" || supplied.length === 0) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes);
}
