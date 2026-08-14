import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { announceRestComplete, getRestTimerSeconds, setRestTimerSeconds } from "./restTimer.js";

describe("rest timer preferences", () => {
  test("defaults to 90 seconds", () => {
    assert.equal(getRestTimerSeconds({}), 90);
    assert.equal(getRestTimerSeconds({ __restTimerSeconds:45 }), 90);
  });

  test("accepts supported durations and preserves other preferences", () => {
    const prefs = setRestTimerSeconds({ "Bench Press":"machine" }, 120);
    assert.equal(getRestTimerSeconds(prefs), 120);
    assert.equal(prefs["Bench Press"], "machine");
  });

  test("ignores unsupported durations", () => {
    assert.deepEqual(setRestTimerSeconds({ x:"free" }, 75), { x:"free" });
  });
});

describe("rest timer completion feedback",()=>{
  test("swallows unsupported vibration and notification APIs",()=>{
    class BrokenNotification { static permission="granted"; constructor(){throw new Error("unsupported");} }
    assert.doesNotThrow(()=>announceRestComplete({NotificationApi:BrokenNotification,navigatorApi:{vibrate(){throw new Error("blocked");}}}));
  });

  test("does not duplicate browser notifications on native platforms",()=>{
    let created=0;
    class NotificationApi { static permission="granted"; constructor(){created+=1;} }
    announceRestComplete({NotificationApi,navigatorApi:{},isNative:true});
    assert.equal(created,0);
  });
});
