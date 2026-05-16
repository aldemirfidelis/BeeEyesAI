using System.Collections.Generic;
using UnityEngine;

namespace CasaDaBee
{
    public class BeeHouseBridge : MonoBehaviour
    {
        public BeeAgentController bee;
        public SpeechBubbleController speechBubble;
        public List<FurnitureStation> stations = new List<FurnitureStation>();

        public void ApplyTaskStatus(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return;
            var task = JsonUtility.FromJson<BeeHouseTaskMessage>(json);
            ApplyTask(task);
        }

        public void ApplyHouseSnapshot(string json)
        {
            Debug.Log("Casa da Bee snapshot received: " + (json == null ? 0 : json.Length) + " chars");
        }

        public void ApplyTask(BeeHouseTaskMessage task)
        {
            if (task == null || bee == null) return;

            var taskType = string.IsNullOrEmpty(task.taskType) ? "general" : task.taskType;
            var status = string.IsNullOrEmpty(task.status) ? "processing" : task.status;
            var nextState = string.IsNullOrEmpty(task.beeState) ? BeeTaskPresentation.StateFor(status, taskType) : task.beeState;
            var targetStation = string.IsNullOrEmpty(task.targetStation) ? BeeTaskPresentation.StationFor(taskType) : task.targetStation;
            var speech = string.IsNullOrEmpty(task.speechText) ? BeeTaskPresentation.SpeechFor(status, taskType) : task.speechText;

            var station = FindStation(targetStation);
            if (station != null)
            {
                var anchor = station.beeAnchor == null ? station.transform : station.beeAnchor;
                bee.MoveTo(anchor.position);
            }

            bee.SetState(nextState);
            if (speechBubble != null) speechBubble.Show(speech);
        }

        public void SimulateTask(string taskType)
        {
            var task = new BeeHouseTaskMessage
            {
                taskType = taskType,
                status = taskType == "failed" ? "failed" : "processing",
                targetStation = BeeTaskPresentation.StationFor(taskType),
            };
            task.beeState = BeeTaskPresentation.StateFor(task.status, task.taskType);
            task.speechText = BeeTaskPresentation.SpeechFor(task.status, task.taskType);
            ApplyTask(task);
        }

        private FurnitureStation FindStation(string key)
        {
            foreach (var station in stations)
            {
                if (station != null && station.stationKey == key) return station;
            }

            return null;
        }
    }
}
