import {describe,expect,it} from "vitest";
import {shouldNavigateAfterAuthentication} from "../src/App";

describe("settings authentication navigation",()=>{
  it("keeps an already authenticated user on Settings after session restore",()=>{
    expect(shouldNavigateAfterAuthentication(null,true)).toBe(false);
  });

  it("returns to recipes only after a real signed-out to signed-in transition",()=>{
    expect(shouldNavigateAfterAuthentication(false,true)).toBe(true);
  });
});
