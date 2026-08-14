import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {trackingForExercise,trackingLabels} from "./exerciseTracking.js";

describe("exercise tracking modes",()=>{
  test("classifies built-in bodyweight, timed, distance, and weighted exercises",()=>{
    assert.equal(trackingForExercise({name:"Hanging Leg Raises"}),"bodyweight");
    assert.equal(trackingForExercise({name:"Plank w/ Shoulder Taps"}),"timed");
    assert.equal(trackingForExercise({name:"Farmer's Carries"}),"distance");
    assert.equal(trackingForExercise({name:"Barbell/DB Bench Press"}),"weighted");
  });
  test("infers tracking for custom exercise targets",()=>{
    assert.equal(trackingForExercise({name:"Wall sit",target:"3 x 45 sec"}),"timed");
    assert.equal(trackingForExercise({name:"Sled",target:"4 x 20 meters"}),"distance");
  });
  test("provides labels that describe optional loading",()=>{
    assert.equal(trackingLabels("bodyweight").weight,"Added weight");
    assert.equal(trackingLabels("timed").measure,"Seconds");
  });
});
