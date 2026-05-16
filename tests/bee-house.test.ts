import assert from "node:assert/strict";
import { test } from "node:test";
import {
  beeStateForTaskStatus,
  inferBeeHouseTaskType,
  speechForTaskStatus,
  stationForTaskType,
} from "../shared/bee-house";

test("infers Bee house task presentation for research", () => {
  const taskType = inferBeeHouseTaskType("pesquise noticias sobre produtividade");
  assert.equal(taskType, "research");
  assert.equal(stationForTaskType(taskType), "computer");
  assert.equal(beeStateForTaskStatus("searching", taskType), "researching");
  assert.match(speechForTaskStatus("searching", taskType), /pesquisando/);
});

test("maps fitness and calendar tasks to house stations", () => {
  assert.equal(inferBeeHouseTaskType("monte um treino de pernas"), "fitness");
  assert.equal(stationForTaskType("fitness"), "fitness");
  assert.equal(inferBeeHouseTaskType("crie um evento no calendario"), "calendar");
  assert.equal(stationForTaskType("calendar"), "calendar");
});
