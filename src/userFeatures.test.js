import {describe,test} from "node:test";
import assert from "node:assert/strict";
import {addGoal,getGoals,goalProgress,normalizeReadiness,readinessScore} from "./userFeatures.js";

describe("readiness and goals",()=>{
  test("normalizes and scores readiness",()=>{assert.deepEqual(normalizeReadiness({energy:9,sleep:1,soreness:4,pain:1}),{energy:5,sleep:1,soreness:4,pain:true});assert.equal(readinessScore({energy:5,sleep:5,soreness:1}),100);});
  test("adds and reads a goal",()=>{const result=addGoal({}, {exercise:"Bench",target:200},1);assert.equal(result.ok,true);assert.equal(getGoals(result.prefs)[0].id,"goal-1");});
  test("calculates goal progress with unit conversion",()=>{const goal={exercise:"Bench",target:100,unit:"kg"};const progress=goalProgress(goal,[{exercises:[{name:"Bench",sets:[{weight:220.462,unit:"lb"}]}]}]);assert.equal(progress.complete,true);assert.equal(progress.pct,100);});
});
