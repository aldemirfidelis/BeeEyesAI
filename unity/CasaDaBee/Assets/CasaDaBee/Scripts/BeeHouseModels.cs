using System;
using UnityEngine;

namespace CasaDaBee
{
    public static class BeeStates
    {
        public const string Idle = "idle";
        public const string Walking = "walking";
        public const string Speaking = "speaking";
        public const string Thinking = "thinking";
        public const string Working = "working";
        public const string Researching = "researching";
        public const string Happy = "happy";
        public const string Tired = "tired";
        public const string Sleeping = "sleeping";
        public const string Confused = "confused";
        public const string Celebrating = "celebrating";
    }

    [Serializable]
    public class BeeHouseTaskMessage
    {
        public string id;
        public string sourceMessageId;
        public string taskType;
        public string status;
        public string beeState;
        public string targetStation;
        public string speechText;
        public int progress;
        public string resultSummary;
        public string errorMessage;
    }

    [Serializable]
    public class BeeHouseSnapshotMessage
    {
        public string rawJson;
    }

    public static class BeeTaskPresentation
    {
        public static string StateFor(string status, string taskType)
        {
            if (status == "completed") return BeeStates.Happy;
            if (status == "failed") return BeeStates.Confused;
            if (status == "searching") return BeeStates.Researching;
            if (status == "generating") return BeeStates.Working;
            if (status == "processing" && (taskType == "research" || taskType == "study")) return BeeStates.Thinking;
            if (status == "processing") return BeeStates.Working;
            return BeeStates.Idle;
        }

        public static string StationFor(string taskType)
        {
            if (taskType == "research") return "computer";
            if (taskType == "fitness") return "fitness";
            if (taskType == "calendar") return "calendar";
            if (taskType == "study") return "library";
            if (taskType == "shopping") return "desk";
            return "desk";
        }

        public static string SpeechFor(string status, string taskType)
        {
            if (status == "searching") return "Estou pesquisando isso para voce!";
            if (status == "generating") return "Ja volto com a resposta!";
            if (status == "completed") return "Prontinho, encontrei!";
            if (status == "failed") return "Ops, tive dificuldade aqui.";
            if (taskType == "calendar") return "Vou organizar isso agora!";
            if (taskType == "fitness") return "Vou preparar seu treino!";
            if (taskType == "study") return "Vou estudar isso com voce!";
            return "Estou trabalhando nisso!";
        }
    }

    public class FurnitureStation : MonoBehaviour
    {
        public string stationKey = "desk";
        public Transform beeAnchor;

        private void Reset()
        {
            beeAnchor = transform;
        }
    }
}
