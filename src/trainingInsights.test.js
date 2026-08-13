import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { trainingInsights } from "./trainingInsights.js";

const session=(date,name,weight,reps=10)=>({date,exercises:[{name,sets:[{weight,reps,unit:"lb"}]}]});

describe("stall and deload insights",()=>{
  test("requires at least three performances",()=>{
    assert.deepEqual(trainingInsights([session("1","Press",100),session("2","Press",100)]),[]);
  });

  test("detects three essentially flat sessions",()=>{
    const result=trainingInsights([session("1","Press",100),session("2","Press",100),session("3","Press",100)]);
    assert.equal(result[0].type,"stall");
    assert.deepEqual(result[0].evidence.map(item=>item.estimated1RMlb),[133,133,133]);
    assert.equal(result[0].changePct,0);
  });

  test("detects a sustained decline of at least five percent",()=>{
    const result=trainingInsights([session("1","Squat",200),session("2","Squat",190),session("3","Squat",180)]);
    assert.equal(result[0].type,"deload");
    assert.equal(result[0].changePct,-10);
  });

  test("does not flag an improving or single-dip trend",()=>{
    assert.deepEqual(trainingInsights([session("1","Row",100),session("2","Row",95),session("3","Row",105)]),[]);
  });

  test("keeps exercise histories separate",()=>{
    const sessions=[session("1","Press",100),session("2","Press",100),session("3","Press",100),session("4","Row",100)];
    assert.deepEqual(trainingInsights(sessions).map(item=>item.name),["Press"]);
  });
});
