import test from "node:test";
import assert from "node:assert/strict";
import {isLocalApiTokenValid} from "../src/core/local-api-auth.js";

test("local API token is required only when configured", () => {
  assert.equal(isLocalApiTokenValid("", undefined), true);
  assert.equal(isLocalApiTokenValid("secret", undefined), false);
  assert.equal(isLocalApiTokenValid("secret", ""), false);
  assert.equal(isLocalApiTokenValid("secret", "wrong"), false);
  assert.equal(isLocalApiTokenValid("secret", "secret"), true);
  assert.equal(isLocalApiTokenValid("token-😀", "token-😀"), true);
});
